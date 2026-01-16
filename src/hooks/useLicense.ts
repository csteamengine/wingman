import { useEffect, useCallback } from 'react';
import { useLicenseStore } from '../stores/licenseStore';
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
  const isPro = tier === 'pro' && (status === 'valid' || status === 'grace_period');
  const isGracePeriod = status === 'grace_period';
  const isExpired = status === 'expired';
  const showUpgradePrompt = tier === 'free' || status === 'expired' || status === 'invalid';

  return {
    // State
    tier,
    status,
    email,
    daysUntilExpiry,
    needsRevalidation,
    loading,
    error,

    // Derived state
    isPro,
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
