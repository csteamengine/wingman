use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Manager, Runtime, WebviewWindow};
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelHandle, PanelLevel, StyleMask,
    WebviewWindowExt as WebviewPanelExt,
};
use thiserror::Error;
use crate::storage::load_settings;

pub const MAIN_WINDOW_LABEL: &str = "main";

/// Global flag to prevent panel from hiding during dialog operations
pub static DIALOG_OPEN: AtomicBool = AtomicBool::new(false);

/// Monitor workspace changes and refocus panel in sticky mode
pub fn start_workspace_monitor<R: Runtime>(app_handle: tauri::AppHandle<R>) {
    std::thread::spawn(move || {
        let mut last_workspace_id: Option<String> = None;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));

            // Get current workspace/space ID using AppleScript
            let output = std::process::Command::new("osascript")
                .arg("-e")
                .arg(r#"tell application "System Events" to get the name of the first desktop whose displays contains (get the name of the first display whose active is true)"#)
                .output();

            if let Ok(output) = output {
                if let Ok(workspace_id) = String::from_utf8(output.stdout) {
                    let workspace_id = workspace_id.trim().to_string();

                    // Check if workspace changed
                    if let Some(ref last_id) = last_workspace_id {
                        if *last_id != workspace_id && !workspace_id.is_empty() {
                            log::info!("Workspace changed from '{}' to '{}'", last_id, workspace_id);

                            // Check if sticky mode is enabled
                            if let Ok(settings) = load_settings() {
                                if settings.sticky_mode {
                                    log::info!("Sticky mode active - refocusing panel");

                                    // Refocus the panel on the main thread
                                    // Clone app_handle for each closure to avoid borrow issues
                                    let app_for_thread = app_handle.clone();
                                    let app_for_closure = app_for_thread.clone();
                                    let _ = app_for_thread.run_on_main_thread(move || {
                                        if let Ok(panel) = app_for_closure.get_webview_panel(MAIN_WINDOW_LABEL) {
                                            if panel.is_visible() {
                                                panel.make_key_window();
                                                let _ = app_for_closure.emit("refocus-editor", ());
                                                log::info!("Panel refocused after workspace change");
                                            }
                                        }
                                    });
                                }
                            }
                        }
                    }

                    last_workspace_id = Some(workspace_id);
                }
            }
        }
    });
}

tauri_panel! {
    panel!(WingmanPanel {
        config: {
            can_become_key_window: true,
            is_floating_panel: true,
        }
    })

    panel_event!(WingmanPanelEventHandler {
        window_did_become_key(notification: &NSNotification) -> (),
        window_did_resign_key(notification: &NSNotification) -> (),
    })
}

type TauriError = tauri::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error("Unable to convert window to panel")]
    Panel,
    #[error("Unable to find panel: {0}")]
    PanelNotFound(String),
    #[error("Monitor with cursor not found")]
    MonitorNotFound,
}

pub trait WebviewWindowExt<R: Runtime> {
    fn to_wingman_panel(&self) -> tauri::Result<PanelHandle<R>>;
    fn center_at_cursor_monitor(&self) -> tauri::Result<()>;
    fn update_panel_behavior(&self, sticky_mode: bool) -> tauri::Result<()>;
}

impl<R: Runtime> WebviewWindowExt<R> for WebviewWindow<R> {
    fn to_wingman_panel(&self) -> tauri::Result<PanelHandle<R>> {
        // Convert window to panel
        let panel = self
            .to_panel::<WingmanPanel<R>>()
            .map_err(|_| TauriError::Anyhow(Error::Panel.into()))?;

        // Set panel level to floating (appears above most windows)
        panel.set_level(PanelLevel::Floating.value());

        // Start with normal behavior (non-sticky mode)
        // Will be updated to sticky behavior if setting is enabled
        panel.set_collection_behavior(
            CollectionBehavior::new()
                // Makes panel appear alongside full screen apps
                .full_screen_auxiliary()
                // Move to active space when shown
                .move_to_active_space()
                // Transient - doesn't persist across spaces
                .transient()
                .value(),
        );

        // Ensures the panel cannot activate the App, but can still be resized
        panel.set_style_mask(StyleMask::empty().nonactivating_panel().resizable().into());

        // Setup event handler for panel events
        let handler = WingmanPanelEventHandler::new();

        let app_handle_for_key = self.app_handle().clone();
        handler.window_did_become_key(move |_| {
            log::info!("panel became key window");

            // When panel becomes key window in sticky mode, emit event to refocus editor
            // This handles workspace switches where the panel needs to regain input focus
            if let Ok(settings) = load_settings() {
                if settings.sticky_mode {
                    log::info!("Sticky mode active - emitting refocus event");
                    let _ = app_handle_for_key.emit("refocus-editor", ());
                }
            }
        });

        let app_handle = self.app_handle().clone();

        handler.window_did_resign_key(move |_| {
            log::info!("panel resigned key window");

            // Don't hide if a dialog is open (e.g., folder picker)
            if DIALOG_OPEN.load(Ordering::SeqCst) {
                log::info!("dialog is open, not hiding panel");
                return;
            }

            // Check if sticky mode is enabled
            if let Ok(settings) = load_settings() {
                if settings.sticky_mode {
                    log::info!("sticky mode enabled, not hiding panel");
                    return;
                }
            }

            // Hide panel when it loses focus (clicking outside, switching spaces, etc.)
            // Like Raycast behavior - dismiss and re-summon with hotkey
            if let Ok(panel) = app_handle.get_webview_panel(MAIN_WINDOW_LABEL) {
                if panel.is_visible() {
                    panel.hide();
                    // Notify frontend that panel was hidden so it can sync isVisible state
                    let _ = app_handle.emit("panel-hidden", ());
                }
            }
        });

        panel.set_event_handler(Some(handler.as_ref()));

        Ok(panel)
    }

    fn center_at_cursor_monitor(&self) -> tauri::Result<()> {
        let monitor = monitor::get_monitor_with_cursor()
            .ok_or(TauriError::Anyhow(Error::MonitorNotFound.into()))?;

        let monitor_scale_factor = monitor.scale_factor();
        let monitor_size = monitor.size().to_logical::<f64>(monitor_scale_factor);
        let monitor_position = monitor.position().to_logical::<f64>(monitor_scale_factor);

        let panel = self
            .get_webview_panel(self.label())
            .map_err(|_| TauriError::Anyhow(Error::PanelNotFound(self.label().into()).into()))?;

        let panel = panel.as_panel();
        let panel_frame = panel.frame();

        let rect = NSRect {
            origin: NSPoint {
                x: (monitor_position.x + (monitor_size.width / 2.0))
                    - (panel_frame.size.width / 2.0),
                y: (monitor_position.y + (monitor_size.height / 2.0))
                    - (panel_frame.size.height / 2.0),
            },
            size: panel_frame.size,
        };

        panel.setFrame_display(rect, true);

        Ok(())
    }

    fn update_panel_behavior(&self, sticky_mode: bool) -> tauri::Result<()> {
        let panel = self
            .get_webview_panel(self.label())
            .map_err(|_| TauriError::Anyhow(Error::PanelNotFound(self.label().into()).into()))?;

        if sticky_mode {
            // Sticky mode: panel appears on all workspaces and maintains focus
            panel.set_collection_behavior(
                CollectionBehavior::new()
                    .can_join_all_spaces()
                    .stationary()
                    .full_screen_auxiliary()
                    .value(),
            );
            log::info!("Panel behavior updated: sticky mode ON (appears on all workspaces)");
        } else {
            // Normal mode: panel hides when switching workspaces
            panel.set_collection_behavior(
                CollectionBehavior::new()
                    .transient()
                    .move_to_active_space()
                    .full_screen_auxiliary()
                    .value(),
            );
            log::info!("Panel behavior updated: sticky mode OFF (transient)");
        }

        Ok(())
    }
}
