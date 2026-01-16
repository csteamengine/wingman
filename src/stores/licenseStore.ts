import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { LicenseTier, LicenseStatus, LicenseStatusInfo, ProFeature } from '../types';

interface LicenseState {
  tier: LicenseTier;
  status: LicenseStatus;
  email: string | null;
  daysUntilExpiry: number | null;
  needsRevalidation: boolean;
  loading: boolean;
  error: string | null;

  // Actions
  loadLicenseStatus: () => Promise<void>;
  activateLicense: (licenseKey: string, email: string) => Promise<boolean>;
  deactivateLicense: () => Promise<boolean>;
  refreshLicense: () => Promise<boolean>;
  checkFeature: (feature: ProFeature) => Promise<boolean>;
  isProFeatureEnabled: (feature: ProFeature) => boolean;
}

// Default state for free tier
const defaultLicenseState = {
  tier: 'free' as LicenseTier,
  status: 'not_activated' as LicenseStatus,
  email: null,
  daysUntilExpiry: null,
  needsRevalidation: false,
};

export const useLicenseStore = create<LicenseState>((set, get) => ({
  ...defaultLicenseState,
  loading: false,
  error: null,

  loadLicenseStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await invoke<LicenseStatusInfo>('get_license_status');
      set({
        tier: status.tier,
        status: status.status,
        email: status.email,
        daysUntilExpiry: status.days_until_expiry,
        needsRevalidation: status.needs_revalidation,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load license status:', error);
      set({
        ...defaultLicenseState,
        loading: false,
        error: String(error),
      });
    }
  },

  activateLicense: async (licenseKey: string, email: string) => {
    set({ loading: true, error: null });
    try {
      const status = await invoke<LicenseStatusInfo>('activate_license', {
        licenseKey,
        email,
      });
      set({
        tier: status.tier,
        status: status.status,
        email: status.email,
        daysUntilExpiry: status.days_until_expiry,
        needsRevalidation: status.needs_revalidation,
        loading: false,
        error: null,
      });
      return true;
    } catch (error) {
      console.error('Failed to activate license:', error);
      set({
        loading: false,
        error: String(error),
      });
      return false;
    }
  },

  deactivateLicense: async () => {
    console.log('deactivateLicense called');
    set({ loading: true, error: null });
    try {
      console.log('Invoking deactivate_license command...');
      await invoke('deactivate_license');
      console.log('deactivate_license succeeded');
      set({
        ...defaultLicenseState,
        loading: false,
        error: null,
      });
      return true;
    } catch (error) {
      console.error('Failed to deactivate license:', error);
      set({
        loading: false,
        error: String(error),
      });
      return false;
    }
  },

  refreshLicense: async () => {
    set({ loading: true, error: null });
    try {
      const status = await invoke<LicenseStatusInfo>('refresh_license_status');
      set({
        tier: status.tier,
        status: status.status,
        email: status.email,
        daysUntilExpiry: status.days_until_expiry,
        needsRevalidation: status.needs_revalidation,
        loading: false,
        error: null,
      });
      return true;
    } catch (error) {
      console.error('Failed to refresh license:', error);
      set({
        loading: false,
        error: String(error),
      });
      return false;
    }
  },

  checkFeature: async (feature: ProFeature) => {
    try {
      return await invoke<boolean>('check_feature_enabled', { feature });
    } catch (error) {
      console.error('Failed to check feature:', error);
      return false;
    }
  },

  // Synchronous check based on current state (no backend call)
  // Note: feature param is for API consistency and future granular checks
  isProFeatureEnabled: (_feature: ProFeature) => {
    const { tier, status } = get();
    // Pro features require valid or grace period status with pro tier
    if (tier !== 'pro') return false;
    return status === 'valid' || status === 'grace_period';
  },
}));
