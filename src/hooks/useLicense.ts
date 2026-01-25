import { useEffect, useCallback } from 'react';
import { useLicenseStore, isDev } from '../stores/licenseStore';
import type { ProFeature } from '../types';

export function useLicense() {
  const {
    tier,
    status,
    email,
    daysUntilExpiry,
    needsRevalidation,
    loading,
    error,
    loadLicenseStatus,
    activateLicense,
    deactivateLicense,
    refreshLicense,
    isProFeatureEnabled,
    devTierOverride,
    getEffectiveTier,
  } = useLicenseStore();

  // Load license status on mount
  useEffect(() => {
    loadLicenseStatus();
  }, [loadLicenseStatus]);

  const handleActivate = useCallback(
    async (licenseKey: string, email: string) => {
      return await activateLicense(licenseKey, email);
    },
    [activateLicense]
  );

  const handleDeactivate = useCallback(async () => {
    return await deactivateLicense();
  }, [deactivateLicense]);

  const handleRefresh = useCallback(async () => {
    return await refreshLicense();
  }, [refreshLicense]);

  // Helper to check if a specific pro feature is enabled
  const checkFeature = useCallback(
    (feature: ProFeature) => {
      return isProFeatureEnabled(feature);
    },
    [isProFeatureEnabled]
  );

  // Derived state helpers
  // Premium tier also has access to all Pro features
  // Use effective tier (considers dev override)
  const effectiveTier = getEffectiveTier();

  // In dev mode with override, simulate valid status
  const effectiveStatus = (isDev && devTierOverride !== null) ? 'valid' : status;

  const isPro = (effectiveTier === 'pro' || effectiveTier === 'premium') && (effectiveStatus === 'valid' || effectiveStatus === 'grace_period');
  const isPremium = effectiveTier === 'premium' && (effectiveStatus === 'valid' || effectiveStatus === 'grace_period');
  const isGracePeriod = effectiveStatus === 'grace_period';
  const isExpired = effectiveStatus === 'expired';
  const showUpgradePrompt = effectiveTier === 'free' || effectiveStatus === 'expired' || effectiveStatus === 'invalid';

  return {
    // State (use effective tier for display)
    tier: effectiveTier,
    status: effectiveStatus,
    email,
    daysUntilExpiry,
    needsRevalidation,
    loading,
    error,

    // Derived state
    isPro,
    isPremium,
    isGracePeriod,
    isExpired,
    showUpgradePrompt,

    // Actions
    handleActivate,
    handleDeactivate,
    handleRefresh,
    checkFeature,
    isProFeatureEnabled,
  };
}
