mod clipboard;
mod history;
mod hotkey;
mod license;
mod native_clipboard;
mod premium;
mod storage;
mod updater;
#[cfg(target_os = "macos")]
mod window;

use rusqlite::Connection;
use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, State,
};
#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;
#[cfg(target_os = "macos")]
use window::{start_workspace_monitor, set_window_blur, update_vibrancy_material, get_cursor_monitor_name, WebviewWindowExt, MAIN_WINDOW_LABEL};

use clipboard::{calculate_text_stats, transform_text, TextStats, TextTransform};
use history::{
    add_entry, cleanup_old_entries, clear_history, delete_entry, export_history, get_entries,
    get_stats, init_database, search_entries, HistoryEntry, HistoryStats,
};
use hotkey::{get_default_hotkey, validate_hotkey};
use license::{
    check_license_status, is_feature_enabled, load_license_cache, refresh_license,
    validate_license_online, deactivate_license_online, clear_license_cache,
    LicenseStatusInfo, ProFeature,
};
use premium::{
    validate_premium_license, get_ai_usage, call_ai_feature,
    load_obsidian_config, save_obsidian_config, add_to_obsidian_vault, validate_obsidian_vault,
    load_ai_config, save_ai_config, load_ai_presets, save_ai_presets,
    SubscriptionStatus, UsageStats, AIResponse, ObsidianConfig, ObsidianResult, AIConfig, AIPresetsConfig,
};
use storage::{
    load_settings, load_snippets, save_settings, save_snippets, AppSettings, Snippet, SnippetsData,
};
use updater::{check_for_updates, UpdateInfo};

pub struct AppState {
    db: Mutex<Connection>,
    #[cfg(target_os = "macos")]
    previous_app: Mutex<Option<(String, std::time::Instant)>>,
    /// Track if window has been shown/positioned this session (don't re-center after first show)
    pub has_been_shown: std::sync::atomic::AtomicBool,
}

// Settings commands
#[tauri::command]
fn get_settings() -> Result<AppSettings, String> {
    load_settings().map_err(|e| e.to_string())
}

#[tauri::command]
fn update_settings(settings: AppSettings) -> Result<(), String> {
    save_settings(&settings).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_default_hotkey_cmd() -> String {
    get_default_hotkey()
}

#[tauri::command]
fn validate_hotkey_cmd(shortcut: String) -> bool {
    validate_hotkey(&shortcut)
}

// History commands
#[tauri::command]
fn add_history_entry(
    state: State<AppState>,
    content: String,
    language: Option<String>,
    tags: Option<String>,
    images: Option<String>,
) -> Result<i64, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    add_entry(&conn, &content, language.as_deref(), tags.as_deref(), images.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_history(state: State<AppState>, limit: u32, offset: u32) -> Result<Vec<HistoryEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_entries(&conn, limit, offset).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_history(state: State<AppState>, query: String, limit: u32) -> Result<Vec<HistoryEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    search_entries(&conn, &query, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_history_entry(state: State<AppState>, id: i64) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    delete_entry(&conn, id).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_all_history(state: State<AppState>) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    clear_history(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_history_stats(state: State<AppState>) -> Result<HistoryStats, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    get_stats(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn cleanup_history(state: State<AppState>, max_entries: u32) -> Result<u32, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    cleanup_old_entries(&conn, max_entries).map_err(|e| e.to_string())
}

#[tauri::command]
fn export_all_history(state: State<AppState>) -> Result<Vec<HistoryEntry>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    export_history(&conn).map_err(|e| e.to_string())
}

// Snippets commands
#[tauri::command]
fn get_snippets() -> Result<SnippetsData, String> {
    load_snippets().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_snippets_data(data: SnippetsData) -> Result<(), String> {
    save_snippets(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_snippet(
    name: String,
    content: String,
    tags: Vec<String>,
) -> Result<Snippet, String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let snippet = Snippet {
        id: uuid_v4(),
        name,
        content,
        tags,
        created_at: now.clone(),
        updated_at: now,
    };
    data.snippets.push(snippet.clone());
    save_snippets(&data).map_err(|e| e.to_string())?;
    Ok(snippet)
}

#[tauri::command]
fn update_snippet(
    id: String,
    name: String,
    content: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    if let Some(snippet) = data.snippets.iter_mut().find(|s| s.id == id) {
        snippet.name = name;
        snippet.content = content;
        snippet.tags = tags;
        snippet.updated_at = chrono::Utc::now().to_rfc3339();
    }
    save_snippets(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_snippet(id: String) -> Result<(), String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    data.snippets.retain(|s| s.id != id);
    save_snippets(&data).map_err(|e| e.to_string())
}

// Text utility commands
#[tauri::command]
fn get_text_stats(text: String) -> TextStats {
    calculate_text_stats(&text)
}

#[tauri::command]
fn transform_text_cmd(text: String, transform: String) -> Result<String, String> {
    let transform_type = match transform.as_str() {
        "uppercase" => TextTransform::Uppercase,
        "lowercase" => TextTransform::Lowercase,
        "titlecase" => TextTransform::TitleCase,
        "sentencecase" => TextTransform::SentenceCase,
        "trim" => TextTransform::TrimWhitespace,
        "sort" => TextTransform::SortLines,
        "deduplicate" => TextTransform::RemoveDuplicateLines,
        "reverse" => TextTransform::ReverseLines,
        "bulletlist" => TextTransform::BulletList,
        _ => return Err(format!("Unknown transform: {}", transform)),
    };
    Ok(transform_text(&text, transform_type))
}

#[tauri::command]
fn count_pattern_occurrences(text: String, pattern: String) -> usize {
    clipboard::count_occurrences(&text, &pattern)
}

/// Write text and images to the native clipboard using NSPasteboard
/// This allows both text and images to be read by different apps
#[tauri::command]
fn write_native_clipboard(
    text: String,
    html: Option<String>,
    images: Vec<native_clipboard::ClipboardImage>,
) -> Result<(), String> {
    native_clipboard::write_to_clipboard(&text, html.as_deref(), &images)
}

// JSON/XML formatting commands
#[tauri::command]
fn format_json(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::JsonXmlFormatting) {
        return Err("This feature requires a Pro license".to_string());
    }
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    serde_json::to_string_pretty(&parsed)
        .map_err(|e| format!("Failed to format JSON: {}", e))
}

#[tauri::command]
fn minify_json(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::JsonXmlFormatting) {
        return Err("This feature requires a Pro license".to_string());
    }
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("Invalid JSON: {}", e))?;
    serde_json::to_string(&parsed)
        .map_err(|e| format!("Failed to minify JSON: {}", e))
}

#[tauri::command]
fn format_xml(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::JsonXmlFormatting) {
        return Err("This feature requires a Pro license".to_string());
    }
    // Simple XML formatter - add indentation
    let mut result = String::new();
    let mut indent = 0;
    let mut tag_content = String::new();

    for ch in text.chars() {
        match ch {
            '<' => {
                if !tag_content.trim().is_empty() {
                    result.push_str(&"  ".repeat(indent));
                    result.push_str(tag_content.trim());
                    result.push('\n');
                }
                tag_content.clear();
                tag_content.push(ch);
            }
            '>' => {
                tag_content.push(ch);

                let is_closing_tag = tag_content.starts_with("</");
                let is_self_closing = tag_content.ends_with("/>") || tag_content.starts_with("<?") || tag_content.starts_with("<!");

                if is_closing_tag && indent > 0 {
                    indent -= 1;
                }

                result.push_str(&"  ".repeat(indent));
                result.push_str(&tag_content);
                result.push('\n');

                if !is_closing_tag && !is_self_closing {
                    indent += 1;
                }

                tag_content.clear();
            }
            _ => {
                tag_content.push(ch);
            }
        }
    }

    // Handle any remaining content
    if !tag_content.trim().is_empty() {
        result.push_str(tag_content.trim());
    }

    Ok(result.trim().to_string())
}

// Encoding/decoding commands
#[tauri::command]
fn encode_base64(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::EncodeDecode) {
        return Err("This feature requires a Pro license".to_string());
    }
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    Ok(STANDARD.encode(text.as_bytes()))
}

#[tauri::command]
fn decode_base64(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::EncodeDecode) {
        return Err("This feature requires a Pro license".to_string());
    }
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    let bytes = STANDARD.decode(text.trim())
        .map_err(|e| format!("Invalid Base64: {}", e))?;
    String::from_utf8(bytes)
        .map_err(|e| format!("Invalid UTF-8 in decoded data: {}", e))
}

#[tauri::command]
fn encode_url(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::EncodeDecode) {
        return Err("This feature requires a Pro license".to_string());
    }
    Ok(urlencoding::encode(&text).into_owned())
}

#[tauri::command]
fn decode_url(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::EncodeDecode) {
        return Err("This feature requires a Pro license".to_string());
    }
    urlencoding::decode(&text)
        .map(|s| s.into_owned())
        .map_err(|e| format!("Invalid URL encoding: {}", e))
}

#[tauri::command]
fn encode_html(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::EncodeDecode) {
        return Err("This feature requires a Pro license".to_string());
    }
    Ok(text.chars()
        .map(|c| match c {
            '&' => "&amp;".to_string(),
            '<' => "&lt;".to_string(),
            '>' => "&gt;".to_string(),
            '"' => "&quot;".to_string(),
            '\'' => "&#x27;".to_string(),
            _ => c.to_string(),
        })
        .collect())
}

#[tauri::command]
fn decode_html(text: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::EncodeDecode) {
        return Err("This feature requires a Pro license".to_string());
    }
    Ok(text.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#x27;", "'")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&#x2F;", "/")
        .replace("&#47;", "/")
        .replace("&nbsp;", " "))
}

// UUID generator command
#[tauri::command]
fn generate_uuid() -> String {
    uuid_v4()
}

// Lorem ipsum generator command
#[tauri::command]
fn generate_lorem_ipsum(paragraphs: u32, format: String) -> String {
    let words = [
        "lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
        "sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
        "magna", "aliqua", "enim", "ad", "minim", "veniam", "quis", "nostrud",
        "exercitation", "ullamco", "laboris", "nisi", "aliquip", "ex", "ea", "commodo",
        "consequat", "duis", "aute", "irure", "in", "reprehenderit", "voluptate",
        "velit", "esse", "cillum", "fugiat", "nulla", "pariatur", "excepteur", "sint",
        "occaecat", "cupidatat", "non", "proident", "sunt", "culpa", "qui", "officia",
        "deserunt", "mollit", "anim", "id", "est", "laborum", "at", "vero", "eos",
        "accusamus", "iusto", "odio", "dignissimos", "ducimus", "blanditiis",
        "praesentium", "voluptatum", "deleniti", "atque", "corrupti", "quos", "dolores",
        "quas", "molestias", "excepturi", "obcaecati", "cupiditate", "provident",
    ];

    use std::time::{SystemTime, UNIX_EPOCH};
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos() as u64;

    let mut rng_state = seed;
    let mut next_random = || {
        rng_state = rng_state.wrapping_mul(1103515245).wrapping_add(12345);
        rng_state
    };

    let generate_sentence = |rng: &mut dyn FnMut() -> u64| -> String {
        let word_count = 8 + (rng() % 12) as usize;
        let mut sentence: Vec<String> = (0..word_count)
            .map(|_| words[(rng() % words.len() as u64) as usize].to_string())
            .collect();
        if let Some(first) = sentence.first_mut() {
            *first = first.chars().next().unwrap().to_uppercase().to_string()
                + &first[1..];
        }
        sentence.join(" ") + "."
    };

    let generate_paragraph = |rng: &mut dyn FnMut() -> u64| -> String {
        let sentence_count = 4 + (rng() % 4) as usize;
        (0..sentence_count)
            .map(|_| generate_sentence(rng))
            .collect::<Vec<_>>()
            .join(" ")
    };

    let paras: Vec<String> = (0..paragraphs)
        .map(|_| generate_paragraph(&mut next_random))
        .collect();

    match format.as_str() {
        "html" => paras.iter()
            .map(|p| format!("<p>{}</p>", p))
            .collect::<Vec<_>>()
            .join("\n\n"),
        "markdown" => paras.join("\n\n"),
        _ => paras.join("\n\n"), // plain text
    }
}

// License commands
#[tauri::command]
async fn activate_license(license_key: String, email: String) -> Result<LicenseStatusInfo, String> {
    validate_license_online(&license_key, &email)
        .await
        .map(|cache| LicenseStatusInfo {
            tier: cache.tier,
            status: cache.status,
            email: cache.email,
            days_until_expiry: Some(30),
            needs_revalidation: false,
        })
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn deactivate_license() -> Result<(), String> {
    log::info!("deactivate_license called");
    let cache = load_license_cache().map_err(|e| {
        log::error!("Failed to load license cache: {}", e);
        e.to_string()
    })?;
    log::info!("License cache loaded, license_key present: {}", cache.license_key.is_some());
    if let Some(license_key) = cache.license_key {
        log::info!("Calling deactivate_license_online...");
        deactivate_license_online(&license_key)
            .await
            .map_err(|e| {
                log::error!("deactivate_license_online failed: {}", e);
                e.to_string()
            })
    } else {
        log::info!("No license key in cache, just clearing local cache");
        clear_license_cache().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn get_license_status() -> Result<LicenseStatusInfo, String> {
    check_license_status().map_err(|e| e.to_string())
}

#[tauri::command]
fn check_feature_enabled(feature: String) -> Result<bool, String> {
    let pro_feature = match feature.as_str() {
        "history" => ProFeature::History,
        "syntax_highlighting" => ProFeature::SyntaxHighlighting,
        "snippets" => ProFeature::Snippets,
        "custom_themes" => ProFeature::CustomThemes,
        "stats_display" => ProFeature::StatsDisplay,
        "export_history" => ProFeature::ExportHistory,
        "language_selection" => ProFeature::LanguageSelection,
        "json_xml_formatting" => ProFeature::JsonXmlFormatting,
        "encode_decode" => ProFeature::EncodeDecode,
        "image_attachments" => ProFeature::ImageAttachments,
        _ => return Err(format!("Unknown feature: {}", feature)),
    };
    Ok(is_feature_enabled(pro_feature))
}

#[tauri::command]
async fn refresh_license_status() -> Result<LicenseStatusInfo, String> {
    refresh_license().await.map_err(|e| e.to_string())
}

// Premium commands
#[tauri::command]
async fn validate_premium_license_cmd(license_key: String) -> Result<SubscriptionStatus, String> {
    validate_premium_license(&license_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_ai_usage_cmd(license_key: String) -> Result<UsageStats, String> {
    get_ai_usage(&license_key)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn call_ai_feature_cmd(
    license_key: String,
    prompt: String,
    feature: String,
    system_instructions: Option<String>,
) -> Result<AIResponse, String> {
    call_ai_feature(&license_key, &prompt, &feature, system_instructions.as_deref())
        .await
        .map_err(|e| e.to_string())
}

// Obsidian commands
#[tauri::command]
fn get_obsidian_config() -> Result<ObsidianConfig, String> {
    load_obsidian_config().map_err(|e| e.to_string())
}

#[tauri::command]
fn configure_obsidian(config: ObsidianConfig) -> Result<(), String> {
    // Validate vault path before saving
    if !config.vault_path.is_empty() {
        validate_obsidian_vault(&config.vault_path).map_err(|e| e.to_string())?;
    }
    save_obsidian_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
fn validate_obsidian_vault_cmd(vault_path: String) -> Result<bool, String> {
    validate_obsidian_vault(&vault_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_to_obsidian(content: String) -> Result<ObsidianResult, String> {
    log::info!("add_to_obsidian called with {} chars", content.len());

    let config = load_obsidian_config().map_err(|e| {
        log::error!("Failed to load Obsidian config: {}", e);
        e.to_string()
    })?;

    log::info!("Obsidian config loaded: vault_path={}", config.vault_path);

    if config.vault_path.is_empty() {
        return Err("Obsidian vault not configured. Please configure in Settings.".to_string());
    }

    add_to_obsidian_vault(&content, &config).map_err(|e| {
        log::error!("Failed to add to Obsidian vault: {}", e);
        e.to_string()
    })
}

/// Open a URL (used for opening Obsidian notes from toast notification)
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    Ok(())
}

// AI commands
#[tauri::command]
fn get_ai_config() -> Result<AIConfig, String> {
    load_ai_config().map_err(|e| e.to_string())
}

#[tauri::command]
fn configure_ai(config: AIConfig) -> Result<(), String> {
    save_ai_config(&config).map_err(|e| e.to_string())
}

// AI Presets commands
#[tauri::command]
fn get_ai_presets() -> Result<AIPresetsConfig, String> {
    load_ai_presets().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_ai_presets_cmd(config: AIPresetsConfig) -> Result<(), String> {
    save_ai_presets(&config).map_err(|e| e.to_string())
}

// Folder picker command (uses rfd for native dialog)
#[tauri::command]
async fn pick_folder(title: Option<String>) -> Result<Option<String>, String> {
    // Set flag to prevent panel from hiding when dialog takes focus
    #[cfg(target_os = "macos")]
    {
        window::DIALOG_OPEN.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    let dialog = rfd::AsyncFileDialog::new()
        .set_title(title.as_deref().unwrap_or("Select Folder"));

    let folder = dialog.pick_folder().await;

    // Clear the flag after dialog closes
    #[cfg(target_os = "macos")]
    {
        window::DIALOG_OPEN.store(false, std::sync::atomic::Ordering::SeqCst);
    }

    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

// Update commands
#[tauri::command]
async fn check_for_app_updates() -> Result<UpdateInfo, String> {
    check_for_updates().await
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Window commands
#[tauri::command]
async fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())?;
    Ok(())
}

/// Set window blur effect (vibrancy) - PRO feature
#[cfg(target_os = "macos")]
#[tauri::command]
async fn set_window_blur_cmd(window: tauri::WebviewWindow, enabled: bool) -> Result<(), String> {
    use std::sync::mpsc;
    use std::time::Duration;

    log::info!("set_window_blur_cmd called with enabled={}", enabled);

    // Must run on main thread to avoid Cocoa exceptions
    let (tx, rx) = mpsc::channel();
    let app_handle = window.app_handle().clone();
    let app_handle_inner = app_handle.clone();

    app_handle
        .run_on_main_thread(move || {
            let result = if let Some(webview_window) = app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                set_window_blur(&webview_window, enabled)
            } else {
                Err("Window not found".to_string())
            };
            let _ = tx.send(result);
        })
        .map_err(|e| e.to_string())?;

    // Wait with timeout to avoid hanging
    rx.recv_timeout(Duration::from_secs(5))
        .map_err(|e| format!("Timeout waiting for blur operation: {}", e))?
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn set_window_blur_cmd(_window: tauri::WebviewWindow, _enabled: bool) -> Result<(), String> {
    // Blur effect is only available on macOS
    Ok(())
}

/// Update vibrancy material for light/dark theme
#[cfg(target_os = "macos")]
#[tauri::command]
async fn set_vibrancy_mode(window: tauri::WebviewWindow, is_dark: bool) -> Result<(), String> {
    use std::sync::mpsc;
    use std::time::Duration;

    log::info!("set_vibrancy_mode called with is_dark={}", is_dark);

    let (tx, rx) = mpsc::channel();
    let app_handle = window.app_handle().clone();
    let app_handle_inner = app_handle.clone();

    app_handle
        .run_on_main_thread(move || {
            let result = if let Some(webview_window) = app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                update_vibrancy_material(&webview_window, is_dark)
            } else {
                Err("Window not found".to_string())
            };
            let _ = tx.send(result);
        })
        .map_err(|e| e.to_string())?;

    rx.recv_timeout(Duration::from_secs(5))
        .map_err(|e| format!("Timeout waiting for vibrancy update: {}", e))?
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn set_vibrancy_mode(_window: tauri::WebviewWindow, _is_dark: bool) -> Result<(), String> {
    // Vibrancy is only available on macOS
    Ok(())
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn update_panel_behavior(window: tauri::Window, sticky_mode: bool) -> Result<(), String> {
    log::info!("update_panel_behavior called with sticky_mode={}", sticky_mode);

    let app_handle = window.app_handle().clone();
    let app_handle_inner = app_handle.clone();

    // Run on main thread to avoid foreign exception crashes
    app_handle
        .run_on_main_thread(move || {
            if let Some(webview_window) = app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                if let Err(e) = webview_window.update_panel_behavior(sticky_mode) {
                    log::error!("Failed to update panel behavior: {:?}", e);
                } else {
                    log::info!("Panel behavior updated successfully");
                }
            } else {
                log::error!("Failed to get webview window");
            }
        })
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
#[allow(unused_variables)]
async fn show_window(window: tauri::Window, state: State<'_, AppState>) -> Result<(), String> {
    log::info!("show_window called");

    // On macOS, use NSPanel for fullscreen overlay support
    // Show the panel IMMEDIATELY, then detect previous app in background
    #[cfg(target_os = "macos")]
    {
        let app_handle = window.app_handle().clone();
        let app_handle_inner = app_handle.clone();

        // Run panel operations on the main thread - this is the critical path
        app_handle
            .run_on_main_thread(move || {
                let webview_window = match app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                    Some(w) => w,
                    None => {
                        log::error!("Failed to get webview window");
                        return;
                    }
                };

                // Get the pre-initialized panel (should already exist from setup)
                let panel = match app_handle_inner.get_webview_panel(MAIN_WINDOW_LABEL) {
                    Ok(p) => p,
                    Err(_) => {
                        // Fallback: create panel if not pre-initialized
                        match webview_window.to_wingman_panel() {
                            Ok(p) => p,
                            Err(e) => {
                                log::error!("Failed to create panel: {:?}", e);
                                return;
                            }
                        }
                    }
                };

                // Always move to cursor's monitor, restoring saved position if available
                if let Err(e) = webview_window.move_to_cursor_monitor() {
                    log::warn!("Failed to move to cursor monitor: {}", e);
                }

                panel.show_and_make_key();
                log::info!("show_window (panel) completed successfully");
            })
            .map_err(|e| e.to_string())?;

        // Detect previous app in background (non-blocking)
        // Check if we have a recent cached value (within 500ms)
        let needs_detection = {
            let cache = state.previous_app.lock().unwrap();
            match &*cache {
                Some((_, timestamp)) => timestamp.elapsed() > std::time::Duration::from_millis(500),
                None => true,
            }
        };

        if needs_detection {
            let app_handle_for_thread = window.app_handle().clone();
            std::thread::spawn(move || {
                let output = std::process::Command::new("osascript")
                    .arg("-e")
                    .arg(r#"tell application "System Events" to get name of first process whose frontmost is true"#)
                    .output()
                    .ok();

                if let Some(o) = output {
                    if let Ok(app_name) = String::from_utf8(o.stdout) {
                        let app_name = app_name.trim().to_string();
                        log::info!("Previous app detected (async): {}", app_name);
                        if !app_name.is_empty() && app_name != "Wingman" {
                            let state = app_handle_for_thread.state::<AppState>();
                            *state.previous_app.lock().unwrap() = Some((app_name.clone(), std::time::Instant::now()));
                            log::info!("Stored previous app: {}", app_name);
                        }
                    }
                }
            });
        }

        return Ok(());
    }

    // On non-macOS, use standard window behavior with enhanced Linux support
    #[cfg(not(target_os = "macos"))]
    {
        log::info!("show_window: Starting non-macOS window show sequence");

        // Check if this is the first time showing the window
        let is_first_show = !state.has_been_shown.load(std::sync::atomic::Ordering::SeqCst);

        // Only center on first show - remember position after that
        if is_first_show {
            if let Err(e) = window.center() {
                log::warn!("Failed to center window: {}", e);
            }
            log::info!("First show - centered window");
        }

        // Mark as shown
        state.has_been_shown.store(true, std::sync::atomic::Ordering::SeqCst);

        // On Linux, we need to be more aggressive about showing the window
        // due to different window manager behaviors
        #[cfg(target_os = "linux")]
        {
            log::info!("Linux: Using enhanced show sequence");

            // First, ensure window is not minimized
            if let Err(e) = window.unminimize() {
                log::warn!("Failed to unminimize window: {}", e);
            }

            // Set always on top to help with visibility on different WMs
            if let Err(e) = window.set_always_on_top(true) {
                log::warn!("Failed to set always on top: {}", e);
            }
        }

        // Show the window
        log::info!("Showing window...");
        window.show().map_err(|e| {
            log::error!("Failed to show window: {}", e);
            e.to_string()
        })?;

        // On Linux, request attention first then set focus
        #[cfg(target_os = "linux")]
        {
            // Request user attention - helps on some WMs
            if let Err(e) = window.request_user_attention(Some(tauri::UserAttentionType::Critical)) {
                log::warn!("Failed to request user attention: {}", e);
            }
        }

        log::info!("Setting focus...");
        window.set_focus().map_err(|e| {
            log::error!("Failed to set focus: {}", e);
            e.to_string()
        })?;

        log::info!("show_window completed successfully");
        Ok(())
    }
}

#[tauri::command]
async fn hide_window(window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let app_handle = window.app_handle().clone();
        let app_handle_inner = app_handle.clone();
        // Run panel operations on the main thread
        app_handle
            .run_on_main_thread(move || {
                if let Ok(panel) = app_handle_inner.get_webview_panel(MAIN_WINDOW_LABEL) {
                    if panel.is_visible() {
                        // Save position before hiding
                        if let Some(webview_window) = app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                            if let Some(monitor_name) = get_cursor_monitor_name() {
                                if let Err(e) = webview_window.save_position_for_current_monitor(&monitor_name) {
                                    log::warn!("Failed to save position on hide: {:?}", e);
                                } else {
                                    log::info!("Saved position for {} before hiding", monitor_name);
                                }
                            }
                        }

                        panel.hide();
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        window.hide().map_err(|e| e.to_string())
    }
}

#[tauri::command]
#[allow(unused_variables)]
async fn hide_and_paste(window: tauri::Window, state: State<'_, AppState>) -> Result<(), String> {
    // Get the stored previous app (extract just the name, ignore timestamp)
    #[cfg(target_os = "macos")]
    let previous_app: Option<String> = state.previous_app.lock().unwrap().as_ref().map(|(name, _)| name.clone());

    // Hide the window/panel - must run on main thread
    #[cfg(target_os = "macos")]
    {
        let app_handle = window.app_handle().clone();
        let app_handle_inner = app_handle.clone();
        app_handle
            .run_on_main_thread(move || {
                if let Ok(panel) = app_handle_inner.get_webview_panel(MAIN_WINDOW_LABEL) {
                    if panel.is_visible() {
                        // Save position before hiding
                        if let Some(webview_window) = app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                            if let Some(monitor_name) = get_cursor_monitor_name() {
                                if let Err(e) = webview_window.save_position_for_current_monitor(&monitor_name) {
                                    log::warn!("Failed to save position on hide: {:?}", e);
                                }
                            }
                        }

                        panel.hide();
                    }
                }
            })
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "macos"))]
    {
        window.hide().map_err(|e| e.to_string())?;
    }

    // On macOS, activate the previous app
    #[cfg(target_os = "macos")]
    {
        if let Some(app_name) = previous_app {
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(50));

                // Activate the previous app
                let script = format!(
                    r#"tell application "{}" to activate"#,
                    app_name
                );

                let _ = std::process::Command::new("osascript")
                    .arg("-e")
                    .arg(&script)
                    .output();
            });
        }
    }

    Ok(())
}

// Simple UUID v4 generator
fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let nanos = duration.as_nanos();
    let pid = std::process::id() as u64;

    // Generate two pseudo-random u64 values
    let r1: u64 = (nanos as u64).wrapping_mul(0x517cc1b727220a95).wrapping_add(pid);
    let r2: u64 = ((nanos >> 64) as u64).wrapping_mul(0x2545F4914F6CDD1D).wrapping_add(pid.wrapping_mul(0x9E3779B97F4A7C15));

    format!(
        "{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
        (r1 >> 32) as u32,
        (r1 >> 16) as u16 & 0xFFFF,
        r1 as u16 & 0x0FFF,
        ((r2 >> 48) as u16 & 0x3FFF) | 0x8000,
        r2 & 0xFFFFFFFFFFFF
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database
    let db = init_database().expect("Failed to initialize database");
    #[cfg(target_os = "macos")]
    let app_state = AppState {
        db: Mutex::new(db),
        previous_app: Mutex::new(None),
        has_been_shown: std::sync::atomic::AtomicBool::new(false),
    };
    #[cfg(not(target_os = "macos"))]
    let app_state = AppState {
        db: Mutex::new(db),
        has_been_shown: std::sync::atomic::AtomicBool::new(false),
    };

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .manage(app_state)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .build(),
        )
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        );

    // Add NSPanel plugin on macOS for fullscreen overlay support
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            // Settings
            get_settings,
            update_settings,
            get_default_hotkey_cmd,
            validate_hotkey_cmd,
            // History
            add_history_entry,
            get_history,
            search_history,
            delete_history_entry,
            clear_all_history,
            get_history_stats,
            cleanup_history,
            export_all_history,
            // Snippets
            get_snippets,
            save_snippets_data,
            add_snippet,
            update_snippet,
            delete_snippet,
            // Text utilities
            get_text_stats,
            transform_text_cmd,
            count_pattern_occurrences,
            // Native clipboard
            write_native_clipboard,
            // JSON/XML formatting
            format_json,
            minify_json,
            format_xml,
            // Encoding/decoding
            encode_base64,
            decode_base64,
            encode_url,
            decode_url,
            encode_html,
            decode_html,
            // Generators
            generate_uuid,
            generate_lorem_ipsum,
            // License
            activate_license,
            deactivate_license,
            get_license_status,
            check_feature_enabled,
            refresh_license_status,
            // Premium
            validate_premium_license_cmd,
            get_ai_usage_cmd,
            call_ai_feature_cmd,
            // Obsidian
            get_obsidian_config,
            configure_obsidian,
            validate_obsidian_vault_cmd,
            add_to_obsidian,
            open_url,
            // AI
            get_ai_config,
            configure_ai,
            get_ai_presets,
            save_ai_presets_cmd,
            // Window
            show_window,
            hide_window,
            hide_and_paste,
            toggle_fullscreen,
            set_window_blur_cmd,
            set_vibrancy_mode,
            #[cfg(target_os = "macos")]
            update_panel_behavior,
            // Dialogs
            pick_folder,
            // Updates
            check_for_app_updates,
            get_app_version,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Center the window on startup
            window.center().ok();

            // Hide dock icon on macOS (make it a menubar-only app)
            #[cfg(target_os = "macos")]
            {
                app.set_activation_policy(tauri::ActivationPolicy::Accessory);

                // Pre-initialize the NSPanel so it's ready when hotkey is pressed
                // This eliminates panel creation overhead on first show
                if let Err(e) = window.to_wingman_panel() {
                    log::warn!("Failed to pre-initialize panel: {:?}", e);
                } else {
                    log::info!("NSPanel pre-initialized successfully");

                    // Apply transparency at startup
                    if let Err(e) = set_window_blur(&window, true) {
                        log::warn!("Failed to apply transparency on startup: {:?}", e);
                    } else {
                        log::info!("Transparency applied on startup");
                    }

                    // Apply sticky mode behavior based on saved settings
                    if let Ok(settings) = load_settings() {
                        if let Err(e) = window.update_panel_behavior(settings.sticky_mode) {
                            log::warn!("Failed to apply sticky mode on startup: {:?}", e);
                        } else {
                            log::info!("Applied sticky mode on startup: {}", settings.sticky_mode);
                        }
                    }

                    // Start workspace monitor to refocus panel in sticky mode
                    start_workspace_monitor(app.handle().clone());
                    log::info!("Workspace monitor started");
                }
            }

            // Create system tray menu
            let show_item = MenuItem::with_id(app, "show", "Show Wingman", true, None::<&str>)?;
            let separator1 = tauri::menu::PredefinedMenuItem::separator(app)?;
            let hotkeys_item = MenuItem::with_id(app, "hotkeys", "Hotkeys...", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, None::<&str>)?;
            let separator2 = tauri::menu::PredefinedMenuItem::separator(app)?;
            let updates_item = MenuItem::with_id(app, "check_updates", "Check for Updates...", true, None::<&str>)?;
            let separator3 = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Wingman", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[
                &show_item,
                &separator1,
                &hotkeys_item,
                &settings_item,
                &separator2,
                &updates_item,
                &separator3,
                &quit_item,
            ])?;

            // Build tray icon - menu shows on left-click
            // Use custom tray icon (light version with colors for menu bar)
            let tray_icon = {
                let png_bytes = include_bytes!("../icons/tray/icon.png");
                let img = image::load_from_memory(png_bytes).expect("Failed to decode tray icon");
                let rgba = img.to_rgba8();
                let (width, height) = rgba.dimensions();
                tauri::image::Image::new_owned(rgba.into_raw(), width, height)
            };
            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            #[cfg(target_os = "macos")]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    let panel = app
                                        .get_webview_panel(MAIN_WINDOW_LABEL)
                                        .or_else(|_| window.to_wingman_panel());

                                    if let Ok(panel) = panel {
                                        // Always move to cursor's monitor with saved position
                                        window.move_to_cursor_monitor().ok();
                                        panel.show_and_make_key();
                                    }
                                }
                            }
                            #[cfg(not(target_os = "macos"))]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    window.center().ok();
                                    window.show().ok();
                                    window.set_focus().ok();
                                }
                            }
                        }
                        "hotkeys" => {
                            #[cfg(target_os = "macos")]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    let panel = app
                                        .get_webview_panel(MAIN_WINDOW_LABEL)
                                        .or_else(|_| window.to_wingman_panel());

                                    if let Ok(panel) = panel {
                                        window.move_to_cursor_monitor().ok();
                                        panel.show_and_make_key();
                                        window.emit("open-hotkeys", ()).ok();
                                    }
                                }
                            }
                            #[cfg(not(target_os = "macos"))]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    window.center().ok();
                                    window.show().ok();
                                    window.set_focus().ok();
                                    window.emit("open-hotkeys", ()).ok();
                                }
                            }
                        }
                        "settings" => {
                            #[cfg(target_os = "macos")]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    let panel = app
                                        .get_webview_panel(MAIN_WINDOW_LABEL)
                                        .or_else(|_| window.to_wingman_panel());

                                    if let Ok(panel) = panel {
                                        window.move_to_cursor_monitor().ok();
                                        panel.show_and_make_key();
                                        window.emit("open-settings", ()).ok();
                                    }
                                }
                            }
                            #[cfg(not(target_os = "macos"))]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    window.center().ok();
                                    window.show().ok();
                                    window.set_focus().ok();
                                    window.emit("open-settings", ()).ok();
                                }
                            }
                        }
                        "check_updates" => {
                            #[cfg(target_os = "macos")]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    let panel = app
                                        .get_webview_panel(MAIN_WINDOW_LABEL)
                                        .or_else(|_| window.to_wingman_panel());

                                    if let Ok(panel) = panel {
                                        window.move_to_cursor_monitor().ok();
                                        panel.show_and_make_key();
                                        window.emit("check-updates", ()).ok();
                                    }
                                }
                            }
                            #[cfg(not(target_os = "macos"))]
                            {
                                if let Some(window) = app.get_webview_window("main") {
                                    window.center().ok();
                                    window.show().ok();
                                    window.set_focus().ok();
                                    window.emit("check-updates", ()).ok();
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
