// Native clipboard implementation for macOS using NSPasteboard
// This allows writing multiple types (text + images) to the clipboard simultaneously

#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::base::{id, nil};
#[cfg(target_os = "macos")]
#[allow(deprecated)]
use cocoa::foundation::{NSArray, NSString};
#[cfg(target_os = "macos")]
use objc::{class, msg_send, sel, sel_impl};

use std::fs;
use std::path::PathBuf;

/// Represents an image to be written to the clipboard
#[derive(Debug, Clone, serde::Deserialize)]
pub struct ClipboardImage {
    /// Base64-encoded image data (without the data URL prefix)
    pub data: String,
    /// MIME type of the image (e.g., "image/png", "image/jpeg")
    pub mime_type: String,
    /// Original filename
    pub name: String,
}

/// Get the temp directory for clipboard files
fn get_clipboard_temp_dir() -> Result<PathBuf, String> {
    let temp_dir = std::env::temp_dir().join("wingman_clipboard");
    if !temp_dir.exists() {
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    }
    Ok(temp_dir)
}

/// Clean up old temp files (files older than 1 hour)
fn cleanup_old_temp_files(temp_dir: &PathBuf) {
    if let Ok(entries) = fs::read_dir(temp_dir) {
        let one_hour_ago = std::time::SystemTime::now()
            .checked_sub(std::time::Duration::from_secs(3600))
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);

        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if let Ok(modified) = metadata.modified() {
                    if modified < one_hour_ago {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
}

/// Get file extension from MIME type
fn extension_from_mime(mime_type: &str) -> &str {
    match mime_type {
        "image/png" => "png",
        "image/jpeg" | "image/jpg" => "jpg",
        "image/gif" => "gif",
        "image/tiff" => "tiff",
        "image/bmp" => "bmp",
        "image/webp" => "webp",
        "text/plain" => "txt",
        "text/html" => "html",
        "text/css" => "css",
        "text/javascript" | "application/javascript" => "js",
        "application/json" => "json",
        "application/xml" | "text/xml" => "xml",
        "application/pdf" => "pdf",
        _ => "bin",
    }
}

/// Write text and optional images to the macOS clipboard using NSPasteboard
/// This writes multiple pasteboard types so different apps can read what they support:
/// - NSFilenamesPboardType: File paths for Finder-style paste
/// - public.utf8-plain-text: Plain text for all apps (only if text is non-empty)
/// - public.html: HTML with embedded images for rich text apps
/// - public.png/public.tiff: Raw image data for image-aware apps
#[cfg(target_os = "macos")]
#[allow(deprecated)]
pub fn write_to_clipboard(
    text: &str,
    html: Option<&str>,
    images: &[ClipboardImage],
) -> Result<(), String> {
    use base64::Engine;

    // Get temp directory and clean up old files
    let temp_dir = get_clipboard_temp_dir()?;
    cleanup_old_temp_files(&temp_dir);

    // Save images to temp files and collect paths
    let mut file_paths: Vec<String> = Vec::new();
    for image in images {
        // Decode base64 image data
        let image_bytes = base64::engine::general_purpose::STANDARD
            .decode(&image.data)
            .map_err(|e| format!("Failed to decode base64 image: {}", e))?;

        // Use original filename or generate one
        let filename = if image.name.is_empty() {
            let ext = extension_from_mime(&image.mime_type);
            format!("clipboard_{}.{}", chrono::Utc::now().timestamp_millis(), ext)
        } else {
            image.name.clone()
        };

        let file_path = temp_dir.join(&filename);
        fs::write(&file_path, &image_bytes)
            .map_err(|e| format!("Failed to write temp file: {}", e))?;

        file_paths.push(file_path.to_string_lossy().to_string());
    }

    unsafe {
        // Get the general pasteboard
        let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];

        // Clear existing contents
        let _: i64 = msg_send![pasteboard, clearContents];

        // Determine which types we'll write
        let has_text = !text.is_empty();
        let has_html = html.is_some() && !html.unwrap().is_empty();
        let has_files = !file_paths.is_empty();

        // Get the first image's UTI type if we have images
        let image_uti = if !images.is_empty() {
            match images[0].mime_type.as_str() {
                "image/png" => Some("public.png"),
                "image/jpeg" | "image/jpg" => Some("public.jpeg"),
                "image/gif" => Some("com.compuserve.gif"),
                "image/tiff" => Some("public.tiff"),
                "image/bmp" => Some("com.microsoft.bmp"),
                "image/webp" => Some("public.webp"),
                _ => Some("public.png"), // Default to PNG
            }
        } else {
            None
        };

        // Build the list of types to declare
        // Order matters - put file URLs first so apps prefer them
        let mut all_types: Vec<id> = Vec::new();

        // Add file URL type first (like Finder does)
        if has_files {
            // NSFilenamesPboardType for file paths
            all_types.push(NSString::alloc(nil).init_str("NSFilenamesPboardType"));
            // Also add public.file-url for modern apps
            all_types.push(NSString::alloc(nil).init_str("public.file-url"));
        }

        // Add image types
        if let Some(uti) = image_uti {
            all_types.push(NSString::alloc(nil).init_str(uti));
            all_types.push(NSString::alloc(nil).init_str("public.tiff"));
        }
        if has_html {
            all_types.push(NSString::alloc(nil).init_str("public.html"));
        }
        if has_text {
            all_types.push(NSString::alloc(nil).init_str("public.utf8-plain-text"));
        }

        // If nothing to write, return early
        if all_types.is_empty() {
            return Ok(());
        }

        // Declare all types at once
        let all_types_array = NSArray::arrayWithObjects(nil, &all_types);
        let _: id = msg_send![pasteboard, declareTypes:all_types_array owner:nil];

        // Write file paths if present (like Finder does)
        if has_files {
            // Create NSArray of file paths
            let ns_paths: Vec<id> = file_paths
                .iter()
                .map(|p| NSString::alloc(nil).init_str(p))
                .collect();
            let paths_array = NSArray::arrayWithObjects(nil, &ns_paths);

            // Write as NSFilenamesPboardType (property list of file paths)
            let filenames_type = NSString::alloc(nil).init_str("NSFilenamesPboardType");
            let _: bool = msg_send![pasteboard, setPropertyList:paths_array forType:filenames_type];

            // Also write first file as public.file-url
            if !file_paths.is_empty() {
                let file_url = format!("file://{}", file_paths[0]);
                let url_type = NSString::alloc(nil).init_str("public.file-url");
                let ns_url = NSString::alloc(nil).init_str(&file_url);
                let _: bool = msg_send![pasteboard, setString:ns_url forType:url_type];
            }
        }

        // Write plain text if present
        if has_text {
            let text_type = NSString::alloc(nil).init_str("public.utf8-plain-text");
            let ns_text = NSString::alloc(nil).init_str(text);
            let _: bool = msg_send![pasteboard, setString:ns_text forType:text_type];
        }

        // Write HTML if present
        if has_html {
            let html_type = NSString::alloc(nil).init_str("public.html");
            let ns_html = NSString::alloc(nil).init_str(html.unwrap());
            let _: bool = msg_send![pasteboard, setString:ns_html forType:html_type];
        }

        // Write the first image data if present (for apps that prefer raw image data)
        if !images.is_empty() {
            let image = &images[0];

            // Decode base64 image data
            let image_bytes = base64::engine::general_purpose::STANDARD
                .decode(&image.data)
                .map_err(|e| format!("Failed to decode base64 image: {}", e))?;

            // Create NSData from image bytes
            let ns_data: id = msg_send![class!(NSData), dataWithBytes:image_bytes.as_ptr() length:image_bytes.len()];

            // Write image data for the original format
            if let Some(uti) = image_uti {
                let type_str = NSString::alloc(nil).init_str(uti);
                let _: bool = msg_send![pasteboard, setData:ns_data forType:type_str];
            }

            // Also write as TIFF (many macOS apps prefer this)
            let ns_image: id = msg_send![class!(NSImage), alloc];
            let ns_image: id = msg_send![ns_image, initWithData:ns_data];
            if ns_image != nil {
                let tiff_data: id = msg_send![ns_image, TIFFRepresentation];
                if tiff_data != nil {
                    let tiff_type = NSString::alloc(nil).init_str("public.tiff");
                    let _: bool = msg_send![pasteboard, setData:tiff_data forType:tiff_type];
                }
            }
        }

        Ok(())
    }
}

#[cfg(not(target_os = "macos"))]
pub fn write_to_clipboard(
    _text: &str,
    _html: Option<&str>,
    _images: &[ClipboardImage],
) -> Result<(), String> {
    Err("Native clipboard only supported on macOS".to_string())
}

/// Get file extension from language identifier
fn extension_from_language(language: &str) -> &str {
    match language {
        "javascript" => "js",
        "typescript" => "ts",
        "jsx" | "react" => "jsx",
        "tsx" => "tsx",
        "python" => "py",
        "rust" => "rs",
        "go" => "go",
        "java" => "java",
        "kotlin" => "kt",
        "swift" => "swift",
        "csharp" => "cs",
        "cpp" => "cpp",
        "c" => "c",
        "ruby" => "rb",
        "php" => "php",
        "html" => "html",
        "css" => "css",
        "json" => "json",
        "xml" => "xml",
        "yaml" => "yaml",
        "sql" => "sql",
        "bash" => "sh",
        "markdown" => "md",
        _ => "txt",
    }
}

/// Copy content as a file to the system clipboard
/// Creates a temp file with the appropriate extension and copies it as a file reference
#[cfg(target_os = "macos")]
#[allow(deprecated)]
pub fn copy_file_to_clipboard(content: &str, language: &str) -> Result<String, String> {
    let temp_dir = get_clipboard_temp_dir()?;
    cleanup_old_temp_files(&temp_dir);

    let ext = extension_from_language(language);
    let filename = format!("wingman_{}.{}", chrono::Utc::now().timestamp_millis(), ext);
    let file_path = temp_dir.join(&filename);

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let file_path_str = file_path.to_string_lossy().to_string();

    unsafe {
        let pasteboard: id = msg_send![class!(NSPasteboard), generalPasteboard];
        let _: i64 = msg_send![pasteboard, clearContents];

        // Declare types
        let filenames_type = NSString::alloc(nil).init_str("NSFilenamesPboardType");
        let file_url_type = NSString::alloc(nil).init_str("public.file-url");
        let types_array = NSArray::arrayWithObjects(nil, &[filenames_type, file_url_type]);
        let _: id = msg_send![pasteboard, declareTypes:types_array owner:nil];

        // Write file paths
        let ns_path = NSString::alloc(nil).init_str(&file_path_str);
        let paths_array = NSArray::arrayWithObjects(nil, &[ns_path]);
        let filenames_type2 = NSString::alloc(nil).init_str("NSFilenamesPboardType");
        let _: bool = msg_send![pasteboard, setPropertyList:paths_array forType:filenames_type2];

        // Write file URL
        let file_url = format!("file://{}", file_path_str);
        let url_type2 = NSString::alloc(nil).init_str("public.file-url");
        let ns_url = NSString::alloc(nil).init_str(&file_url);
        let _: bool = msg_send![pasteboard, setString:ns_url forType:url_type2];
    }

    Ok(file_path_str)
}

#[cfg(target_os = "linux")]
pub fn copy_file_to_clipboard(content: &str, language: &str) -> Result<String, String> {
    let temp_dir = get_clipboard_temp_dir()?;
    cleanup_old_temp_files(&temp_dir);

    let ext = extension_from_language(language);
    let filename = format!("wingman_{}.{}", chrono::Utc::now().timestamp_millis(), ext);
    let file_path = temp_dir.join(&filename);

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let file_path_str = file_path.to_string_lossy().to_string();
    let uri = format!("file://{}\n", file_path_str);

    // Try xclip with text/uri-list
    let result = std::process::Command::new("xclip")
        .args(["-selection", "clipboard", "-t", "text/uri-list"])
        .stdin(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(stdin) = child.stdin.as_mut() {
                stdin.write_all(uri.as_bytes())?;
            }
            child.wait()
        });

    match result {
        Ok(status) if status.success() => Ok(file_path_str),
        _ => {
            // Fallback: copy file path as text
            let _ = std::process::Command::new("xclip")
                .args(["-selection", "clipboard"])
                .stdin(std::process::Stdio::piped())
                .spawn()
                .and_then(|mut child| {
                    use std::io::Write;
                    if let Some(stdin) = child.stdin.as_mut() {
                        stdin.write_all(file_path_str.as_bytes())?;
                    }
                    child.wait()
                });
            Ok(file_path_str)
        }
    }
}

#[cfg(target_os = "windows")]
pub fn copy_file_to_clipboard(content: &str, language: &str) -> Result<String, String> {
    let temp_dir = get_clipboard_temp_dir()?;
    cleanup_old_temp_files(&temp_dir);

    let ext = extension_from_language(language);
    let filename = format!("wingman_{}.{}", chrono::Utc::now().timestamp_millis(), ext);
    let file_path = temp_dir.join(&filename);

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write temp file: {}", e))?;

    let file_path_str = file_path.to_string_lossy().to_string();

    // Use PowerShell to set the clipboard to a file drop list
    let ps_script = format!(
        r#"$files = [System.Collections.Specialized.StringCollection]::new(); $files.Add('{}'); [System.Windows.Forms.Clipboard]::SetFileDropList($files)"#,
        file_path_str.replace("'", "''")
    );

    let result = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &format!("Add-Type -AssemblyName System.Windows.Forms; {}", ps_script)])
        .output();

    match result {
        Ok(output) if output.status.success() => Ok(file_path_str),
        Ok(output) => Err(format!("PowerShell error: {}", String::from_utf8_lossy(&output.stderr))),
        Err(e) => Err(format!("Failed to run PowerShell: {}", e)),
    }
}
