//! Premium subscription module for Wingman
//!
//! Handles Premium subscription validation, AI feature proxy calls,
//! token usage tracking, and Obsidian integration.

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

// Supabase configuration
const SUPABASE_URL: &str = "https://yhpetdqcmqpfwhdtbhat.supabase.co";
const SUPABASE_PUBLISHABLE_KEY: &str = "sb_publishable_t4l4DUhI_I2rpT9pMU8dgg_Y2j55oJY";

// Token limit for Premium tier
const MONTHLY_TOKEN_LIMIT: i64 = 1_000_000;

#[derive(Debug, Error)]
pub enum PremiumError {
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Invalid license")]
    InvalidLicense,
    #[error("Premium subscription required")]
    PremiumRequired,
    #[error("Subscription expired")]
    SubscriptionExpired,
    #[error("Token limit exceeded: {0}")]
    TokenLimitExceeded(String),
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("AI service error: {0}")]
    AIServiceError(String),
    #[error("Obsidian error: {0}")]
    ObsidianError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
}

/// Subscription status for a Premium user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionStatus {
    pub tier: String,           // "free", "pro", or "premium"
    pub is_active: bool,        // Whether subscription is currently active
    pub expires_at: Option<String>, // ISO 8601 timestamp of current period end
    pub tokens_used: i64,       // Tokens used this month
    pub tokens_remaining: i64,  // Tokens remaining this month
}

/// AI usage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub tokens_used: i64,
    pub tokens_remaining: i64,
    pub request_count: i32,
    pub resets_at: String,  // ISO 8601 date of next reset (1st of next month)
}

/// Response from AI feature call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIResponse {
    pub result: String,
    pub tokens_used_this_request: i64,
    pub tokens_remaining: i64,
}

/// Obsidian configuration stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ObsidianConfig {
    pub vault_path: String,
    pub default_location: ObsidianLocation,
    #[serde(default)]
    pub specific_note_path: Option<String>,
    #[serde(default)]
    pub new_note_folder: Option<String>,
    #[serde(default)]
    pub template: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum ObsidianLocation {
    #[default]
    DailyNote,
    SpecificNote,
    NewNote,
}

impl Default for ObsidianConfig {
    fn default() -> Self {
        Self {
            vault_path: String::new(),
            default_location: ObsidianLocation::DailyNote,
            specific_note_path: None,
            new_note_folder: None,
            template: None,
        }
    }
}

/// AI configuration stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AIConfig {
    pub system_instructions: String,
}

impl Default for AIConfig {
    fn default() -> Self {
        Self {
            system_instructions: "You are an expert at refining text for AI prompts. Take the user's stream of consciousness or rough notes and transform them into clear, well-structured prompts optimized for Claude Code or other AI assistants. Focus on clarity, specificity, and actionable instructions.".to_string(),
        }
    }
}

/// AI Preset configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIPreset {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "systemPrompt")]
    pub system_prompt: String,
    pub enabled: bool,
}

/// AI Presets configuration stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct AIPresetsConfig {
    pub presets: Vec<AIPreset>,
}

impl Default for AIPresetsConfig {
    fn default() -> Self {
        Self {
            presets: vec![],
        }
    }
}

/// Premium feature types for AI calls
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
#[allow(dead_code)]
pub enum PremiumFeature {
    PromptOptimizer,
    QuickNote,
    ObsidianIntegration,
}

#[allow(dead_code)]
impl PremiumFeature {
    pub fn as_str(&self) -> &'static str {
        match self {
            PremiumFeature::PromptOptimizer => "prompt_optimizer",
            PremiumFeature::QuickNote => "quick_note",
            PremiumFeature::ObsidianIntegration => "obsidian",
        }
    }
}

/// Response from Supabase has_premium_access RPC
#[derive(Debug, Deserialize)]
struct PremiumAccessResponse {
    has_access: bool,
    tier: String,
    is_active: bool,
    tokens_used: i64,
    tokens_remaining: i64,
    current_period_end: Option<String>,
}

/// Response from Claude proxy edge function
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ClaudeProxyResponse {
    result: Option<String>,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    tokens_used_this_request: Option<i64>,
    tokens_used_this_month: Option<i64>,
    tokens_remaining: Option<i64>,
    request_count: Option<i32>,
    error: Option<String>,
    code: Option<String>,
    message: Option<String>,
}

/// Get the path to the Obsidian config file
fn get_obsidian_config_path() -> Result<PathBuf, PremiumError> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| PremiumError::StorageError("Cannot find data directory".to_string()))?;
    let app_dir = data_dir.join("com.wingman.app");
    fs::create_dir_all(&app_dir)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;
    Ok(app_dir.join("obsidian_config.json"))
}

/// Load Obsidian configuration from disk
pub fn load_obsidian_config() -> Result<ObsidianConfig, PremiumError> {
    let config_path = get_obsidian_config_path()?;

    if !config_path.exists() {
        return Ok(ObsidianConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;

    serde_json::from_str(&content)
        .map_err(|e| PremiumError::StorageError(e.to_string()))
}

/// Save Obsidian configuration to disk
pub fn save_obsidian_config(config: &ObsidianConfig) -> Result<(), PremiumError> {
    let config_path = get_obsidian_config_path()?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;

    fs::write(&config_path, content)
        .map_err(|e| PremiumError::StorageError(e.to_string()))
}

/// Get the path to the AI config file
fn get_ai_config_path() -> Result<PathBuf, PremiumError> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| PremiumError::StorageError("Cannot find data directory".to_string()))?;
    let app_dir = data_dir.join("com.wingman.app");
    fs::create_dir_all(&app_dir)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;
    Ok(app_dir.join("ai_config.json"))
}

/// Load AI configuration from disk
pub fn load_ai_config() -> Result<AIConfig, PremiumError> {
    let config_path = get_ai_config_path()?;

    if !config_path.exists() {
        return Ok(AIConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;

    serde_json::from_str(&content)
        .map_err(|e| PremiumError::StorageError(e.to_string()))
}

/// Save AI configuration to disk
pub fn save_ai_config(config: &AIConfig) -> Result<(), PremiumError> {
    let config_path = get_ai_config_path()?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;

    fs::write(&config_path, content)
        .map_err(|e| PremiumError::StorageError(e.to_string()))
}

/// Get the path to the AI presets config file
fn get_ai_presets_config_path() -> Result<PathBuf, PremiumError> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| PremiumError::StorageError("Cannot find data directory".to_string()))?;
    let app_dir = data_dir.join("com.wingman.app");
    fs::create_dir_all(&app_dir)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;
    Ok(app_dir.join("ai_presets.json"))
}

/// Load AI presets configuration from disk
pub fn load_ai_presets() -> Result<AIPresetsConfig, PremiumError> {
    let config_path = get_ai_presets_config_path()?;

    if !config_path.exists() {
        return Ok(AIPresetsConfig::default());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;

    serde_json::from_str(&content)
        .map_err(|e| PremiumError::StorageError(e.to_string()))
}

/// Save AI presets configuration to disk
pub fn save_ai_presets(config: &AIPresetsConfig) -> Result<(), PremiumError> {
    let config_path = get_ai_presets_config_path()?;

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| PremiumError::StorageError(e.to_string()))?;

    fs::write(&config_path, content)
        .map_err(|e| PremiumError::StorageError(e.to_string()))
}

/// Validate that a path is a valid Obsidian vault
pub fn validate_obsidian_vault(vault_path: &str) -> Result<bool, PremiumError> {
    let path = PathBuf::from(vault_path);

    // Check if directory exists
    if !path.exists() {
        return Err(PremiumError::ObsidianError(
            "Vault path does not exist".to_string()
        ));
    }

    if !path.is_dir() {
        return Err(PremiumError::ObsidianError(
            "Vault path is not a directory".to_string()
        ));
    }

    // Check for .obsidian folder (indicates it's an Obsidian vault)
    let obsidian_folder = path.join(".obsidian");
    if !obsidian_folder.exists() {
        return Err(PremiumError::ObsidianError(
            "Not a valid Obsidian vault (missing .obsidian folder)".to_string()
        ));
    }

    Ok(true)
}

/// Get the daily note path for today
#[allow(dead_code)]
fn get_daily_note_path(vault_path: &str) -> PathBuf {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    PathBuf::from(vault_path).join(format!("{}.md", today))
}

/// Get the vault name from the vault path
fn get_vault_name(vault_path: &str) -> String {
    PathBuf::from(vault_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Obsidian".to_string())
}

/// Result of adding content to Obsidian
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObsidianResult {
    pub note_name: String,
    pub vault_name: String,
    pub open_uri: String,
}

/// Add content to Obsidian vault using Obsidian's URI scheme
/// Always creates a new note (append requires Advanced URI plugin)
/// Opens Obsidian in background and returns info for toast notification
pub fn add_to_obsidian_vault(content: &str, config: &ObsidianConfig) -> Result<ObsidianResult, PremiumError> {
    log::info!("add_to_obsidian_vault called via URI scheme");
    log::info!("vault_path: {}", config.vault_path);

    let vault_name = get_vault_name(&config.vault_path);
    log::info!("vault_name: {}", vault_name);

    // Generate note name with timestamp
    let now = chrono::Local::now();
    let timestamp = now.format("%Y-%m-%d %H%M%S").to_string();
    let note_name = if let Some(folder) = &config.new_note_folder {
        format!("{}/Wingman {}", folder.trim_matches('/'), timestamp)
    } else {
        format!("Wingman {}", timestamp)
    };

    // Format content with template if provided
    let formatted_content = if let Some(template) = &config.template {
        template
            .replace("{{content}}", content)
            .replace("{{timestamp}}", &now.format("%Y-%m-%d %H:%M").to_string())
            .replace("{{date}}", &now.format("%Y-%m-%d").to_string())
    } else {
        // Just use the content directly without header or timestamp
        content.to_string()
    };

    // URL encode everything
    let encoded_content = urlencoding::encode(&formatted_content);
    let encoded_vault = urlencoding::encode(&vault_name);
    let encoded_name = urlencoding::encode(&note_name);

    // Build the create URI - always create new note
    let create_uri = format!(
        "obsidian://new?vault={}&name={}&content={}",
        encoded_vault,
        encoded_name,
        encoded_content
    );

    // Build the open URI for the toast click
    let open_uri = format!(
        "obsidian://open?vault={}&file={}",
        encoded_vault,
        encoded_name
    );

    log::info!("Creating note: {}", note_name);

    // Open the URI in background using the system's default handler
    #[cfg(target_os = "macos")]
    {
        // Use -g flag to open in background (don't bring to foreground)
        let output = std::process::Command::new("open")
            .arg("-g")
            .arg(&create_uri)
            .output()
            .map_err(|e| PremiumError::ObsidianError(format!("Failed to open Obsidian: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(PremiumError::ObsidianError(
                format!("Failed to create note in Obsidian: {}", stderr)
            ));
        }
    }

    #[cfg(target_os = "windows")]
    {
        let output = std::process::Command::new("cmd")
            .args(["/C", "start", "/min", "", &create_uri])
            .output()
            .map_err(|e| PremiumError::ObsidianError(format!("Failed to open Obsidian: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(PremiumError::ObsidianError(
                format!("Failed to create note in Obsidian: {}", stderr)
            ));
        }
    }

    #[cfg(target_os = "linux")]
    {
        let output = std::process::Command::new("xdg-open")
            .arg(&create_uri)
            .output()
            .map_err(|e| PremiumError::ObsidianError(format!("Failed to open Obsidian: {}", e)))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(PremiumError::ObsidianError(
                format!("Failed to create note in Obsidian: {}", stderr)
            ));
        }
    }

    log::info!("Successfully created note in Obsidian: {}", note_name);

    Ok(ObsidianResult {
        note_name,
        vault_name,
        open_uri,
    })
}

/// Validate Premium subscription and get status
pub async fn validate_premium_license(license_key: &str) -> Result<SubscriptionStatus, PremiumError> {
    let client = reqwest::Client::new();
    let url = format!("{}/rest/v1/rpc/has_premium_access", SUPABASE_URL);

    let response = client
        .post(&url)
        .header("apikey", SUPABASE_PUBLISHABLE_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "p_license_key": license_key
        }))
        .send()
        .await
        .map_err(|e| PremiumError::NetworkError(e.to_string()))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        log::error!("Premium validation failed: {}", error_text);
        return Err(PremiumError::ValidationError(error_text));
    }

    let data: Vec<PremiumAccessResponse> = response
        .json()
        .await
        .map_err(|e| PremiumError::NetworkError(e.to_string()))?;

    let access = data.first()
        .ok_or_else(|| PremiumError::InvalidLicense)?;

    if !access.has_access {
        return Err(PremiumError::InvalidLicense);
    }

    Ok(SubscriptionStatus {
        tier: access.tier.clone(),
        is_active: access.is_active,
        expires_at: access.current_period_end.clone(),
        tokens_used: access.tokens_used,
        tokens_remaining: access.tokens_remaining,
    })
}

/// Get AI usage statistics for a license
pub async fn get_ai_usage(license_key: &str) -> Result<UsageStats, PremiumError> {
    let status = validate_premium_license(license_key).await?;

    // Calculate reset date (1st of next month at 00:00 UTC)
    let now = chrono::Utc::now();
    let next_month = if now.month() == 12 {
        chrono::NaiveDate::from_ymd_opt(now.year() + 1, 1, 1)
    } else {
        chrono::NaiveDate::from_ymd_opt(now.year(), now.month() + 1, 1)
    };
    let resets_at = next_month
        .map(|d| d.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "Unknown".to_string());

    // Get request count from a separate call if needed
    // For now, we'll return 0 as it's not critical
    Ok(UsageStats {
        tokens_used: status.tokens_used,
        tokens_remaining: status.tokens_remaining,
        request_count: 0, // Would need additional API call
        resets_at,
    })
}

/// Call an AI feature through the Claude proxy
pub async fn call_ai_feature(
    license_key: &str,
    prompt: &str,
    feature: &str,
    system_instructions: Option<&str>,
) -> Result<AIResponse, PremiumError> {
    // Validate the prompt isn't empty
    let trimmed_prompt = prompt.trim();
    if trimmed_prompt.is_empty() {
        return Err(PremiumError::ValidationError("Prompt cannot be empty".to_string()));
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| PremiumError::NetworkError(e.to_string()))?;

    let url = format!("{}/functions/v1/claude-proxy", SUPABASE_URL);

    log::info!("Calling AI feature: {}", feature);

    let mut request_body = serde_json::json!({
        "prompt": trimmed_prompt,
        "feature": feature,
        "license_key": license_key
    });

    // Add system_instructions if provided
    if let Some(instructions) = system_instructions {
        request_body["system_instructions"] = serde_json::json!(instructions);
    }

    let response = client
        .post(&url)
        .header("apikey", SUPABASE_PUBLISHABLE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_PUBLISHABLE_KEY))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            log::error!("AI request failed: {}", e);
            PremiumError::NetworkError(e.to_string())
        })?;

    let status = response.status();
    let body: ClaudeProxyResponse = response
        .json()
        .await
        .map_err(|e| PremiumError::NetworkError(e.to_string()))?;

    // Handle error responses
    if !status.is_success() {
        let error_message = body.error.unwrap_or_else(|| "Unknown error".to_string());
        let error_code = body.code.unwrap_or_default();

        return match error_code.as_str() {
            "INVALID_LICENSE" => Err(PremiumError::InvalidLicense),
            "PREMIUM_REQUIRED" => Err(PremiumError::PremiumRequired),
            "SUBSCRIPTION_EXPIRED" => Err(PremiumError::SubscriptionExpired),
            "TOKEN_LIMIT_EXCEEDED" => Err(PremiumError::TokenLimitExceeded(
                body.message.unwrap_or(error_message)
            )),
            _ => Err(PremiumError::AIServiceError(error_message)),
        };
    }

    // Extract successful response
    let result = body.result.ok_or_else(|| {
        PremiumError::AIServiceError("No result in response".to_string())
    })?;

    Ok(AIResponse {
        result,
        tokens_used_this_request: body.tokens_used_this_request.unwrap_or(0),
        tokens_remaining: body.tokens_remaining.unwrap_or(MONTHLY_TOKEN_LIMIT),
    })
}

/// Response from create-portal-session edge function
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct PortalSessionResponse {
    success: Option<bool>,
    url: Option<String>,
    error: Option<String>,
}

/// Create a Stripe Customer Portal session URL for subscription management
pub async fn create_customer_portal_session(
    license_key: &str,
    email: &str,
    device_id: &str,
) -> Result<String, PremiumError> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| PremiumError::NetworkError(e.to_string()))?;

    let url = format!("{}/functions/v1/create-portal-session", SUPABASE_URL);

    log::info!("Creating customer portal session for license");

    let response = client
        .post(&url)
        .header("apikey", SUPABASE_PUBLISHABLE_KEY)
        .header("Authorization", format!("Bearer {}", SUPABASE_PUBLISHABLE_KEY))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "license_key": license_key,
            "email": email,
            "device_id": device_id
        }))
        .send()
        .await
        .map_err(|e| {
            log::error!("Portal session request failed: {}", e);
            PremiumError::NetworkError(e.to_string())
        })?;

    let status = response.status();
    let body: PortalSessionResponse = response
        .json()
        .await
        .map_err(|e| PremiumError::NetworkError(e.to_string()))?;

    // Handle error responses
    if !status.is_success() {
        let error_message = body.error.unwrap_or_else(|| "Failed to create portal session".to_string());
        log::error!("Portal session creation failed: {}", error_message);
        return Err(PremiumError::ValidationError(error_message));
    }

    // Extract the portal URL
    let portal_url = body.url.ok_or_else(|| {
        PremiumError::ValidationError("No portal URL in response".to_string())
    })?;

    log::info!("Portal session created successfully");
    Ok(portal_url)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_obsidian_config_serialization() {
        let config = ObsidianConfig {
            vault_path: "/Users/test/Documents/Obsidian".to_string(),
            default_location: ObsidianLocation::DailyNote,
            specific_note_path: None,
            new_note_folder: None,
            template: Some("## {{timestamp}}\n\n{{content}}".to_string()),
        };

        let json = serde_json::to_string(&config).unwrap();
        let parsed: ObsidianConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(parsed.vault_path, config.vault_path);
    }

    #[test]
    fn test_subscription_status_serialization() {
        let status = SubscriptionStatus {
            tier: "premium".to_string(),
            is_active: true,
            expires_at: Some("2024-02-01T00:00:00Z".to_string()),
            tokens_used: 500000,
            tokens_remaining: 500000,
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("\"tier\":\"premium\""));
        assert!(json.contains("\"is_active\":true"));
    }
}
