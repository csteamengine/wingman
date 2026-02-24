mod clipboard;
mod credentials;
mod formatters;
mod github;
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
    AppHandle, Emitter, Manager, State,
};
#[cfg(target_os = "macos")]
use tauri_nspanel::ManagerExt;
#[cfg(target_os = "macos")]
use window::{start_workspace_monitor, set_window_blur, update_vibrancy_material, get_window_monitor_name, disable_webview_spellcheck, find_wk_content_view, promote_wk_content_view_to_first_responder, WebviewWindowExt, MAIN_WINDOW_LABEL};

use clipboard::{calculate_text_stats, transform_text, TextStats, TextTransform};
use credentials::{store_credential, get_credential, delete_credential};
use github::{
    check_github_auth_status, create_github_gist, delete_github_gist, get_github_config,
    list_wingman_gists, logout_github, poll_github_device_flow, save_github_config,
    start_github_device_flow, update_github_gist,
};
use history::{
    add_entry, cleanup_old_entries, clear_history, delete_entry, export_history, get_entries,
    get_stats, init_database, search_entries, HistoryEntry, HistoryStats,
};
use hotkey::{get_default_hotkey, validate_hotkey};
use license::{
    check_license_status, is_feature_enabled, load_license_cache, refresh_license,
    validate_license_online, deactivate_license_online, clear_license_cache,
    get_cached_license_key, get_device_id, LicenseStatusInfo, ProFeature,
};
use premium::{
    validate_premium_license, get_ai_usage, call_ai_feature, create_customer_portal_session,
    load_obsidian_config, save_obsidian_config, add_to_obsidian_vault, validate_obsidian_vault,
    load_ai_config, save_ai_config, load_ai_presets, save_ai_presets,
    SubscriptionStatus, UsageStats, AIResponse, ObsidianConfig, ObsidianResult, AIConfig, AIPresetsConfig,
};
use storage::{
    load_settings, load_snippets, save_settings, save_snippets, AppSettings, Snippet, SnippetsData,
    load_custom_transformations, save_custom_transformations, CustomTransformationsData,
    load_transformation_chains, save_transformation_chains, TransformationChainsData,
    load_custom_ai_prompts, save_custom_ai_prompts, CustomAIPrompt, CustomAIPromptsData,
};
use updater::{check_for_updates, download_and_install_update as do_update, UpdateInfo};

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
        github_gist_id: None,
        github_gist_url: None,
        github_gist_filename: None,
        github_synced_at: None,
        github_source: None,
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

#[tauri::command]
fn set_snippet_github_info(
    id: String,
    gist_id: String,
    gist_url: String,
    gist_filename: Option<String>,
    github_source: Option<String>,
) -> Result<(), String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    if let Some(snippet) = data.snippets.iter_mut().find(|s| s.id == id) {
        snippet.github_gist_id = Some(gist_id);
        snippet.github_gist_url = Some(gist_url);
        snippet.github_gist_filename = gist_filename;
        snippet.github_synced_at = Some(chrono::Utc::now().to_rfc3339());
        snippet.github_source = github_source;
        snippet.updated_at = chrono::Utc::now().to_rfc3339();
    }
    save_snippets(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_snippet_github_info(id: String) -> Result<(), String> {
    let mut data = load_snippets().map_err(|e| e.to_string())?;
    if let Some(snippet) = data.snippets.iter_mut().find(|s| s.id == id) {
        snippet.github_gist_id = None;
        snippet.github_gist_url = None;
        snippet.github_gist_filename = None;
        snippet.github_synced_at = None;
        snippet.github_source = None;
        snippet.updated_at = chrono::Utc::now().to_rfc3339();
    }
    save_snippets(&data).map_err(|e| e.to_string())
}

// Custom AI Prompts commands
#[tauri::command]
fn get_custom_ai_prompts() -> Result<CustomAIPromptsData, String> {
    load_custom_ai_prompts().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_custom_ai_prompts_data(data: CustomAIPromptsData) -> Result<(), String> {
    save_custom_ai_prompts(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_custom_ai_prompt(
    name: String,
    description: String,
    system_prompt: String,
) -> Result<CustomAIPrompt, String> {
    let mut data = load_custom_ai_prompts().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().to_rfc3339();
    let prompt = CustomAIPrompt {
        id: uuid_v4(),
        name,
        description,
        system_prompt,
        enabled: true,
        created_at: now.clone(),
        updated_at: now,
    };
    data.prompts.push(prompt.clone());
    save_custom_ai_prompts(&data).map_err(|e| e.to_string())?;
    Ok(prompt)
}

#[tauri::command]
fn update_custom_ai_prompt(
    id: String,
    name: String,
    description: String,
    system_prompt: String,
    enabled: bool,
) -> Result<(), String> {
    let mut data = load_custom_ai_prompts().map_err(|e| e.to_string())?;
    if let Some(prompt) = data.prompts.iter_mut().find(|p| p.id == id) {
        prompt.name = name;
        prompt.description = description;
        prompt.system_prompt = system_prompt;
        prompt.enabled = enabled;
        prompt.updated_at = chrono::Utc::now().to_rfc3339();
    }
    save_custom_ai_prompts(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_custom_ai_prompt(id: String) -> Result<(), String> {
    let mut data = load_custom_ai_prompts().map_err(|e| e.to_string())?;
    data.prompts.retain(|p| p.id != id);
    save_custom_ai_prompts(&data).map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_custom_ai_prompt_enabled(id: String) -> Result<(), String> {
    let mut data = load_custom_ai_prompts().map_err(|e| e.to_string())?;
    if let Some(prompt) = data.prompts.iter_mut().find(|p| p.id == id) {
        prompt.enabled = !prompt.enabled;
        prompt.updated_at = chrono::Utc::now().to_rfc3339();
    }
    save_custom_ai_prompts(&data).map_err(|e| e.to_string())
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
        "camelcase" => TextTransform::CamelCase,
        "snakecase" => TextTransform::SnakeCase,
        "kebabcase" => TextTransform::KebabCase,
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

/// Copy content as a file to the system clipboard
#[tauri::command]
fn copy_file_to_clipboard(content: String, language: String) -> Result<String, String> {
    native_clipboard::copy_file_to_clipboard(&content, &language)
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
    formatters::minify_json_code(text)
}

#[tauri::command]
fn detect_language(text: String) -> String {
    let trimmed = text.trim();

    // Try JSON first
    if (trimmed.starts_with('{') || trimmed.starts_with('[')) && serde_json::from_str::<serde_json::Value>(&text).is_ok() {
        return "json".to_string();
    }

    // Try XML/HTML
    if trimmed.starts_with('<') {
        if trimmed.to_lowercase().contains("<!doctype html") || trimmed.to_lowercase().contains("<html") {
            return "html".to_string();
        }
        return "xml".to_string();
    }

    // Check for SQL keywords
    let upper_text = text.to_uppercase();
    if upper_text.trim_start().starts_with("SELECT") || upper_text.trim_start().starts_with("INSERT") ||
       upper_text.trim_start().starts_with("UPDATE") || upper_text.trim_start().starts_with("DELETE") ||
       upper_text.trim_start().starts_with("CREATE") {
        return "sql".to_string();
    }

    // Check for Python patterns
    if text.contains("def ") || (text.contains("import ") && !text.contains("import {")) ||
       (text.contains("class ") && text.contains(":")) {
        return "python".to_string();
    }

    // Check for JavaScript/TypeScript patterns
    if text.contains("function ") || text.contains("const ") || text.contains("let ") || text.contains("var ") ||
       text.contains("=>") || (text.contains("import ") && text.contains("from ")) {
        // Check for JSX/React - any JSX is now considered React
        if (text.contains("<") && text.contains("/>")) || text.contains("className=") ||
           text.contains("useState") || text.contains("useEffect") || text.contains("React.") ||
           text.contains("from 'react'") || text.contains("from \"react\"") {
            return "react".to_string();
        }
        // Check for TypeScript
        if text.contains(": ") && (text.contains("interface ") || text.contains("type ") || text.contains("enum ")) {
            return "typescript".to_string();
        }
        return "javascript".to_string();
    }

    // Check for CSS
    if text.contains("{") && text.contains("}") && (text.contains("@media") || text.contains("@import") ||
       text.contains("px") || text.contains("rem")) {
        return "css".to_string();
    }

    "plaintext".to_string()
}

#[tauri::command]
fn format_code(text: String, language: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::JsonXmlFormatting) {
        return Err("This feature requires a Pro license".to_string());
    }

    match language.as_str() {
        "json" => formatters::format_json_code(text),
        "xml" => format_xml(text),
        "html" => formatters::format_html_code(text),
        "css" => formatters::format_css_code(text),
        "python" => formatters::format_python_code(text),
        "react" | "jsx" | "tsx" => formatters::format_react_code(text),
        "javascript" | "typescript" => formatters::format_javascript_code(text),
        "sql" => formatters::format_sql_code(text),
        "go" => formatters::format_go_code(text),
        "rust" => formatters::format_rust_code(text),
        "java" => formatters::format_java_code(text),
        "php" => formatters::format_php_code(text),
        "ruby" => formatters::format_ruby_code(text),
        "swift" => formatters::format_swift_code(text),
        "kotlin" => formatters::format_kotlin_code(text),
        "csharp" => formatters::format_csharp_code(text),
        "bash" => formatters::format_bash_code(text),
        "c" | "cpp" => formatters::format_c_cpp_code(text),
        "markdown" => formatters::format_markdown_code(text),
        "yaml" => Err("YAML formatting is not recommended as YAML is whitespace-sensitive and formatting may change semantics.".to_string()),
        "plaintext" => Err("Cannot format plain text. Please select a specific language mode first.".to_string()),
        _ => Err(format!("Formatting not supported for {}", language))
    }
}

#[tauri::command]
fn minify_code(text: String, language: String) -> Result<String, String> {
    if !is_feature_enabled(ProFeature::JsonXmlFormatting) {
        return Err("This feature requires a Pro license".to_string());
    }

    match language.as_str() {
        // Supported minification
        "json" => formatters::minify_json_code(text),
        "css" => formatters::minify_css_code(text),
        "react" | "jsx" | "tsx" => formatters::minify_react_code(text),
        "javascript" | "typescript" => formatters::minify_javascript_code(text),
        "html" => formatters::minify_html_code(text),
        "xml" => formatters::minify_xml_code(text),

        // Languages that don't support minification
        "sql" => Err("SQL minification is not recommended as it reduces readability without significant benefits.".to_string()),
        "python" => Err("Python minification is not supported. Python relies on whitespace for syntax, making minification impractical.".to_string()),
        "yaml" => Err("YAML minification is not supported. YAML is whitespace-sensitive and minification would break the format.".to_string()),
        "markdown" => Err("Markdown minification is not supported. Markdown formatting is part of the content structure.".to_string()),
        "bash" => Err("Bash/Shell script minification is not supported. Readability is more important for shell scripts.".to_string()),
        "go" => Err("Go minification is not supported. Go code is compiled, so minification provides no runtime benefit.".to_string()),
        "rust" => Err("Rust minification is not supported. Rust code is compiled, so minification provides no runtime benefit.".to_string()),
        "java" => Err("Java minification is not supported. Java code is compiled, so minification provides no runtime benefit.".to_string()),
        "php" => Err("PHP minification is not commonly used. Consider using opcode caching (OPcache) for performance instead.".to_string()),
        "c" | "cpp" => Err("C/C++ minification is not supported. Code is compiled, so minification provides no runtime benefit.".to_string()),
        "ruby" => Err("Ruby minification is not supported. Ruby emphasizes readability over minification.".to_string()),
        "swift" => Err("Swift minification is not supported. Swift code is compiled, so minification provides no runtime benefit.".to_string()),
        "kotlin" => Err("Kotlin minification is not supported. Kotlin code is compiled, so minification provides no runtime benefit.".to_string()),
        "csharp" => Err("C# minification is not supported. C# code is compiled, so minification provides no runtime benefit.".to_string()),
        "plaintext" => Err("Cannot minify plain text. Please select a specific language mode first.".to_string()),

        _ => Err(format!("Minify not supported for {}", language))
    }
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
    uuid::Uuid::new_v4().to_string()
}

#[tauri::command]
fn generate_uuid_v7() -> String {
    uuid::Uuid::now_v7().to_string()
}

#[tauri::command]
fn generate_nanoid(length: Option<usize>) -> String {
    let len = length.unwrap_or(21);
    nanoid::format(nanoid::rngs::default, &nanoid::alphabet::SAFE, len)
}

#[tauri::command]
fn generate_short_hash(length: Option<usize>) -> String {
    use sha2::{Digest, Sha256};
    use std::time::{SystemTime, UNIX_EPOCH};

    let len = length.unwrap_or(8).min(64);

    // Generate random data
    let seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let random_bytes = format!("{}{}{}", seed, std::process::id(), rand::random::<u64>());

    let mut hasher = Sha256::new();
    hasher.update(random_bytes.as_bytes());
    let hash = format!("{:x}", hasher.finalize());

    hash[..len].to_string()
}

#[tauri::command]
fn generate_prefixed_id(prefix: String, id_type: Option<String>) -> Result<String, String> {
    // Validate prefix (alphanumeric + underscore only)
    if !prefix.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err("Prefix must be alphanumeric with underscores only".to_string());
    }

    let id = match id_type.as_deref().unwrap_or("nanoid") {
        "uuid" => {
            let uuid = uuid::Uuid::new_v4().to_string().replace("-", "");
            uuid[..12].to_string()
        }
        "nanoid" | _ => nanoid::nanoid!(16),
    };

    Ok(format!("{}{}", prefix, id))
}

#[tauri::command]
fn generate_bulk(
    generator: String,
    count: u32,
    prefix: Option<String>,
    length: Option<usize>,
) -> Result<String, String> {
    use sha2::{Digest, Sha256};

    let count = count.min(100) as usize; // Cap at 100

    let results: Vec<String> = (0..count)
        .map(|i| match generator.as_str() {
            "uuid" | "uuid_v4" => uuid::Uuid::new_v4().to_string(),
            "uuid_v7" => uuid::Uuid::now_v7().to_string(),
            "nanoid" => nanoid::format(nanoid::rngs::default, &nanoid::alphabet::SAFE, length.unwrap_or(21)),
            "short_hash" => {
                let seed = format!(
                    "{}{}{}",
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_nanos(),
                    rand::random::<u64>(),
                    i
                );
                let mut hasher = Sha256::new();
                hasher.update(seed.as_bytes());
                let hash = format!("{:x}", hasher.finalize());
                hash[..length.unwrap_or(8).min(64)].to_string()
            }
            "prefixed" => {
                let pfx = prefix.as_deref().unwrap_or("id_");
                format!("{}{}", pfx, nanoid::nanoid!(16))
            }
            _ => uuid::Uuid::new_v4().to_string(),
        })
        .collect();

    Ok(results.join("\n"))
}

// Hash generator commands
#[tauri::command]
fn generate_md5(text: String) -> String {
    use md5::{Md5, Digest};
    let mut hasher = Md5::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
fn generate_sha1(text: String) -> String {
    use sha1::{Sha1, Digest};
    let mut hasher = Sha1::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
fn generate_sha256(text: String) -> String {
    use sha2::{Sha256, Digest};
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

#[tauri::command]
fn generate_sha512(text: String) -> String {
    use sha2::{Sha512, Digest};
    let mut hasher = Sha512::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

// Timestamp utility commands
#[tauri::command]
fn unix_to_human(text: String) -> Result<String, String> {
    use chrono::DateTime;

    let timestamp: i64 = text.trim().parse()
        .map_err(|_| "Invalid timestamp. Enter a Unix timestamp (e.g., 1704067200)".to_string())?;

    // Auto-detect seconds vs milliseconds (timestamps after year 2001 in ms are > 10^12)
    let (secs, nsecs) = if timestamp > 10_000_000_000 {
        (timestamp / 1000, ((timestamp % 1000) * 1_000_000) as u32)
    } else {
        (timestamp, 0)
    };

    let dt = DateTime::from_timestamp(secs, nsecs)
        .ok_or_else(|| "Invalid timestamp".to_string())?;

    Ok(dt.format("%Y-%m-%d %H:%M:%S UTC").to_string())
}

#[tauri::command]
fn human_to_unix(text: String) -> Result<String, String> {
    use chrono::{NaiveDateTime, TimeZone, Utc, DateTime};

    let datetime = text.trim();

    // Try common formats
    let formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%d/%m/%Y %H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ];

    for fmt in &formats {
        if let Ok(naive) = NaiveDateTime::parse_from_str(datetime, fmt) {
            let dt = Utc.from_utc_datetime(&naive);
            return Ok(dt.timestamp().to_string());
        }
    }

    // Try ISO 8601 with timezone
    if let Ok(dt) = DateTime::parse_from_rfc3339(datetime) {
        return Ok(dt.timestamp().to_string());
    }

    Err("Could not parse datetime. Try formats like: 2024-01-15 14:30:00".to_string())
}

#[tauri::command]
fn convert_timezone(datetime: String, from_tz: String, to_tz: String) -> Result<String, String> {
    use chrono::{NaiveDateTime, TimeZone, FixedOffset};

    // Parse timezone offsets (e.g., "+05:30", "-08:00", "UTC", "Z")
    fn parse_offset(tz: &str) -> Result<FixedOffset, String> {
        match tz.to_uppercase().as_str() {
            "UTC" | "Z" => Ok(FixedOffset::east_opt(0).unwrap()),
            "EST" => Ok(FixedOffset::west_opt(5 * 3600).unwrap()),
            "EDT" => Ok(FixedOffset::west_opt(4 * 3600).unwrap()),
            "CST" => Ok(FixedOffset::west_opt(6 * 3600).unwrap()),
            "CDT" => Ok(FixedOffset::west_opt(5 * 3600).unwrap()),
            "MST" => Ok(FixedOffset::west_opt(7 * 3600).unwrap()),
            "MDT" => Ok(FixedOffset::west_opt(6 * 3600).unwrap()),
            "PST" => Ok(FixedOffset::west_opt(8 * 3600).unwrap()),
            "PDT" => Ok(FixedOffset::west_opt(7 * 3600).unwrap()),
            "IST" => Ok(FixedOffset::east_opt(5 * 3600 + 1800).unwrap()),
            "JST" => Ok(FixedOffset::east_opt(9 * 3600).unwrap()),
            "CET" => Ok(FixedOffset::east_opt(1 * 3600).unwrap()),
            "CEST" => Ok(FixedOffset::east_opt(2 * 3600).unwrap()),
            "GMT" => Ok(FixedOffset::east_opt(0).unwrap()),
            "AEST" => Ok(FixedOffset::east_opt(10 * 3600).unwrap()),
            "AEDT" => Ok(FixedOffset::east_opt(11 * 3600).unwrap()),
            s if s.starts_with('+') || s.starts_with('-') => {
                let sign = if s.starts_with('-') { -1 } else { 1 };
                let parts: Vec<&str> = s[1..].split(':').collect();
                let hours: i32 = parts.get(0).and_then(|h| h.parse().ok()).unwrap_or(0);
                let mins: i32 = parts.get(1).and_then(|m| m.parse().ok()).unwrap_or(0);
                let offset_secs = sign * (hours * 3600 + mins * 60);
                if sign > 0 {
                    FixedOffset::east_opt(offset_secs)
                } else {
                    FixedOffset::west_opt(-offset_secs)
                }
                .ok_or_else(|| format!("Invalid offset: {}", s))
            }
            _ => Err(format!(
                "Unknown timezone: {}. Use UTC, EST, PST, or offset like +05:30",
                tz
            )),
        }
    }

    let from_offset = parse_offset(&from_tz)?;
    let to_offset = parse_offset(&to_tz)?;

    // Parse the datetime
    let naive = NaiveDateTime::parse_from_str(&datetime, "%Y-%m-%d %H:%M:%S")
        .or_else(|_| NaiveDateTime::parse_from_str(&datetime, "%Y-%m-%d %H:%M"))
        .map_err(|_| "Could not parse datetime. Use format: 2024-01-15 14:30:00")?;

    let from_dt = from_offset
        .from_local_datetime(&naive)
        .single()
        .ok_or_else(|| "Ambiguous datetime".to_string())?;

    let to_dt = from_dt.with_timezone(&to_offset);

    Ok(to_dt.format("%Y-%m-%d %H:%M:%S %:z").to_string())
}

#[tauri::command]
fn get_current_timestamp(as_ms: Option<bool>) -> String {
    use chrono::Utc;

    if as_ms.unwrap_or(false) {
        Utc::now().timestamp_millis().to_string()
    } else {
        Utc::now().timestamp().to_string()
    }
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
            is_dev: cache.is_dev,
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
fn get_cached_license_key_cmd() -> Option<String> {
    get_cached_license_key()
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
async fn create_customer_portal_session_cmd() -> Result<String, String> {
    let cache = load_license_cache().map_err(|e| e.to_string())?;
    let license_key = cache
        .license_key
        .ok_or_else(|| "No active license key found".to_string())?;
    let email = cache
        .email
        .ok_or_else(|| "No active license email found".to_string())?;
    let device_id = get_device_id().map_err(|e| e.to_string())?;

    create_customer_portal_session(&license_key, &email, &device_id)
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

fn open_with_system_handler(url: &str) -> Result<(), String> {
    let trimmed = url.trim();

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", trimmed])
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(trimmed)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {}", e))?;
    }

    Ok(())
}

fn is_allowed_https_host(url: &str, allowed_hosts: &[&str]) -> bool {
    let trimmed = url.trim();
    if !trimmed.to_ascii_lowercase().starts_with("https://") {
        return false;
    }

    let rest = &trimmed[8..];
    let host_port = rest
        .split('/')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    let host = host_port.split(':').next().unwrap_or("");

    allowed_hosts.iter().any(|allowed| host == *allowed)
}

#[tauri::command]
fn open_github_url(url: String) -> Result<(), String> {
    if !is_allowed_https_host(&url, &["github.com", "gist.github.com"]) {
        return Err("Blocked URL host for GitHub open operation.".to_string());
    }
    open_with_system_handler(&url)
}

#[tauri::command]
fn open_obsidian_url(url: String) -> Result<(), String> {
    if !url.trim().to_ascii_lowercase().starts_with("obsidian://") {
        return Err("Blocked URL scheme for Obsidian open operation.".to_string());
    }
    open_with_system_handler(&url)
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
async fn check_for_app_updates(app: AppHandle) -> Result<UpdateInfo, String> {
    check_for_updates(app).await
}

#[tauri::command]
async fn download_and_install_update(app: AppHandle) -> Result<(), String> {
    do_update(app).await
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

// Dictation commands.
//
// start_dictation blocks with a short timeout so the sendAction has time to
// execute on the main thread (fully non-blocking caused the action to fire
// too late in dev mode), but won't deadlock if the dictation UI initialisation
// holds the main thread.
//
// stop_dictation is non-blocking: it schedules all stop approaches on the
// main thread and returns immediately.
#[cfg(target_os = "macos")]
#[tauri::command]
#[allow(deprecated)]
fn start_dictation(app_handle: tauri::AppHandle) -> Result<(), String> {
    use objc::{msg_send, sel, sel_impl, class};
    use cocoa::base::{id, nil};
    use std::sync::mpsc;
    use std::time::Duration;
    let (tx, rx) = mpsc::channel();
    app_handle.run_on_main_thread(move || {
        unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            let key_window: id = msg_send![app, keyWindow];
            if key_window.is_null() {
                log::warn!("start_dictation: no key window");
                let _ = tx.send(());
                return;
            }

            // The default first responder is WryWebView (Wry's WKWebView wrapper),
            // which does NOT implement NSTextInputClient.  macOS dictation requires
            // the actual WKContentView — the internal WebKit view that handles text
            // input, composition, and dictation.  We walk the view tree to find it,
            // promote it to first responder, then start dictation on it.
            let content_view: id = msg_send![key_window, contentView];
            if let Some(wk_content) = find_wk_content_view(content_view) {
                let _: bool = msg_send![key_window, makeFirstResponder: wk_content];
                let _: () = msg_send![wk_content, startDictation: nil];
                log::info!("start_dictation: started on WKContentView");
            } else {
                // Fallback: send through the responder chain as before.
                let _: bool = msg_send![app, sendAction: sel!(startDictation:) to: nil from: nil];
                log::warn!("start_dictation: WKContentView not found, used sendAction fallback");
            }
        }
        let _ = tx.send(());
    }).map_err(|e| e.to_string())?;
    let _ = rx.recv_timeout(Duration::from_millis(500));
    Ok(())
}



#[cfg(target_os = "macos")]
#[tauri::command]
#[allow(deprecated)]
fn stop_dictation(_window: tauri::WebviewWindow, app_handle: tauri::AppHandle) -> Result<(), String> {
    use objc::{msg_send, sel, sel_impl, class};
    use cocoa::base::{id, nil};
    use std::sync::mpsc;
    use std::time::Duration;

    let (tx, rx) = mpsc::channel();
    app_handle.run_on_main_thread(move || {
        unsafe {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            let key_window: id = msg_send![app, keyWindow];
            if key_window == nil {
                let _ = tx.send(());
                return;
            }

            // Discard in-progress marked (composition) text so partial dictation
            // isn't committed into the editor.
            let input_context: id = msg_send![class!(NSTextInputContext), currentInputContext];
            if !input_context.is_null() {
                let _: () = msg_send![input_context, discardMarkedText];
            }

            // Resign first responder — macOS dictation stops when the text input
            // target loses first responder status. Using nil makes the window itself
            // the first responder. The frontend restores editor focus after a brief
            // delay via .focus() on the contenteditable element.
            let _: bool = msg_send![key_window, makeFirstResponder: nil];

            log::info!("stop_dictation: discarded marked text and resigned first responder");
        }
        let _ = tx.send(());
    }).map_err(|e| e.to_string())?;

    let _ = rx.recv_timeout(Duration::from_millis(500));

    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn start_dictation() -> Result<(), String> {
    Err("Dictation is only available on macOS".to_string())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn stop_dictation() -> Result<(), String> {
    Err("Dictation is only available on macOS".to_string())
}

// Window commands
#[tauri::command]
async fn toggle_fullscreen(window: tauri::Window) -> Result<(), String> {
    let is_fullscreen = window.is_fullscreen().map_err(|e| e.to_string())?;
    window.set_fullscreen(!is_fullscreen).map_err(|e| e.to_string())?;
    Ok(())
}

/// Stored frame for focus mode restoration (main thread only)
#[cfg(target_os = "macos")]
static FOCUS_MODE_ORIGINAL_FRAME: std::sync::Mutex<Option<(f64, f64, f64, f64)>> = std::sync::Mutex::new(None);
#[cfg(target_os = "macos")]
static FOCUS_MODE_ACTIVE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Toggle focus mode - maximizes window to fill screen without using native fullscreen
/// This works with NSPanel on macOS where setFullscreen crashes
#[cfg(target_os = "macos")]
#[tauri::command]
#[allow(deprecated)]
async fn toggle_focus_mode(window: tauri::WebviewWindow) -> Result<bool, String> {
    use cocoa::base::id;
    use cocoa::foundation::{NSPoint, NSRect, NSSize};
    use objc::{msg_send, sel, sel_impl};
    use std::sync::mpsc;
    use std::time::Duration;

    let (tx, rx) = mpsc::channel();
    let app_handle = window.app_handle().clone();
    let app_handle_inner = app_handle.clone();

    app_handle
        .run_on_main_thread(move || {
            let result: Result<bool, String> = (|| {
                let panel = app_handle_inner
                    .get_webview_panel(MAIN_WINDOW_LABEL)
                    .map_err(|e| format!("Failed to get panel: {:?}", e))?;

                let ns_panel = panel.as_panel();
                let current_frame = ns_panel.frame();
                let is_focus_mode = FOCUS_MODE_ACTIVE.load(std::sync::atomic::Ordering::SeqCst);

                if is_focus_mode {
                    // Restore original frame
                    if let Some((x, y, w, h)) = FOCUS_MODE_ORIGINAL_FRAME.lock().unwrap().take() {
                        let restore_frame = NSRect {
                            origin: NSPoint { x, y },
                            size: NSSize { width: w, height: h },
                        };
                        // NSRect and CGRect are ABI-compatible, use transmute
                        unsafe {
                            ns_panel.setFrame_display(std::mem::transmute(restore_frame), true);
                        }
                        log::info!("Restored original frame");
                    }
                    FOCUS_MODE_ACTIVE.store(false, std::sync::atomic::Ordering::SeqCst);
                    Ok(false)
                } else {
                    // Save current frame
                    *FOCUS_MODE_ORIGINAL_FRAME.lock().unwrap() = Some((
                        current_frame.origin.x,
                        current_frame.origin.y,
                        current_frame.size.width,
                        current_frame.size.height,
                    ));

                    // Get the screen that contains the window
                    unsafe {
                        let raw_panel: id = std::mem::transmute_copy(&ns_panel);
                        let screen: id = msg_send![raw_panel, screen];

                        if screen.is_null() {
                            return Err("Failed to get screen".to_string());
                        }

                        // Get the visible frame (excludes menu bar and dock)
                        let visible_frame: NSRect = msg_send![screen, visibleFrame];

                        // NSRect and CGRect are ABI-compatible, use transmute
                        ns_panel.setFrame_display(std::mem::transmute(visible_frame), true);
                        log::info!("Expanded to fill screen: ({}, {}) {}x{}",
                            visible_frame.origin.x, visible_frame.origin.y,
                            visible_frame.size.width, visible_frame.size.height);
                    }

                    FOCUS_MODE_ACTIVE.store(true, std::sync::atomic::Ordering::SeqCst);
                    Ok(true)
                }
            })();
            let _ = tx.send(result);
        })
        .map_err(|e| e.to_string())?;

    rx.recv_timeout(Duration::from_secs(5))
        .map_err(|e| format!("Timeout: {}", e))?
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn toggle_focus_mode(window: tauri::WebviewWindow) -> Result<bool, String> {
    // On non-macOS, use the standard maximize/unmaximize
    let is_maximized = window.is_maximized().map_err(|e| e.to_string())?;
    if is_maximized {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
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

                // Re-apply macOS native text-service suppression after panel focus/show,
                // as some AppKit text settings can be restored when focus changes.
                if let Err(e) = disable_webview_spellcheck(&webview_window) {
                    log::warn!("Failed to disable webview text services on show: {:?}", e);
                }

                panel.show_and_make_key();

                // Re-apply once again immediately after show. Some WebKit/AppKit
                // text-service flags are only effective once the view is key.
                if let Err(e) = disable_webview_spellcheck(&webview_window) {
                    log::warn!("Failed to disable webview text services after show: {:?}", e);
                }

                // Promote WKContentView to first responder so that macOS system
                // dictation (Fn-Fn / Globe key) targets the correct text input
                // view instead of the WryWebView wrapper.
                promote_wk_content_view_to_first_responder(&webview_window);

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
                        // Use window's actual position, not cursor position
                        if let Some(webview_window) = app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                            if let Some(monitor_name) = get_window_monitor_name(&webview_window) {
                                if let Err(e) = webview_window.save_position_for_current_monitor(&monitor_name) {
                                    log::warn!("Failed to save position on hide: {:?}", e);
                                } else {
                                    log::info!("Saved position for {} before hiding (window position)", monitor_name);
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
                        // Use window's actual position, not cursor position
                        if let Some(webview_window) = app_handle_inner.get_webview_window(MAIN_WINDOW_LABEL) {
                            if let Some(monitor_name) = get_window_monitor_name(&webview_window) {
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

// Custom transformations commands
#[tauri::command]
fn get_custom_transformations() -> Result<CustomTransformationsData, String> {
    load_custom_transformations().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_custom_transformations_cmd(data: CustomTransformationsData) -> Result<(), String> {
    save_custom_transformations(&data).map_err(|e| e.to_string())
}

// Transformation chains commands
#[tauri::command]
fn get_transformation_chains() -> Result<TransformationChainsData, String> {
    load_transformation_chains().map_err(|e| e.to_string())
}

#[tauri::command]
fn save_transformation_chains_cmd(data: TransformationChainsData) -> Result<(), String> {
    save_transformation_chains(&data).map_err(|e| e.to_string())
}

// Save file dialog command
fn get_file_filter(language: &str) -> (&'static str, &'static [&'static str]) {
    match language {
        "javascript" => ("JavaScript", &["js"]),
        "typescript" => ("TypeScript", &["ts"]),
        "jsx" => ("JSX", &["jsx"]),
        "tsx" => ("TSX", &["tsx"]),
        "html" => ("HTML", &["html", "htm"]),
        "css" => ("CSS", &["css"]),
        "json" => ("JSON", &["json"]),
        "sql" => ("SQL", &["sql"]),
        "yaml" => ("YAML", &["yaml", "yml"]),
        "xml" => ("XML", &["xml"]),
        "bash" => ("Shell Script", &["sh", "bash"]),
        "python" => ("Python", &["py"]),
        "java" => ("Java", &["java"]),
        "go" => ("Go", &["go"]),
        "php" => ("PHP", &["php"]),
        "c" => ("C", &["c", "h"]),
        "cpp" => ("C++", &["cpp", "hpp", "cc"]),
        "rust" => ("Rust", &["rs"]),
        "ruby" => ("Ruby", &["rb"]),
        "swift" => ("Swift", &["swift"]),
        "kotlin" => ("Kotlin", &["kt", "kts"]),
        "csharp" => ("C#", &["cs"]),
        "markdown" => ("Markdown", &["md"]),
        _ => ("Text", &["txt"]),
    }
}

#[tauri::command]
async fn save_file_dialog(content: String, file_type: Option<String>) -> Result<Option<String>, String> {
    use rfd::AsyncFileDialog;

    // Set flag to prevent panel from hiding when dialog takes focus
    #[cfg(target_os = "macos")]
    {
        window::DIALOG_OPEN.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    let (filter_name, extensions) = get_file_filter(file_type.as_deref().unwrap_or("plaintext"));

    let file = AsyncFileDialog::new()
        .add_filter(filter_name, extensions)
        .add_filter("All Files", &["*"])
        .save_file()
        .await;

    // Clear the flag after dialog closes
    #[cfg(target_os = "macos")]
    {
        window::DIALOG_OPEN.store(false, std::sync::atomic::Ordering::SeqCst);
    }

    if let Some(handle) = file {
        let path = handle.path();
        std::fs::write(path, content).map_err(|e| e.to_string())?;
        Ok(Some(path.to_string_lossy().to_string()))
    } else {
        Ok(None) // User cancelled
    }
}

// Simple UUID v4 generator (using uuid crate)
fn uuid_v4() -> String {
    uuid::Uuid::new_v4().to_string()
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
            set_snippet_github_info,
            clear_snippet_github_info,
            // Custom AI Prompts
            get_custom_ai_prompts,
            save_custom_ai_prompts_data,
            add_custom_ai_prompt,
            update_custom_ai_prompt,
            delete_custom_ai_prompt,
            toggle_custom_ai_prompt_enabled,
            // Custom transformations
            get_custom_transformations,
            save_custom_transformations_cmd,
            // Transformation chains
            get_transformation_chains,
            save_transformation_chains_cmd,
            // Save file dialog
            save_file_dialog,
            // Text utilities
            get_text_stats,
            transform_text_cmd,
            count_pattern_occurrences,
            // Native clipboard
            write_native_clipboard,
            copy_file_to_clipboard,
            // Code formatting
            detect_language,
            format_code,
            minify_code,
            // JSON/XML formatting (legacy)
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
            generate_uuid_v7,
            generate_nanoid,
            generate_short_hash,
            generate_prefixed_id,
            generate_bulk,
            generate_lorem_ipsum,
            // Timestamps
            unix_to_human,
            human_to_unix,
            convert_timezone,
            get_current_timestamp,
            // Hash generators
            generate_md5,
            generate_sha1,
            generate_sha256,
            generate_sha512,
            // License
            activate_license,
            deactivate_license,
            get_license_status,
            get_cached_license_key_cmd,
            check_feature_enabled,
            refresh_license_status,
            // Premium
            validate_premium_license_cmd,
            get_ai_usage_cmd,
            create_customer_portal_session_cmd,
            call_ai_feature_cmd,
            // Obsidian
            get_obsidian_config,
            configure_obsidian,
            validate_obsidian_vault_cmd,
            add_to_obsidian,
            open_obsidian_url,
            open_github_url,
            // GitHub
            start_github_device_flow,
            poll_github_device_flow,
            check_github_auth_status,
            create_github_gist,
            list_wingman_gists,
            update_github_gist,
            delete_github_gist,
            logout_github,
            get_github_config,
            save_github_config,
            // AI
            get_ai_config,
            configure_ai,
            get_ai_presets,
            save_ai_presets_cmd,
            // Dictation
            start_dictation,
            stop_dictation,
            // Window
            show_window,
            hide_window,
            hide_and_paste,
            toggle_fullscreen,
            toggle_focus_mode,
            set_window_blur_cmd,
            set_vibrancy_mode,
            #[cfg(target_os = "macos")]
            update_panel_behavior,
            // Dialogs
            pick_folder,
            // Updates
            check_for_app_updates,
            download_and_install_update,
            get_app_version,
            // Secure credentials
            store_credential,
            get_credential,
            delete_credential,
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

                    // Disable native WKWebView spellcheck so macOS doesn't draw
                    // red underlines in the code editor in packaged builds.
                    if let Err(e) = disable_webview_spellcheck(&window) {
                        log::warn!("Failed to disable webview spellcheck: {:?}", e);
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
