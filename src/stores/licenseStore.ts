import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { LicenseTier, LicenseStatus, LicenseStatusInfo, ProFeature } from '../types';

// Check if running in development mode
export const isDev = import.meta.env.DEV;

interface LicenseState {
  tier: LicenseTier;
  status: LicenseStatus;
  email: string | null;
  daysUntilExpiry: number | null;
  needsRevalidation: boolean;
  loading: boolean;
  error: string | null;

  // Dev mode tier override (only works in dev mode)
  devTierOverride: LicenseTier | null;

  // Actions
  loadLicenseStatus: () => Promise<void>;
  activateLicense: (licenseKey: string, email: string) => Promise<boolean>;
  deactivateLicense: () => Promise<boolean>;
  refreshLicense: () => Promise<boolean>;
  checkFeature: (feature: ProFeature) => Promise<boolean>;
  isProFeatureEnabled: (feature: ProFeature) => boolean;
  isPremiumTier: () => boolean;
  setDevTierOverride: (tier: LicenseTier | null) => void;
  getEffectiveTier: () => LicenseTier;
}

// Default state for free tier
const defaultLicenseState = {
  tier: 'free' as LicenseTier,
  status: 'not_activated' as LicenseStatus,
  email: null,
  daysUntilExpiry: null,
  needsRevalidation: false,
  devTierOverride: null as LicenseTier | null,
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

  // Get the effective tier (considering dev override)
  getEffectiveTier: () => {
    const { tier, devTierOverride } = get();
    // In dev mode, use override if set
    if (isDev && devTierOverride !== null) {
      return devTierOverride;
    }
    return tier;
  },

  // Set dev tier override (only works in dev mode)
  setDevTierOverride: (tier: LicenseTier | null) => {
    if (isDev) {
      set({ devTierOverride: tier });
    }
  },

  // Synchronous check based on current state (no backend call)
  // Note: feature param is for API consistency and future granular checks
  // Premium tier also has access to all Pro features
  isProFeatureEnabled: (_feature: ProFeature) => {
    const { status, getEffectiveTier } = get();
    const effectiveTier = getEffectiveTier();
    // In dev mode with override, simulate valid status
    if (isDev && get().devTierOverride !== null) {
      return effectiveTier === 'pro' || effectiveTier === 'premium';
    }
    // Pro and Premium features require valid or grace period status
    if (effectiveTier !== 'pro' && effectiveTier !== 'premium') return false;
    return status === 'valid' || status === 'grace_period';
  },

  // Check if user has Premium tier
  isPremiumTier: () => {
    const { status, getEffectiveTier } = get();
    const effectiveTier = getEffectiveTier();
    // In dev mode with override, simulate valid status
    if (isDev && get().devTierOverride !== null) {
      return effectiveTier === 'premium';
    }
    if (effectiveTier !== 'premium') return false;
    return status === 'valid' || status === 'grace_period';
  },
}));
