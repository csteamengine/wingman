/**
 * Secure storage utility using Tauri's store plugin
 *
 * Uses tauri-plugin-store which persists data to an encrypted JSON file.
 * This is more reliable than OS keychain which has issues in dev mode.
 */

import { invoke } from '@tauri-apps/api/core';
import { load } from '@tauri-apps/plugin-store';

// Keys for stored credentials
export const CREDENTIAL_KEYS = {
  LICENSE_KEY: 'license_key',
  LICENSE_EMAIL: 'license_email',
} as const;

// Store instance (lazy loaded)
let storePromise: ReturnType<typeof load> | null = null;

async function getStore() {
  if (!storePromise) {
    storePromise = load('credentials.json', { autoSave: true });
  }
  return storePromise;
}

/**
 * Store a credential using Tauri store
 */
export async function storeCredential(key: string, value: string): Promise<void> {
  console.log(`[SecureStorage] Storing credential: ${key}`);
  try {
    const store = await getStore();
    await store.set(key, value);
    await store.save();
    console.log(`[SecureStorage] Successfully stored: ${key}`);
  } catch (error) {
    console.error(`[SecureStorage] Failed to store ${key}:`, error);
    throw error;
  }
}

/**
 * Retrieve a credential from Tauri store
 * Returns null if not found
 */
export async function getCredential(key: string): Promise<string | null> {
  console.log(`[SecureStorage] Getting credential: ${key}`);
  try {
    const store = await getStore();
    const value = await store.get<string>(key);
    console.log(`[SecureStorage] Got credential ${key}: ${value ? 'found' : 'not found'}`);
    return value ?? null;
  } catch (error) {
    console.error(`[SecureStorage] Failed to get ${key}:`, error);
    throw error;
  }
}

/**
 * Delete a credential from Tauri store
 */
export async function deleteCredential(key: string): Promise<void> {
  console.log(`[SecureStorage] Deleting credential: ${key}`);
  try {
    const store = await getStore();
    await store.delete(key);
    await store.save();
    console.log(`[SecureStorage] Successfully deleted: ${key}`);
  } catch (error) {
    console.error(`[SecureStorage] Failed to delete ${key}:`, error);
    throw error;
  }
}

// Convenience functions for license credentials

/**
 * Store license credentials
 */
export async function storeLicenseCredentials(licenseKey: string, email: string): Promise<void> {
  await Promise.all([
    storeCredential(CREDENTIAL_KEYS.LICENSE_KEY, licenseKey),
    storeCredential(CREDENTIAL_KEYS.LICENSE_EMAIL, email),
  ]);
}

/**
 * Get the stored license key
 */
export async function getLicenseKey(): Promise<string | null> {
  return await getCredential(CREDENTIAL_KEYS.LICENSE_KEY);
}

/**
 * Get the stored license email
 */
export async function getLicenseEmail(): Promise<string | null> {
  return await getCredential(CREDENTIAL_KEYS.LICENSE_EMAIL);
}

/**
 * Delete all license credentials
 */
export async function deleteLicenseCredentials(): Promise<void> {
  await Promise.all([
    deleteCredential(CREDENTIAL_KEYS.LICENSE_KEY),
    deleteCredential(CREDENTIAL_KEYS.LICENSE_EMAIL),
  ]);
}

/**
 * Migrate credentials from localStorage to Tauri store
 * Call this once on app startup to migrate existing users
 */
export async function migrateLicenseFromLocalStorage(): Promise<boolean> {
  try {
    const localKey = localStorage.getItem('wingman_license_key');
    const localEmail = localStorage.getItem('wingman_license_email');

    if (localKey || localEmail) {
      // Check if already migrated
      const existingKey = await getLicenseKey();

      if (!existingKey && localKey) {
        // Migrate to Tauri store
        console.log('[SecureStorage] Migrating from localStorage...');
        if (localKey) {
          await storeCredential(CREDENTIAL_KEYS.LICENSE_KEY, localKey);
        }
        if (localEmail) {
          await storeCredential(CREDENTIAL_KEYS.LICENSE_EMAIL, localEmail);
        }

        // Remove from localStorage after successful migration
        localStorage.removeItem('wingman_license_key');
        localStorage.removeItem('wingman_license_email');

        console.log('[SecureStorage] License credentials migrated from localStorage');
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('[SecureStorage] Failed to migrate license credentials:', error);
    return false;
  }
}

/**
 * Sync license key from Rust backend cache to Tauri store
 * This ensures the store has the key even if the user
 * was logged in before this storage system was implemented
 */
export async function syncLicenseFromRustCache(): Promise<boolean> {
  try {
    console.log('[SecureStorage] Syncing license from Rust cache...');

    // Check if we already have the key
    const existingKey = await getLicenseKey();
    if (existingKey) {
      console.log('[SecureStorage] Already have license key in store');
      return true;
    }

    // Get the cached key from Rust backend
    const cachedKey = await invoke<string | null>('get_cached_license_key_cmd');
    if (cachedKey) {
      console.log('[SecureStorage] Found license key in Rust cache, storing...');
      await storeCredential(CREDENTIAL_KEYS.LICENSE_KEY, cachedKey);
      console.log('[SecureStorage] License key synced from Rust cache');
      return true;
    } else {
      console.log('[SecureStorage] No license key in Rust cache');
      return false;
    }
  } catch (error) {
    console.error('[SecureStorage] Failed to sync from Rust cache:', error);
    return false;
  }
}
