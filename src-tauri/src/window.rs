use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, Manager, Runtime, WebviewWindow};
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelHandle, PanelLevel, StyleMask,
    WebviewWindowExt as WebviewPanelExt,
};
use thiserror::Error;
use crate::storage::{load_settings, get_position_for_monitor, save_position_for_monitor, WindowPosition};

pub const MAIN_WINDOW_LABEL: &str = "main";

/// Global flag to prevent panel from hiding during dialog operations
pub static DIALOG_OPEN: AtomicBool = AtomicBool::new(false);

/// Monitor workspace and monitor changes, move panel to follow cursor in sticky mode
pub fn start_workspace_monitor<R: Runtime>(app_handle: tauri::AppHandle<R>) {
    std::thread::spawn(move || {
        let mut last_workspace_id: Option<String> = None;
        let mut last_monitor_name: Option<String> = None;

        loop {
            std::thread::sleep(std::time::Duration::from_millis(200));

            // Check if sticky mode is enabled
            let sticky_mode = load_settings().map(|s| s.sticky_mode).unwrap_or(false);

            // Get current monitor with cursor
            if let Some(current_monitor) = monitor::get_monitor_with_cursor() {
                let current_monitor_name = current_monitor.name()
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                // Check if monitor changed (cursor moved to different display)
                if let Some(ref last_name) = last_monitor_name {
                    if last_name != &current_monitor_name && !current_monitor_name.is_empty() {
                        log::info!("Monitor changed from '{}' to '{}'", last_name, current_monitor_name);

                        if sticky_mode {
                            log::info!("Sticky mode active - moving panel to new monitor");

                            // Clone names for the closure
                            let old_monitor = last_name.clone();
                            let new_monitor = current_monitor_name.clone();

                            // Move panel to new monitor with animation
                            let app_for_thread = app_handle.clone();
                            let app_for_closure = app_for_thread.clone();
                            let _ = app_for_thread.run_on_main_thread(move || {
                                if let Ok(panel) = app_for_closure.get_webview_panel(MAIN_WINDOW_LABEL) {
                                    if panel.is_visible() {
                                        if let Some(window) = app_for_closure.get_webview_window(MAIN_WINDOW_LABEL) {
                                            // Save current position for the old monitor
                                            if let Err(e) = window.save_position_for_current_monitor(&old_monitor) {
                                                log::warn!("Failed to save position for {}: {:?}", old_monitor, e);
                                            }

                                            // Move to new monitor with animation, restoring saved position
                                            if let Err(e) = window.move_to_monitor_animated(&new_monitor) {
                                                log::warn!("Failed to move panel to {}: {:?}", new_monitor, e);
                                            } else {
                                                log::info!("Panel animated to monitor: {}", new_monitor);
                                            }
                                        }
                                        panel.make_key_window();
                                        let _ = app_for_closure.emit("refocus-editor", ());
                                    }
                                }
                            });
                        }
                    }
                }

                last_monitor_name = Some(current_monitor_name);
            }

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

                            if sticky_mode {
                                log::info!("Sticky mode active - refocusing panel");

                                // Refocus the panel on the main thread
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
    fn move_to_cursor_monitor(&self) -> tauri::Result<()>;
    fn move_to_monitor_animated(&self, monitor_name: &str) -> tauri::Result<()>;
    fn save_position_for_current_monitor(&self, monitor_name: &str) -> tauri::Result<()>;
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
                    // Save position before hiding
                    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
                        if let Some(monitor) = monitor::get_monitor_with_cursor() {
                            let monitor_name = monitor.name().map(|s| s.to_string()).unwrap_or_default();
                            if !monitor_name.is_empty() {
                                if let Err(e) = window.save_position_for_current_monitor(&monitor_name) {
                                    log::warn!("Failed to save position on hide: {:?}", e);
                                } else {
                                    log::info!("Saved position for {} before hiding", monitor_name);
                                }
                            }
                        }
                    }

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

    /// Move window to cursor's monitor, restoring saved position if available
    fn move_to_cursor_monitor(&self) -> tauri::Result<()> {
        let monitor = monitor::get_monitor_with_cursor()
            .ok_or(TauriError::Anyhow(Error::MonitorNotFound.into()))?;

        let monitor_name = monitor.name().map(|s| s.to_string()).unwrap_or_default();
        let monitor_scale_factor = monitor.scale_factor();
        let monitor_size = monitor.size().to_logical::<f64>(monitor_scale_factor);
        let monitor_position = monitor.position().to_logical::<f64>(monitor_scale_factor);

        log::info!(
            "move_to_cursor_monitor: monitor='{}', scale={}, size={}x{}, pos=({}, {})",
            monitor_name, monitor_scale_factor, monitor_size.width, monitor_size.height,
            monitor_position.x, monitor_position.y
        );

        let panel = self
            .get_webview_panel(self.label())
            .map_err(|_| TauriError::Anyhow(Error::PanelNotFound(self.label().into()).into()))?;

        let panel = panel.as_panel();
        let panel_frame = panel.frame();

        // Try to get saved position for this monitor (only if monitor name is valid)
        let rect = if !monitor_name.is_empty() {
            if let Some(saved_pos) = get_position_for_monitor(&monitor_name) {
                log::info!("Restoring saved position for monitor '{}': ({}, {}) {}x{}",
                    monitor_name, saved_pos.x, saved_pos.y, saved_pos.width, saved_pos.height);

                // Use saved position directly - trust that it was valid when saved
                NSRect {
                    origin: NSPoint {
                        x: saved_pos.x as f64,
                        y: saved_pos.y as f64,
                    },
                    size: NSSize {
                        width: saved_pos.width as f64,
                        height: saved_pos.height as f64,
                    },
                }
            } else {
                // Center on monitor if no saved position
                log::info!("No saved position for '{}', centering", monitor_name);
                NSRect {
                    origin: NSPoint {
                        x: (monitor_position.x + (monitor_size.width / 2.0))
                            - (panel_frame.size.width / 2.0),
                        y: (monitor_position.y + (monitor_size.height / 2.0))
                            - (panel_frame.size.height / 2.0),
                    },
                    size: panel_frame.size,
                }
            }
        } else {
            // Empty monitor name - just center
            log::warn!("Monitor name is empty, centering on detected monitor");
            NSRect {
                origin: NSPoint {
                    x: (monitor_position.x + (monitor_size.width / 2.0))
                        - (panel_frame.size.width / 2.0),
                    y: (monitor_position.y + (monitor_size.height / 2.0))
                        - (panel_frame.size.height / 2.0),
                },
                size: panel_frame.size,
            }
        };

        panel.setFrame_display(rect, true);
        log::info!("Panel positioned at ({}, {}) {}x{}",
            rect.origin.x, rect.origin.y, rect.size.width, rect.size.height);
        Ok(())
    }

    /// Move window to a specific monitor with animation, restoring saved position
    /// Note: This is called when cursor has already moved to the target monitor
    fn move_to_monitor_animated(&self, monitor_name: &str) -> tauri::Result<()> {
        use cocoa::base::id;
        use objc::{class, msg_send, sel, sel_impl};

        log::info!("move_to_monitor_animated: target monitor='{}'", monitor_name);

        // Get the monitor where cursor currently is (should be the target)
        let target_monitor = monitor::get_monitor_with_cursor()
            .ok_or(TauriError::Anyhow(Error::MonitorNotFound.into()))?;

        let monitor_scale_factor = target_monitor.scale_factor();
        let monitor_size = target_monitor.size().to_logical::<f64>(monitor_scale_factor);
        let monitor_position = target_monitor.position().to_logical::<f64>(monitor_scale_factor);

        log::info!(
            "Target monitor: size={}x{}, pos=({}, {})",
            monitor_size.width, monitor_size.height, monitor_position.x, monitor_position.y
        );

        let panel = self
            .get_webview_panel(self.label())
            .map_err(|_| TauriError::Anyhow(Error::PanelNotFound(self.label().into()).into()))?;

        let ns_panel = panel.as_panel();
        let panel_frame = ns_panel.frame();

        // Try to get saved position for target monitor
        let target_rect = if !monitor_name.is_empty() {
            if let Some(saved_pos) = get_position_for_monitor(monitor_name) {
                log::info!("Restoring saved position for '{}': ({}, {}) {}x{}",
                    monitor_name, saved_pos.x, saved_pos.y, saved_pos.width, saved_pos.height);
                NSRect {
                    origin: NSPoint {
                        x: saved_pos.x as f64,
                        y: saved_pos.y as f64,
                    },
                    size: NSSize {
                        width: saved_pos.width as f64,
                        height: saved_pos.height as f64,
                    },
                }
            } else {
                // Center on monitor if no saved position
                log::info!("No saved position for '{}', centering", monitor_name);
                NSRect {
                    origin: NSPoint {
                        x: (monitor_position.x + (monitor_size.width / 2.0))
                            - (panel_frame.size.width / 2.0),
                        y: (monitor_position.y + (monitor_size.height / 2.0))
                            - (panel_frame.size.height / 2.0),
                    },
                    size: panel_frame.size,
                }
            }
        } else {
            log::warn!("Empty monitor name, centering on current monitor");
            NSRect {
                origin: NSPoint {
                    x: (monitor_position.x + (monitor_size.width / 2.0))
                        - (panel_frame.size.width / 2.0),
                    y: (monitor_position.y + (monitor_size.height / 2.0))
                        - (panel_frame.size.height / 2.0),
                },
                size: panel_frame.size,
            }
        };

        log::info!("Animating panel to ({}, {}) {}x{}",
            target_rect.origin.x, target_rect.origin.y, target_rect.size.width, target_rect.size.height);

        // Animate the frame change using NSWindow's animator
        unsafe {
            // Get the raw NSPanel pointer
            let raw_panel: id = std::mem::transmute_copy(&ns_panel);

            // Use NSAnimationContext for smooth animation
            let _: () = msg_send![class!(NSAnimationContext), beginGrouping];
            let context: id = msg_send![class!(NSAnimationContext), currentContext];
            let _: () = msg_send![context, setDuration: 0.2_f64];

            // Get animator proxy and set frame
            let animator: id = msg_send![raw_panel, animator];
            let _: () = msg_send![animator, setFrame: target_rect display: true];

            let _: () = msg_send![class!(NSAnimationContext), endGrouping];
        }

        Ok(())
    }

    /// Save the current window position for a specific monitor
    fn save_position_for_current_monitor(&self, monitor_name: &str) -> tauri::Result<()> {
        let panel = self
            .get_webview_panel(self.label())
            .map_err(|_| TauriError::Anyhow(Error::PanelNotFound(self.label().into()).into()))?;

        let panel = panel.as_panel();
        let frame = panel.frame();

        let position = WindowPosition {
            x: frame.origin.x as i32,
            y: frame.origin.y as i32,
            width: frame.size.width as u32,
            height: frame.size.height as u32,
        };

        save_position_for_monitor(monitor_name, position)
            .map_err(|e| TauriError::Anyhow(e.into()))?;

        log::info!("Saved position for monitor {}: ({}, {}) {}x{}",
            monitor_name, frame.origin.x, frame.origin.y, frame.size.width, frame.size.height);

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

/// Get the name of the monitor where the cursor is located
pub fn get_cursor_monitor_name() -> Option<String> {
    monitor::get_monitor_with_cursor()
        .and_then(|m| m.name().map(|s| s.to_string()))
}

/// Apply native macOS vibrancy effect using NSVisualEffectView
/// This is the same blur effect used by Spotlight, Finder sidebars, etc.
/// Works during screen recording and is more stable than CSS backdrop-filter
/// NOTE: This must be called from the main thread!
#[cfg(target_os = "macos")]
pub fn set_window_blur(window: &WebviewWindow<impl Runtime>, enabled: bool) -> Result<(), String> {
    use cocoa::appkit::{NSColor, NSWindow as NSWindowTrait};
    use cocoa::base::{id, nil, NO, YES};
    use cocoa::foundation::NSRect;
    use objc::{class, msg_send, sel, sel_impl};

    if !enabled {
        log::info!("Vibrancy disable requested (not implemented)");
        return Ok(());
    }

    let ns_window = match window.ns_window() {
        Ok(w) => w as id,
        Err(e) => {
            log::error!("Failed to get ns_window: {}", e);
            return Err(e.to_string());
        }
    };

    if ns_window.is_null() {
        log::error!("ns_window is null");
        return Err("ns_window is null".to_string());
    }

    unsafe {
        // Make window transparent
        let _: () = msg_send![ns_window, setOpaque: NO];
        ns_window.setBackgroundColor_(NSColor::clearColor(nil));

        // Set window to have no title bar (should already be set via decorations: false)
        // But ensure it's transparent if present
        let _: () = msg_send![ns_window, setTitlebarAppearsTransparent: YES];

        let content_view: id = ns_window.contentView();

        // Enable layer backing on content view for proper corner clipping
        let _: () = msg_send![content_view, setWantsLayer: YES];
        let content_layer: id = msg_send![content_view, layer];
        if !content_layer.is_null() {
            let _: () = msg_send![content_layer, setCornerRadius: 10.0_f64];
            let _: () = msg_send![content_layer, setMasksToBounds: YES];
        }
        if content_view.is_null() {
            log::error!("content_view is null");
            return Err("content_view is null".to_string());
        }

        // Get the bounds of the content view
        let bounds: NSRect = msg_send![content_view, bounds];

        // Create NSVisualEffectView
        let visual_effect_class = class!(NSVisualEffectView);
        let visual_effect_view: id = msg_send![visual_effect_class, alloc];
        let visual_effect_view: id = msg_send![visual_effect_view, initWithFrame: bounds];

        if visual_effect_view.is_null() {
            log::error!("Failed to create NSVisualEffectView");
            return Err("Failed to create NSVisualEffectView".to_string());
        }

        // Set material for dark vibrancy like Raycast
        // NSVisualEffectMaterialDark = 8 (gives darker appearance)
        // NSVisualEffectMaterialUltraDark = 9 (even darker, deprecated but works)
        let _: () = msg_send![visual_effect_view, setMaterial: 9_i64];

        // Set state - NSVisualEffectStateActive = 1 (always active)
        let _: () = msg_send![visual_effect_view, setState: 1_i64];

        // Set blending mode - NSVisualEffectBlendingModeBehindWindow = 0
        let _: () = msg_send![visual_effect_view, setBlendingMode: 0_i64];

        // Make it resize with the window
        // NSViewWidthSizable = 2, NSViewHeightSizable = 16
        let autoresizing: u64 = 2 | 16;
        let _: () = msg_send![visual_effect_view, setAutoresizingMask: autoresizing];

        // Enable layer backing and set corner radius
        let _: () = msg_send![visual_effect_view, setWantsLayer: YES];
        let layer: id = msg_send![visual_effect_view, layer];
        if !layer.is_null() {
            let _: () = msg_send![layer, setCornerRadius: 10.0_f64];
            let _: () = msg_send![layer, setMasksToBounds: YES];
        }

        // Insert the visual effect view at the back (behind webview)
        // NSWindowBelow = -1, NSWindowAbove = 1
        let _: () = msg_send![content_view, addSubview: visual_effect_view positioned: -1_i64 relativeTo: nil];

        // Make webview transparent so vibrancy shows through
        let subviews: id = msg_send![content_view, subviews];
        if !subviews.is_null() {
            let count: usize = msg_send![subviews, count];
            for i in 0..count {
                let subview: id = msg_send![subviews, objectAtIndex: i];
                if subview.is_null() || subview == visual_effect_view {
                    continue;
                }
                // Try to make webview transparent
                let responds: bool = msg_send![subview, respondsToSelector: sel!(setDrawsBackground:)];
                if responds {
                    let _: () = msg_send![subview, setDrawsBackground: NO];
                }
                // Also try setValue:forKey for WKWebView
                let responds2: bool = msg_send![subview, respondsToSelector: sel!(setValue:forKey:)];
                if responds2 {
                    let key: id = msg_send![class!(NSString), stringWithUTF8String: b"drawsBackground\0".as_ptr()];
                    let no_value: id = msg_send![class!(NSNumber), numberWithBool: NO];
                    let _: () = msg_send![subview, setValue: no_value forKey: key];
                }
            }
        }

        log::info!("Native macOS vibrancy applied (HUDWindow material with transparent webview)");
    }

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn set_window_blur(_window: &WebviewWindow<impl Runtime>, _enabled: bool) -> Result<(), String> {
    // Blur effect is only available on macOS
    Ok(())
}

/// Update the vibrancy material for light/dark theme switching
/// This finds the existing NSVisualEffectView and updates its material
#[cfg(target_os = "macos")]
pub fn update_vibrancy_material(window: &WebviewWindow<impl Runtime>, is_dark: bool) -> Result<(), String> {
    use cocoa::appkit::NSWindow as NSWindowTrait;
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};

    let ns_window = match window.ns_window() {
        Ok(w) => w as id,
        Err(e) => {
            log::error!("Failed to get ns_window: {}", e);
            return Err(e.to_string());
        }
    };

    if ns_window.is_null() {
        return Err("ns_window is null".to_string());
    }

    unsafe {
        let content_view: id = ns_window.contentView();
        if content_view.is_null() {
            return Err("content_view is null".to_string());
        }

        // Find the NSVisualEffectView in subviews
        let subviews: id = msg_send![content_view, subviews];
        if subviews.is_null() {
            return Err("subviews is null".to_string());
        }

        let count: usize = msg_send![subviews, count];
        let visual_effect_class = class!(NSVisualEffectView);

        for i in 0..count {
            let subview: id = msg_send![subviews, objectAtIndex: i];
            if subview.is_null() {
                continue;
            }

            // Check if this is an NSVisualEffectView
            let is_visual_effect: bool = msg_send![subview, isKindOfClass: visual_effect_class];
            if is_visual_effect {
                // Update the material based on theme
                // Dark themes: NSVisualEffectMaterialUltraDark = 9
                // Light themes: NSVisualEffectMaterialLight = 1
                let material: i64 = if is_dark { 9 } else { 1 };
                let _: () = msg_send![subview, setMaterial: material];

                log::info!("Updated vibrancy material to {} (is_dark={})", material, is_dark);
                return Ok(());
            }
        }

        log::warn!("NSVisualEffectView not found in subviews");
        Err("NSVisualEffectView not found".to_string())
    }
}

#[cfg(not(target_os = "macos"))]
pub fn update_vibrancy_material(_window: &WebviewWindow<impl Runtime>, _is_dark: bool) -> Result<(), String> {
    // Vibrancy is only available on macOS
    Ok(())
}
