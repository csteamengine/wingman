//! Secure credential storage using the OS keychain
//!
//! Uses the keyring crate to store sensitive data in:
//! - macOS: Keychain
//! - Windows: Credential Manager
//! - Linux: Secret Service (libsecret)

use keyring::Entry;

const SERVICE_NAME: &str = "com.wingman.app";

/// Store a credential securely in the OS keychain
#[tauri::command]
pub fn store_credential(key: String, value: String) -> Result<(), String> {
    log::info!("store_credential called for key: {}", key);
    let entry = Entry::new(SERVICE_NAME, &key).map_err(|e| {
        log::error!("Failed to create keyring entry for {}: {}", key, e);
        format!("Failed to create keyring entry: {}", e)
    })?;
    entry.set_password(&value).map_err(|e| {
        log::error!("Failed to store credential {}: {}", key, e);
        format!("Failed to store credential: {}", e)
    })?;
    log::info!("Successfully stored credential: {}", key);
    Ok(())
}

/// Retrieve a credential from the OS keychain
#[tauri::command]
pub fn get_credential(key: String) -> Result<Option<String>, String> {
    log::info!("get_credential called for key: {}", key);
    let entry = Entry::new(SERVICE_NAME, &key).map_err(|e| {
        log::error!("Failed to create keyring entry for {}: {}", key, e);
        format!("Failed to create keyring entry: {}", e)
    })?;
    match entry.get_password() {
        Ok(password) => {
            log::info!("Successfully retrieved credential: {}", key);
            Ok(Some(password))
        }
        Err(keyring::Error::NoEntry) => {
            log::info!("No credential found for key: {}", key);
            Ok(None)
        }
        Err(e) => {
            log::error!("Failed to retrieve credential {}: {}", key, e);
            Err(format!("Failed to retrieve credential: {}", e))
        }
    }
}

/// Delete a credential from the OS keychain
#[tauri::command]
pub fn delete_credential(key: String) -> Result<(), String> {
    log::info!("delete_credential called for key: {}", key);
    let entry = Entry::new(SERVICE_NAME, &key).map_err(|e| {
        log::error!("Failed to create keyring entry for {}: {}", key, e);
        format!("Failed to create keyring entry: {}", e)
    })?;
    match entry.delete_credential() {
        Ok(()) => {
            log::info!("Successfully deleted credential: {}", key);
            Ok(())
        }
        Err(keyring::Error::NoEntry) => {
            log::info!("Credential already deleted (no entry): {}", key);
            Ok(()) // Already deleted, that's fine
        }
        Err(e) => {
            log::error!("Failed to delete credential {}: {}", key, e);
            Err(format!("Failed to delete credential: {}", e))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_credential_roundtrip() {
        let key = "test_key_wingman".to_string();
        let value = "test_value_123".to_string();

        // Store
        store_credential(key.clone(), value.clone()).expect("Failed to store");

        // Retrieve
        let retrieved = get_credential(key.clone()).expect("Failed to get");
        assert_eq!(retrieved, Some(value));

        // Delete
        delete_credential(key.clone()).expect("Failed to delete");

        // Verify deleted
        let after_delete = get_credential(key).expect("Failed to get after delete");
        assert_eq!(after_delete, None);
    }
}
