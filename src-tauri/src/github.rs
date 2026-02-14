use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use keyring::Entry;

// GitHub OAuth Client ID (from GitHub App registration)
// TODO: Replace with your actual Client ID after registering the GitHub App
const GITHUB_CLIENT_ID: &str = "Iv23liEWBm84xdG4FROh";
const KEYRING_SERVICE_NAME: &str = "com.wingman.app";
const KEYRING_GITHUB_ACCOUNT: &str = "github_access_token";
const WINGMAN_GIST_MARKER: &str = "[Wingman]";

// ============================================================================
// Error Types
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum GitHubError {
    #[error("Network error: {0}")]
    Network(#[from] reqwest::Error),

    #[error("Failed to save token: {0}")]
    TokenSave(String),

    #[error("Failed to load token: {0}")]
    TokenLoad(String),

    #[error("Not authenticated. Please authorize GitHub in Settings.")]
    NotAuthenticated,

    #[error("Token has been revoked. Please re-authorize in Settings.")]
    TokenRevoked,

    #[error("Rate limit exceeded. Try again later.")]
    RateLimit,

    #[error("Invalid content: {0}")]
    InvalidContent(String),

    #[error("GitHub API error: {0}")]
    ApiError(String),

    #[error("Device flow authorization timed out")]
    AuthTimeout,

    #[error("Device flow authorization pending")]
    AuthPending,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

// ============================================================================
// Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubConfig {
    pub is_authenticated: bool,
    pub username: Option<String>,
    pub default_public: bool,
    pub auto_copy_url: bool,
}

impl Default for GitHubConfig {
    fn default() -> Self {
        Self {
            is_authenticated: false,
            username: None,
            default_public: false, // Private by default (safer)
            auto_copy_url: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceFlowStart {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: u32,
    pub interval: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubAuthStatus {
    pub is_authenticated: bool,
    pub username: Option<String>,
    pub scopes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GistResult {
    pub gist_id: String,
    pub url: String,
    pub html_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WingmanGist {
    pub gist_id: String,
    pub url: String,
    pub html_url: String,
    pub description: String,
    pub filename: String,
    pub content: String,
    pub updated_at: String,
    pub is_public: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GitHubToken {
    access_token: String,
    created_at: String,
}

// ============================================================================
// Storage Paths
// ============================================================================

fn get_app_data_dir() -> Result<PathBuf, GitHubError> {
    let app_data_dir = dirs::data_dir()
        .ok_or_else(|| GitHubError::Io(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Could not find app data directory"
        )))?
        .join("Wingman");

    // Create directory if it doesn't exist
    if !app_data_dir.exists() {
        fs::create_dir_all(&app_data_dir)?;
    }

    Ok(app_data_dir)
}

fn get_token_path() -> Result<PathBuf, GitHubError> {
    Ok(get_app_data_dir()?.join("github_token.json"))
}

fn get_config_path() -> Result<PathBuf, GitHubError> {
    Ok(get_app_data_dir()?.join("github_config.json"))
}

fn get_legacy_app_data_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|p| p.join("com.wingman.app"))
}

fn get_legacy_token_path() -> Option<PathBuf> {
    get_legacy_app_data_dir().map(|dir| dir.join("github_token.json"))
}

fn get_legacy_config_path() -> Option<PathBuf> {
    get_legacy_app_data_dir().map(|dir| dir.join("github_config.json"))
}

// ============================================================================
// Token Storage
// ============================================================================

fn get_keyring_entry() -> Result<Entry, GitHubError> {
    Entry::new(KEYRING_SERVICE_NAME, KEYRING_GITHUB_ACCOUNT)
        .map_err(|e| GitHubError::TokenSave(format!("Failed to create keyring entry: {}", e)))
}

fn save_token_to_file(access_token: &str) -> Result<(), GitHubError> {
    let token = GitHubToken {
        access_token: access_token.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    let json = serde_json::to_string_pretty(&token)?;
    let primary_path = get_token_path()?;
    fs::write(&primary_path, &json).map_err(|e| GitHubError::TokenSave(e.to_string()))?;

    // Best-effort write to legacy config directory for compatibility with older builds.
    if let Some(legacy_dir) = get_legacy_app_data_dir() {
        let _ = fs::create_dir_all(&legacy_dir);
        let _ = fs::write(legacy_dir.join("github_token.json"), &json);
    }

    Ok(())
}

fn load_token_from_file() -> Result<String, GitHubError> {
    let mut candidate_paths = vec![get_token_path()?];
    if let Some(legacy) = get_legacy_token_path() {
        if !candidate_paths.contains(&legacy) {
            candidate_paths.push(legacy);
        }
    }

    for token_path in candidate_paths {
        if !token_path.exists() {
            continue;
        }
        let json = fs::read_to_string(&token_path).map_err(|e| GitHubError::TokenLoad(e.to_string()))?;
        let token: GitHubToken = serde_json::from_str(&json)?;
        return Ok(token.access_token);
    }

    Err(GitHubError::NotAuthenticated)
}

pub fn save_token(access_token: &str) -> Result<(), GitHubError> {
    // Primary: OS keychain
    if let Ok(entry) = get_keyring_entry() {
        if entry.set_password(access_token).is_ok() {
            // Also persist fallback file in case keychain access fails on future launches.
            save_token_to_file(access_token)?;
            return Ok(());
        }
    }

    // Fallback for environments where keyring is unavailable
    save_token_to_file(access_token)
}

pub fn load_token() -> Result<String, GitHubError> {
    // Primary: OS keychain
    if let Ok(entry) = get_keyring_entry() {
        match entry.get_password() {
            Ok(token) => return Ok(token),
            Err(keyring::Error::NoEntry) => {}
            Err(_) => {}
        }
    }

    // Fallback: legacy plaintext file
    let token = load_token_from_file()?;

    // Best-effort migration back into keychain when possible
    if let Ok(entry) = get_keyring_entry() {
        let _ = entry.set_password(&token);
    }

    Ok(token)
}

pub fn delete_token() -> Result<(), GitHubError> {
    // Best effort keychain cleanup
    if let Ok(entry) = get_keyring_entry() {
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(e) => return Err(GitHubError::TokenSave(e.to_string())),
        }
    }

    // Remove legacy token file if present
    let token_path = get_token_path()?;
    if token_path.exists() {
        fs::remove_file(&token_path)?;
    }
    if let Some(legacy_token_path) = get_legacy_token_path() {
        if legacy_token_path.exists() {
            let _ = fs::remove_file(legacy_token_path);
        }
    }

    Ok(())
}

// ============================================================================
// Config Storage
// ============================================================================

pub fn save_config(config: &GitHubConfig) -> Result<(), GitHubError> {
    let json = serde_json::to_string_pretty(config)?;
    let config_path = get_config_path()?;
    fs::write(&config_path, &json)?;

    // Best-effort write to legacy config directory for compatibility.
    if let Some(legacy_dir) = get_legacy_app_data_dir() {
        let _ = fs::create_dir_all(&legacy_dir);
        let _ = fs::write(legacy_dir.join("github_config.json"), &json);
    }

    Ok(())
}

pub fn load_config() -> Result<GitHubConfig, GitHubError> {
    let mut candidate_paths = vec![get_config_path()?];
    if let Some(legacy) = get_legacy_config_path() {
        if !candidate_paths.contains(&legacy) {
            candidate_paths.push(legacy);
        }
    }

    for config_path in candidate_paths {
        if !config_path.exists() {
            continue;
        }
        let json = fs::read_to_string(&config_path)?;
        let config: GitHubConfig = serde_json::from_str(&json)?;
        return Ok(config);
    }

    Ok(GitHubConfig::default())
}

// ============================================================================
// GitHub API Response Types (Internal)
// ============================================================================

#[derive(Debug, Deserialize)]
struct DeviceFlowResponse {
    device_code: String,
    user_code: String,
    verification_uri: String,
    expires_in: u32,
    interval: u32,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct TokenResponse {
    access_token: Option<String>,
    token_type: Option<String>,
    scope: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
    error_uri: Option<String>,
    interval: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct GitHubUser {
    login: String,
}

#[derive(Debug, Deserialize)]
struct GistResponse {
    id: String,
    url: String,
    html_url: String,
}

#[derive(Debug, Deserialize)]
struct GistSummaryResponse {
    id: String,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GistDetailResponse {
    id: String,
    url: String,
    html_url: String,
    description: Option<String>,
    updated_at: String,
    #[serde(rename = "public")]
    is_public: bool,
    files: HashMap<String, GistFileDetail>,
}

#[derive(Debug, Deserialize)]
struct GistFileDetail {
    filename: Option<String>,
    content: Option<String>,
}

// ============================================================================
// GitHub OAuth Implementation
// ============================================================================

async fn start_device_flow_internal() -> Result<DeviceFlowStart, GitHubError> {
    // Validate Client ID is configured
    if GITHUB_CLIENT_ID == "YOUR_GITHUB_CLIENT_ID" || GITHUB_CLIENT_ID.is_empty() {
        return Err(GitHubError::ApiError(
            "GitHub Client ID not configured. Please register a GitHub OAuth App and update the Client ID in github.rs".to_string()
        ));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    // GitHub expects form data, not JSON
    let params = [
        ("client_id", GITHUB_CLIENT_ID),
        ("scope", "gist"),
    ];

    let response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .header("User-Agent", "Wingman-Desktop")
        .form(&params)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                GitHubError::Network(e)
            } else if e.is_connect() {
                GitHubError::ApiError("Failed to connect to GitHub. Please check your internet connection.".to_string())
            } else {
                GitHubError::Network(e)
            }
        })?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(GitHubError::ApiError(format!(
            "Failed to start device flow ({}): {}",
            status.as_u16(),
            text
        )));
    }

    let flow_response: DeviceFlowResponse = response.json().await.map_err(|e| {
        GitHubError::ApiError(format!("Failed to parse GitHub response: {}", e))
    })?;

    Ok(DeviceFlowStart {
        device_code: flow_response.device_code,
        user_code: flow_response.user_code,
        verification_uri: flow_response.verification_uri,
        expires_in: flow_response.expires_in,
        interval: flow_response.interval,
    })
}

async fn poll_device_flow_internal(device_code: &str) -> Result<Option<GitHubAuthStatus>, GitHubError> {
    println!("[GitHub Poll] Polling with device_code: {}...", &device_code[..8.min(device_code.len())]);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    // GitHub expects form data, not JSON for the token endpoint
    let params = [
        ("client_id", GITHUB_CLIENT_ID),
        ("device_code", device_code),
        ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
    ];

    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .header("User-Agent", "Wingman-Desktop")
        .form(&params)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() || e.is_connect() {
                GitHubError::ApiError("Connection timeout. Please check your internet connection.".to_string())
            } else {
                GitHubError::Network(e)
            }
        })?;

    let status = response.status();
    let response_text = response.text().await.unwrap_or_default();

    println!("[GitHub Poll] Status: {}, Response: {}", status, response_text);

    if !status.is_success() {
        return Err(GitHubError::ApiError(format!(
            "Failed to poll device flow ({}): {}",
            status.as_u16(),
            response_text
        )));
    }

    let token_response: TokenResponse = serde_json::from_str(&response_text).map_err(|e| {
        GitHubError::ApiError(format!("Failed to parse GitHub response: {} - Raw: {}", e, response_text))
    })?;

    // Check for errors
    if let Some(error) = &token_response.error {
        println!("[GitHub Poll] Error response: {} - {:?}", error, token_response.error_description);
        return match error.as_str() {
            "authorization_pending" => Err(GitHubError::AuthPending),
            "slow_down" => {
                // Return the interval so the frontend can slow down appropriately
                let interval = token_response.interval.unwrap_or(10);
                println!("[GitHub Poll] Slow down requested, new interval: {}s", interval);
                Err(GitHubError::ApiError(format!("slow_down:{}", interval)))
            }
            "expired_token" => Err(GitHubError::AuthTimeout),
            _ => Err(GitHubError::ApiError(format!("Device flow error: {}", error))),
        };
    }

    // Check for access token
    if let Some(access_token) = token_response.access_token {
        println!("[GitHub] Received access token, saving...");

        // Save token
        save_token(&access_token)?;
        println!("[GitHub] Token saved, fetching username...");

        // Get username
        let username = get_username_from_token(&access_token).await?;
        println!("[GitHub] Username retrieved: {}", username);

        // Update config
        let mut config = load_config()?;
        config.is_authenticated = true;
        config.username = Some(username.clone());
        save_config(&config)?;
        println!("[GitHub] Config saved, authentication complete!");

        Ok(Some(GitHubAuthStatus {
            is_authenticated: true,
            username: Some(username),
            scopes: vec!["gist".to_string()],
        }))
    } else {
        Ok(None)
    }
}

async fn get_username_from_token(token: &str) -> Result<String, GitHubError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let response = client
        .get("https://api.github.com/user")
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wingman-Desktop")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() {
                GitHubError::ApiError("Request timed out. Please check your internet connection.".to_string())
            } else if e.is_connect() {
                GitHubError::ApiError("Failed to connect to GitHub. Please check your internet connection.".to_string())
            } else {
                GitHubError::Network(e)
            }
        })?;

    if !response.status().is_success() {
        if response.status() == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GitHubError::TokenRevoked);
        }
        let status_code = response.status().as_u16();
        let text = response.text().await.unwrap_or_default();
        return Err(GitHubError::ApiError(format!(
            "Failed to get user info ({}): {}",
            status_code,
            text
        )));
    }

    let user: GitHubUser = response.json().await.map_err(|e| {
        GitHubError::ApiError(format!("Failed to parse user response: {}", e))
    })?;
    Ok(user.login)
}

async fn check_auth_status_internal() -> Result<GitHubAuthStatus, GitHubError> {
    // Try to load token
    let token = match load_token() {
        Ok(t) => t,
        Err(_) => {
            return Ok(GitHubAuthStatus {
                is_authenticated: false,
                username: None,
                scopes: vec![],
            });
        }
    };

    // Verify token by getting username
    match get_username_from_token(&token).await {
        Ok(username) => {
            // Update config with current auth status
            let mut config = load_config()?;
            config.is_authenticated = true;
            config.username = Some(username.clone());
            save_config(&config)?;

            Ok(GitHubAuthStatus {
                is_authenticated: true,
                username: Some(username),
                scopes: vec!["gist".to_string()],
            })
        }
        Err(GitHubError::TokenRevoked) => {
            // Token was revoked, clear it
            delete_token().ok();
            let mut config = load_config()?;
            config.is_authenticated = false;
            config.username = None;
            save_config(&config)?;

            Ok(GitHubAuthStatus {
                is_authenticated: false,
                username: None,
                scopes: vec![],
            })
        }
        Err(GitHubError::Network(_)) | Err(GitHubError::ApiError(_)) => {
            // Treat transient connectivity/API failures as "unknown but still authenticated"
            // if we have a saved token, so users don't need to re-auth every restart.
            let config = load_config().unwrap_or_default();
            Ok(GitHubAuthStatus {
                is_authenticated: true,
                username: config.username,
                scopes: vec!["gist".to_string()],
            })
        }
        Err(e) => Err(e),
    }
}

fn has_wingman_marker(description: &str) -> bool {
    description.to_lowercase().contains(&WINGMAN_GIST_MARKER.to_lowercase())
}

fn ensure_wingman_marker(description: &str) -> String {
    let trimmed = description.trim();
    if has_wingman_marker(trimmed) {
        return trimmed.to_string();
    }
    if trimmed.is_empty() {
        return format!("{} Created with Wingman", WINGMAN_GIST_MARKER);
    }
    format!("{} {}", WINGMAN_GIST_MARKER, trimmed)
}

fn github_authed_client() -> Result<(reqwest::Client, String), GitHubError> {
    let token = load_token()?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;
    Ok((client, token))
}

async fn get_gist_detail_internal(gist_id: &str) -> Result<GistDetailResponse, GitHubError> {
    let (client, token) = github_authed_client()?;
    let response = client
        .get(format!("https://api.github.com/gists/{}", gist_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wingman-Desktop")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GitHubError::TokenRevoked);
        }
        let body = response.text().await.unwrap_or_default();
        return Err(GitHubError::ApiError(format!(
            "Failed to load gist {} ({}): {}",
            gist_id,
            status.as_u16(),
            body
        )));
    }

    response
        .json::<GistDetailResponse>()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse gist response: {}", e)))
}

// ============================================================================
// Tauri Commands
// ============================================================================

#[tauri::command]
pub async fn start_github_device_flow() -> Result<DeviceFlowStart, String> {
    start_device_flow_internal()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn poll_github_device_flow(device_code: String) -> Result<Option<GitHubAuthStatus>, String> {
    match poll_device_flow_internal(&device_code).await {
        Ok(result) => Ok(result),
        Err(GitHubError::AuthPending) => Ok(None), // Still pending
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn check_github_auth_status() -> Result<GitHubAuthStatus, String> {
    check_auth_status_internal()
        .await
        .map_err(|e| e.to_string())
}

async fn create_gist_internal(
    content: &str,
    filename: &str,
    description: &str,
    is_public: bool,
) -> Result<GistResult, GitHubError> {
    // Validate content
    let trimmed_content = content.trim();
    if trimmed_content.is_empty() {
        return Err(GitHubError::InvalidContent(
            "Content cannot be empty".to_string(),
        ));
    }

    // Validate content length (GitHub gist limit is 10MB per file)
    const MAX_GIST_SIZE: usize = 10 * 1024 * 1024; // 10MB
    if content.len() > MAX_GIST_SIZE {
        return Err(GitHubError::InvalidContent(format!(
            "Content is too large ({} MB). Maximum size is 10 MB.",
            content.len() / (1024 * 1024)
        )));
    }

    // Validate filename
    if filename.trim().is_empty() {
        return Err(GitHubError::InvalidContent(
            "Filename cannot be empty".to_string(),
        ));
    }

    // Load token
    let token = load_token()?;

    let marked_description = ensure_wingman_marker(description);

    // Create gist payload
    let mut files = serde_json::Map::new();
    files.insert(
        filename.to_string(),
        serde_json::json!({
            "content": content
        }),
    );

    let payload = serde_json::json!({
        "description": marked_description,
        "public": is_public,
        "files": files
    });

    // Send request with retry logic for transient failures
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()?;

    let mut attempts = 0;
    const MAX_ATTEMPTS: u32 = 3;

    let response = loop {
        attempts += 1;

        match client
            .post("https://api.github.com/gists")
            .header("Authorization", format!("Bearer {}", token))
            .header("Accept", "application/vnd.github+json")
            .header("User-Agent", "Wingman-Desktop")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .json(&payload)
            .send()
            .await
        {
            Ok(resp) => break resp,
            Err(e) => {
                // Retry on network errors, but not on other errors
                if attempts >= MAX_ATTEMPTS || !e.is_timeout() && !e.is_connect() {
                    return Err(GitHubError::Network(e));
                }
                // Wait before retrying (exponential backoff)
                tokio::time::sleep(std::time::Duration::from_millis(500 * attempts as u64)).await;
            }
        }
    };

    // Handle response
    if !response.status().is_success() {
        let status = response.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GitHubError::TokenRevoked);
        } else if status == reqwest::StatusCode::FORBIDDEN {
            // Check if it's a rate limit error
            let text = response.text().await.unwrap_or_default();
            if text.contains("rate limit") || text.contains("API rate limit") {
                return Err(GitHubError::RateLimit);
            }
            return Err(GitHubError::ApiError(format!(
                "Access forbidden. Your GitHub token may lack gist permissions: {}",
                text
            )));
        } else if status == reqwest::StatusCode::UNPROCESSABLE_ENTITY {
            let text = response.text().await.unwrap_or_default();
            return Err(GitHubError::InvalidContent(format!(
                "Invalid gist content: {}",
                text
            )));
        } else if status.is_server_error() {
            return Err(GitHubError::ApiError(format!(
                "GitHub server error ({}). Please try again later.",
                status.as_u16()
            )));
        } else {
            let text = response.text().await.unwrap_or_default();
            return Err(GitHubError::ApiError(format!(
                "Failed to create gist ({}): {}",
                status.as_u16(),
                text
            )));
        }
    }

    let gist_response: GistResponse = response.json().await.map_err(|e| {
        GitHubError::ApiError(format!("Failed to parse GitHub response: {}", e))
    })?;

    Ok(GistResult {
        gist_id: gist_response.id,
        url: gist_response.url,
        html_url: gist_response.html_url,
    })
}

#[tauri::command]
pub async fn create_github_gist(
    content: String,
    filename: String,
    description: String,
    is_public: bool,
) -> Result<GistResult, String> {
    create_gist_internal(&content, &filename, &description, is_public)
        .await
        .map_err(|e| e.to_string())
}

async fn list_wingman_gists_internal() -> Result<Vec<WingmanGist>, GitHubError> {
    let (client, token) = github_authed_client()?;
    let response = client
        .get("https://api.github.com/gists?per_page=100")
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wingman-Desktop")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GitHubError::TokenRevoked);
        }
        let body = response.text().await.unwrap_or_default();
        return Err(GitHubError::ApiError(format!(
            "Failed to list gists ({}): {}",
            status.as_u16(),
            body
        )));
    }

    let summaries = response
        .json::<Vec<GistSummaryResponse>>()
        .await
        .map_err(|e| GitHubError::ApiError(format!("Failed to parse gists response: {}", e)))?;

    let mut wingman_gists = Vec::new();
    for summary in summaries {
        let description = summary.description.unwrap_or_default();
        if !has_wingman_marker(&description) {
            continue;
        }

        let detail = get_gist_detail_internal(&summary.id).await?;
        let Some((fallback_filename, file)) = detail.files.iter().next() else {
            continue;
        };

        let filename = file
            .filename
            .as_ref()
            .filter(|name| !name.trim().is_empty())
            .cloned()
            .unwrap_or_else(|| fallback_filename.to_string());

        let content = file.content.clone().unwrap_or_default();

        wingman_gists.push(WingmanGist {
            gist_id: detail.id,
            url: detail.url,
            html_url: detail.html_url,
            description: detail.description.unwrap_or_default(),
            filename,
            content,
            updated_at: detail.updated_at,
            is_public: detail.is_public,
        });
    }

    Ok(wingman_gists)
}

async fn update_gist_internal(
    gist_id: &str,
    content: &str,
    filename: Option<&str>,
    description: Option<&str>,
) -> Result<GistResult, GitHubError> {
    let content = content.trim();
    if content.is_empty() {
        return Err(GitHubError::InvalidContent("Content cannot be empty".to_string()));
    }

    let existing = get_gist_detail_internal(gist_id).await?;
    let existing_description = existing.description.clone().unwrap_or_default();
    let updated_description = ensure_wingman_marker(description.unwrap_or(&existing_description));

    let resolved_filename = if let Some(name) = filename {
        name.trim().to_string()
    } else if let Some((existing_name, file)) = existing.files.iter().next() {
        file.filename
            .as_ref()
            .filter(|name| !name.trim().is_empty())
            .cloned()
            .unwrap_or_else(|| existing_name.to_string())
    } else {
        "wingman_gist.txt".to_string()
    };

    let mut files = serde_json::Map::new();
    files.insert(
        resolved_filename,
        serde_json::json!({
            "content": content
        }),
    );

    let payload = serde_json::json!({
        "description": updated_description,
        "files": files
    });

    let (client, token) = github_authed_client()?;
    let response = client
        .patch(format!("https://api.github.com/gists/{}", gist_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wingman-Desktop")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .json(&payload)
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(GitHubError::TokenRevoked);
        }
        let body = response.text().await.unwrap_or_default();
        return Err(GitHubError::ApiError(format!(
            "Failed to update gist {} ({}): {}",
            gist_id,
            status.as_u16(),
            body
        )));
    }

    let gist_response: GistResponse = response.json().await.map_err(|e| {
        GitHubError::ApiError(format!("Failed to parse GitHub response: {}", e))
    })?;

    Ok(GistResult {
        gist_id: gist_response.id,
        url: gist_response.url,
        html_url: gist_response.html_url,
    })
}

async fn delete_gist_internal(gist_id: &str) -> Result<(), GitHubError> {
    let (client, token) = github_authed_client()?;
    let response = client
        .delete(format!("https://api.github.com/gists/{}", gist_id))
        .header("Authorization", format!("Bearer {}", token))
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", "Wingman-Desktop")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .send()
        .await?;

    if response.status().is_success() || response.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(());
    }

    let status = response.status();
    if status == reqwest::StatusCode::UNAUTHORIZED {
        return Err(GitHubError::TokenRevoked);
    }
    let body = response.text().await.unwrap_or_default();
    Err(GitHubError::ApiError(format!(
        "Failed to delete gist {} ({}): {}",
        gist_id,
        status.as_u16(),
        body
    )))
}

#[tauri::command]
pub async fn list_wingman_gists() -> Result<Vec<WingmanGist>, String> {
    list_wingman_gists_internal()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_github_gist(
    gist_id: String,
    content: String,
    filename: Option<String>,
    description: Option<String>,
) -> Result<GistResult, String> {
    update_gist_internal(
        &gist_id,
        &content,
        filename.as_deref(),
        description.as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_github_gist(gist_id: String) -> Result<(), String> {
    delete_gist_internal(&gist_id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn logout_github() -> Result<(), String> {
    delete_token().map_err(|e| e.to_string())?;

    // Update config to mark as not authenticated
    let mut config = load_config().map_err(|e| e.to_string())?;
    config.is_authenticated = false;
    config.username = None;
    save_config(&config).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_github_config() -> Result<GitHubConfig, String> {
    load_config().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_github_config(config: GitHubConfig) -> Result<(), String> {
    save_config(&config).map_err(|e| e.to_string())
}
