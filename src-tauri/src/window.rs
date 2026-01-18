use tauri::{Emitter, Manager, Runtime, WebviewWindow};
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelHandle, PanelLevel, StyleMask,
    WebviewWindowExt as WebviewPanelExt,
};
use thiserror::Error;

pub const MAIN_WINDOW_LABEL: &str = "main";

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
}

impl<R: Runtime> WebviewWindowExt<R> for WebviewWindow<R> {
    fn to_wingman_panel(&self) -> tauri::Result<PanelHandle<R>> {
        // Convert window to panel
        let panel = self
            .to_panel::<WingmanPanel<R>>()
            .map_err(|_| TauriError::Anyhow(Error::Panel.into()))?;

        // Set panel level to floating (appears above most windows)
        panel.set_level(PanelLevel::Floating.value());

        panel.set_collection_behavior(
            CollectionBehavior::new()
                // Makes panel appear alongside full screen apps
                .full_screen_auxiliary()
                // Panel moves to active space when shown (like Raycast/Spotlight)
                .move_to_active_space()
                // Transient - doesn't persist when switching spaces
                .transient()
                .value(),
        );

        // Ensures the panel cannot activate the App, but can still be resized
        panel.set_style_mask(StyleMask::empty().nonactivating_panel().resizable().into());

        // Setup event handler for panel events
        let handler = WingmanPanelEventHandler::new();

        handler.window_did_become_key(|_| {
            log::info!("panel became key window");
        });

        let app_handle = self.app_handle().clone();

        handler.window_did_resign_key(move |_| {
            log::info!("panel resigned key window");
            // TEMPORARILY DISABLED: Auto-hide on focus loss
            // This allows drag-and-drop of images from Finder
            // Users can close with Escape or hotkey instead
            // TODO: Re-evaluate this behavior after testing image drag-and-drop
            let _ = &app_handle; // Keep reference to avoid unused warning
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
}
