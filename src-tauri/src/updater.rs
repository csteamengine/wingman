use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub current_version: String,
    pub latest_version: Option<String>,
    pub has_update: bool,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub downloaded: u64,
    pub total: Option<u64>,
    pub percent: Option<f64>,
}

fn get_current_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// Check for available updates using Tauri's built-in updater
pub async fn check_for_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    let current_version = get_current_version();

    // Check for updates using the Tauri plugin
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    // Update is available
                    Ok(UpdateInfo {
                        current_version: current_version.clone(),
                        latest_version: Some(update.version.clone()),
                        has_update: true,
                        release_notes: update.body.clone(),
                        download_url: Some(update.download_url.to_string()),
                    })
                }
                Ok(None) => {
                    // No update available
                    Ok(UpdateInfo {
                        current_version: current_version.clone(),
                        latest_version: Some(current_version),
                        has_update: false,
                        release_notes: None,
                        download_url: None,
                    })
                }
                Err(e) => {
                    // Error checking for updates
                    Err(format!("Failed to check for updates: {}", e))
                }
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

/// Download and install an update
pub async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    match app.updater() {
        Ok(updater) => {
            match updater.check().await {
                Ok(Some(update)) => {
                    // Emit download started event
                    app.emit("update-download-started", ()).ok();

                    // Download with progress tracking
                    let mut downloaded = 0u64;

                    match update
                        .download_and_install(
                            |chunk_length, content_length| {
                                downloaded += chunk_length as u64;

                                let percent = if let Some(total) = content_length {
                                    Some((downloaded as f64 / total as f64) * 100.0)
                                } else {
                                    None
                                };

                                // Emit progress event
                                let progress = DownloadProgress {
                                    downloaded,
                                    total: content_length,
                                    percent,
                                };

                                app.emit("update-download-progress", progress).ok();
                            },
                            || {
                                // Installation started
                                app.emit("update-install-started", ()).ok();
                            },
                        )
                        .await
                    {
                        Ok(_) => {
                            // Update installed successfully - app will restart
                            app.emit("update-installed", ()).ok();
                            Ok(())
                        }
                        Err(e) => {
                            let error_msg = format!("Failed to download/install update: {}", e);
                            app.emit("update-error", error_msg.clone()).ok();
                            Err(error_msg)
                        }
                    }
                }
                Ok(None) => Err("No update available".to_string()),
                Err(e) => Err(format!("Failed to check for updates: {}", e)),
            }
        }
        Err(e) => Err(format!("Updater not available: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_format() {
        let version = get_current_version();
        assert!(!version.is_empty());
        // Should be in semver format (x.y.z)
        let parts: Vec<&str> = version.split('.').collect();
        assert!(parts.len() >= 3);
    }
}
