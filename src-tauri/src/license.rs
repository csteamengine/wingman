//! License management module for Wingman Pro
//!
//! Handles device identification, license validation (online/offline),
//! encrypted cache storage, and feature gating.

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::PathBuf;
use thiserror::Error;

// Supabase configuration - replace with your actual values
// The publishable key (formerly "anon key") is safe to include in client code
// as it respects Row Level Security policies
const SUPABASE_URL: &str = "https://yhpetdqcmqpfwhdtbhat.supabase.co";
const SUPABASE_PUBLISHABLE_KEY: &str = "sb_publishable_t4l4DUhI_I2rpT9pMU8dgg_Y2j55oJY";

// Validation periods
const OFFLINE_CHECK_DAYS: i64 = 30;
const GRACE_PERIOD_DAYS: i64 = 90;

#[derive(Debug, Error)]
pub enum LicenseError {
    #[error("Device ID generation failed: {0}")]
    DeviceIdError(String),
    #[error("Encryption error: {0}")]
    EncryptionError(String),
    #[error("Network error: {0}")]
    NetworkError(String),
    #[error("Invalid license key")]
    InvalidLicense,
    #[error("License expired")]
    #[allow(dead_code)]
    LicenseExpired,
    #[error("Device limit exceeded")]
    DeviceLimitExceeded,
    #[error("Storage error: {0}")]
    StorageError(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseTier {
    Free,
    Pro,
}

impl Default for LicenseTier {
    fn default() -> Self {
        LicenseTier::Free
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseStatus {
    Valid,
    GracePeriod,
    Expired,
    Invalid,
    NotActivated,
}

impl Default for LicenseStatus {
    fn default() -> Self {
        LicenseStatus::NotActivated
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProFeature {
    History,
    SyntaxHighlighting,
    Snippets,
    CustomThemes,
    StatsDisplay,
    ExportHistory,
}

/// Cached license data stored locally with encryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseCache {
    pub license_key: Option<String>,
    pub email: Option<String>,
    pub tier: LicenseTier,
    pub status: LicenseStatus,
    pub device_id: String,
    pub last_validated: Option<String>, // ISO 8601 timestamp
    pub validation_expires: Option<String>, // ISO 8601 timestamp
    pub grace_period_start: Option<String>, // ISO 8601 timestamp
}

impl Default for LicenseCache {
    fn default() -> Self {
        Self {
            license_key: None,
            email: None,
            tier: LicenseTier::Free,
            status: LicenseStatus::NotActivated,
            device_id: String::new(),
            last_validated: None,
            validation_expires: None,
            grace_period_start: None,
        }
    }
}

/// Response from license status check (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseStatusInfo {
    pub tier: LicenseTier,
    pub status: LicenseStatus,
    pub email: Option<String>,
    pub days_until_expiry: Option<i64>,
    pub needs_revalidation: bool,
}

/// Response from Supabase validate-license function
#[derive(Debug, Deserialize)]
struct ValidateLicenseResponse {
    valid: bool,
    tier: Option<String>,
    error: Option<String>,
    message: Option<String>,
}

/// Response from Supabase deactivate-device function
#[derive(Debug, Deserialize)]
struct DeactivateResponse {
    success: bool,
    error: Option<String>,
}

/// Get a unique device identifier
pub fn get_device_id() -> Result<String, LicenseError> {
    machine_uid::get()
        .map_err(|e| LicenseError::DeviceIdError(e.to_string()))
}

/// Get the device name for display purposes
pub fn get_device_name() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown Device".to_string())
}

/// Get current OS name
pub fn get_os_name() -> &'static str {
    #[cfg(target_os = "macos")]
    return "macOS";
    #[cfg(target_os = "windows")]
    return "Windows";
    #[cfg(target_os = "linux")]
    return "Linux";
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    return "Unknown";
}

/// Derive encryption key from device ID
fn derive_key(device_id: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(device_id.as_bytes());
    hasher.update(b"wingman-license-key-salt-v1");
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

/// Encrypt license cache data
fn encrypt_cache(cache: &LicenseCache, device_id: &str) -> Result<String, LicenseError> {
    let key = derive_key(device_id);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| LicenseError::EncryptionError(e.to_string()))?;

    let mut rng = rand::thread_rng();
    let mut nonce_bytes = [0u8; 12];
    rng.fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let plaintext = serde_json::to_vec(cache)
        .map_err(|e| LicenseError::EncryptionError(e.to_string()))?;

    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_ref())
        .map_err(|e| LicenseError::EncryptionError(e.to_string()))?;

    // Prepend nonce to ciphertext
    let mut result = nonce_bytes.to_vec();
    result.extend(ciphertext);

    Ok(BASE64.encode(&result))
}

/// Decrypt license cache data
fn decrypt_cache(encrypted: &str, device_id: &str) -> Result<LicenseCache, LicenseError> {
    let key = derive_key(device_id);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| LicenseError::EncryptionError(e.to_string()))?;

    let data = BASE64
        .decode(encrypted)
        .map_err(|e| LicenseError::EncryptionError(e.to_string()))?;

    if data.len() < 12 {
        return Err(LicenseError::EncryptionError("Invalid encrypted data".to_string()));
    }

    let (nonce_bytes, ciphertext) = data.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| LicenseError::EncryptionError(e.to_string()))?;

    serde_json::from_slice(&plaintext)
        .map_err(|e| LicenseError::EncryptionError(e.to_string()))
}

/// Get the path to the license cache file
fn get_cache_path() -> Result<PathBuf, LicenseError> {
    let data_dir = dirs::data_dir()
        .ok_or_else(|| LicenseError::StorageError("Cannot find data directory".to_string()))?;
    let app_dir = data_dir.join("com.wingman.app");
    fs::create_dir_all(&app_dir)
        .map_err(|e| LicenseError::StorageError(e.to_string()))?;
    Ok(app_dir.join("license.enc"))
}

/// Load the cached license data
pub fn load_license_cache() -> Result<LicenseCache, LicenseError> {
    let device_id = get_device_id()?;
    let cache_path = get_cache_path()?;
    log::info!("Loading license cache from: {:?}", cache_path);

    if !cache_path.exists() {
        log::info!("Cache file does not exist, returning default");
        let mut cache = LicenseCache::default();
        cache.device_id = device_id;
        return Ok(cache);
    }

    let encrypted = fs::read_to_string(&cache_path)
        .map_err(|e| LicenseError::StorageError(e.to_string()))?;
    log::info!("Read encrypted cache, length: {}", encrypted.len());

    let cache = decrypt_cache(&encrypted, &device_id)?;
    log::info!("Decrypted cache, license_key present: {}", cache.license_key.is_some());
    Ok(cache)
}

/// Save the license cache
pub fn save_license_cache(cache: &LicenseCache) -> Result<(), LicenseError> {
    let device_id = get_device_id()?;
    let cache_path = get_cache_path()?;
    log::info!("Saving license cache to: {:?}", cache_path);
    log::info!("Cache has license_key: {}", cache.license_key.is_some());

    let encrypted = encrypt_cache(cache, &device_id)?;
    fs::write(&cache_path, encrypted)
        .map_err(|e| LicenseError::StorageError(e.to_string()))?;

    log::info!("License cache saved successfully");
    Ok(())
}

/// Clear the license cache (for deactivation)
pub fn clear_license_cache() -> Result<(), LicenseError> {
    let cache_path = get_cache_path()?;
    if cache_path.exists() {
        fs::remove_file(&cache_path)
            .map_err(|e| LicenseError::StorageError(e.to_string()))?;
    }
    Ok(())
}

/// Validate license online via Supabase
pub async fn validate_license_online(
    license_key: &str,
    email: &str,
) -> Result<LicenseCache, LicenseError> {
    let device_id = get_device_id()?;
    let device_name = get_device_name();
    let os = get_os_name();

    let client = reqwest::Client::new();
    let url = format!("{}/functions/v1/validate-license", SUPABASE_URL);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", SUPABASE_PUBLISHABLE_KEY))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "license_key": license_key,
            "email": email,
            "device_id": device_id,
            "device_name": device_name,
            "os": os
        }))
        .send()
        .await
        .map_err(|e| LicenseError::NetworkError(e.to_string()))?;

    let status = response.status();
    let body: ValidateLicenseResponse = response
        .json()
        .await
        .map_err(|e| LicenseError::NetworkError(e.to_string()))?;

    if !body.valid {
        if let Some(error) = body.error {
            if error.contains("device limit") {
                return Err(LicenseError::DeviceLimitExceeded);
            }
            return Err(LicenseError::ValidationError(error));
        }
        return Err(LicenseError::InvalidLicense);
    }

    if !status.is_success() {
        return Err(LicenseError::ValidationError(
            body.message.unwrap_or_else(|| "Validation failed".to_string()),
        ));
    }

    let now = chrono::Utc::now();
    let expires = now + chrono::Duration::days(OFFLINE_CHECK_DAYS);

    let tier = match body.tier.as_deref() {
        Some("pro") => LicenseTier::Pro,
        _ => LicenseTier::Free,
    };

    let cache = LicenseCache {
        license_key: Some(license_key.to_string()),
        email: Some(email.to_string()),
        tier,
        status: LicenseStatus::Valid,
        device_id,
        last_validated: Some(now.to_rfc3339()),
        validation_expires: Some(expires.to_rfc3339()),
        grace_period_start: None,
    };

    save_license_cache(&cache)?;
    Ok(cache)
}

/// Deactivate license on current device
pub async fn deactivate_license_online(license_key: &str) -> Result<(), LicenseError> {
    let device_id = get_device_id()?;

    let client = reqwest::Client::new();
    let url = format!("{}/functions/v1/deactivate-device", SUPABASE_URL);

    let response = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", SUPABASE_PUBLISHABLE_KEY))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "license_key": license_key,
            "device_id": device_id
        }))
        .send()
        .await
        .map_err(|e| LicenseError::NetworkError(e.to_string()))?;

    let body: DeactivateResponse = response
        .json()
        .await
        .map_err(|e| LicenseError::NetworkError(e.to_string()))?;

    if !body.success {
        return Err(LicenseError::ValidationError(
            body.error.unwrap_or_else(|| "Deactivation failed".to_string()),
        ));
    }

    clear_license_cache()?;
    Ok(())
}

/// Check license status (offline-capable)
pub fn check_license_status() -> Result<LicenseStatusInfo, LicenseError> {
    let cache = load_license_cache()?;

    // No license activated
    if cache.license_key.is_none() {
        return Ok(LicenseStatusInfo {
            tier: LicenseTier::Free,
            status: LicenseStatus::NotActivated,
            email: None,
            days_until_expiry: None,
            needs_revalidation: false,
        });
    }

    let now = chrono::Utc::now();

    // Check if validation has expired
    if let Some(expires_str) = &cache.validation_expires {
        if let Ok(expires) = chrono::DateTime::parse_from_rfc3339(expires_str) {
            let expires_utc = expires.with_timezone(&chrono::Utc);

            if now > expires_utc {
                // Validation expired, check grace period
                let grace_start = cache
                    .grace_period_start
                    .as_ref()
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|d| d.with_timezone(&chrono::Utc))
                    .unwrap_or(expires_utc);

                let grace_end = grace_start + chrono::Duration::days(GRACE_PERIOD_DAYS);
                let days_left = (grace_end - now).num_days();

                if now > grace_end {
                    // Grace period expired
                    return Ok(LicenseStatusInfo {
                        tier: LicenseTier::Free,
                        status: LicenseStatus::Expired,
                        email: cache.email,
                        days_until_expiry: Some(0),
                        needs_revalidation: true,
                    });
                }

                // In grace period
                return Ok(LicenseStatusInfo {
                    tier: cache.tier,
                    status: LicenseStatus::GracePeriod,
                    email: cache.email,
                    days_until_expiry: Some(days_left.max(0)),
                    needs_revalidation: true,
                });
            }

            // Still valid
            let days_left = (expires_utc - now).num_days();
            return Ok(LicenseStatusInfo {
                tier: cache.tier,
                status: LicenseStatus::Valid,
                email: cache.email,
                days_until_expiry: Some(days_left.max(0)),
                needs_revalidation: days_left < 7, // Suggest revalidation when close to expiry
            });
        }
    }

    // Fallback: treat as needing revalidation
    Ok(LicenseStatusInfo {
        tier: cache.tier,
        status: cache.status,
        email: cache.email,
        days_until_expiry: None,
        needs_revalidation: true,
    })
}

/// Refresh license validation online
pub async fn refresh_license() -> Result<LicenseStatusInfo, LicenseError> {
    let cache = load_license_cache()?;

    let (license_key, email) = match (&cache.license_key, &cache.email) {
        (Some(key), Some(email)) => (key.clone(), email.clone()),
        _ => {
            return Ok(LicenseStatusInfo {
                tier: LicenseTier::Free,
                status: LicenseStatus::NotActivated,
                email: None,
                days_until_expiry: None,
                needs_revalidation: false,
            });
        }
    };

    let new_cache = validate_license_online(&license_key, &email).await?;

    Ok(LicenseStatusInfo {
        tier: new_cache.tier,
        status: new_cache.status,
        email: new_cache.email,
        days_until_expiry: Some(OFFLINE_CHECK_DAYS),
        needs_revalidation: false,
    })
}

/// Check if a specific pro feature is enabled
/// Note: feature param is for API consistency and future granular checks
pub fn is_feature_enabled(_feature: ProFeature) -> bool {
    let status = match check_license_status() {
        Ok(s) => s,
        Err(_) => return false,
    };

    // Pro features require valid or grace period status
    match status.status {
        LicenseStatus::Valid | LicenseStatus::GracePeriod => {
            matches!(status.tier, LicenseTier::Pro)
        }
        _ => false,
    }
}

/// Get list of all pro features and their enabled status
#[allow(dead_code)]
pub fn get_feature_status() -> Vec<(ProFeature, bool)> {
    let features = vec![
        ProFeature::History,
        ProFeature::SyntaxHighlighting,
        ProFeature::Snippets,
        ProFeature::CustomThemes,
        ProFeature::StatsDisplay,
        ProFeature::ExportHistory,
    ];

    let is_pro = match check_license_status() {
        Ok(status) => {
            matches!(status.status, LicenseStatus::Valid | LicenseStatus::GracePeriod)
                && matches!(status.tier, LicenseTier::Pro)
        }
        Err(_) => false,
    };

    features.into_iter().map(|f| (f, is_pro)).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_device_id_generation() {
        let device_id = get_device_id();
        assert!(device_id.is_ok());
        let id = device_id.unwrap();
        assert!(!id.is_empty());
    }

    #[test]
    fn test_encryption_roundtrip() {
        let device_id = "test-device-id";
        let cache = LicenseCache {
            license_key: Some("TEST-KEY-1234".to_string()),
            email: Some("test@example.com".to_string()),
            tier: LicenseTier::Pro,
            status: LicenseStatus::Valid,
            device_id: device_id.to_string(),
            last_validated: Some(chrono::Utc::now().to_rfc3339()),
            validation_expires: None,
            grace_period_start: None,
        };

        let encrypted = encrypt_cache(&cache, device_id).unwrap();
        let decrypted = decrypt_cache(&encrypted, device_id).unwrap();

        assert_eq!(decrypted.license_key, cache.license_key);
        assert_eq!(decrypted.email, cache.email);
        assert_eq!(decrypted.tier, cache.tier);
    }

    #[test]
    fn test_feature_check_free_tier() {
        // Default cache should be free tier
        let cache = LicenseCache::default();
        assert_eq!(cache.tier, LicenseTier::Free);
        assert_eq!(cache.status, LicenseStatus::NotActivated);
    }

    #[test]
    fn test_license_status_info_serialization() {
        let info = LicenseStatusInfo {
            tier: LicenseTier::Pro,
            status: LicenseStatus::Valid,
            email: Some("test@example.com".to_string()),
            days_until_expiry: Some(30),
            needs_revalidation: false,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"tier\":\"pro\""));
        assert!(json.contains("\"status\":\"valid\""));
    }
}
