import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGitHubStore } from '../stores/githubStore';
import { useLicenseStore, isDev } from '../stores/licenseStore';
import { ProBadge } from './ProFeatureGate';
import { GitHubDeviceFlowModal } from './GitHubDeviceFlowModal';
import { Github, LogOut } from 'lucide-react';
import type { DeviceFlowStart } from '../types';

export function GitHubSettings() {
  const {
    isAuthenticated,
    username,
    config,
    loading,
    error: storeError,
    loadAuthStatus,
    loadConfig,
    saveConfig,
    logout,
    startDeviceFlow,
  } = useGitHubStore();

  const { tier, devTierOverride } = useLicenseStore();

  // Compute effective tier to properly react to dev tier changes
  const effectiveTier = (isDev && devTierOverride !== null) ? devTierOverride : tier;
  const hasGitHubAccess = effectiveTier === 'pro' || effectiveTier === 'premium';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [deviceFlowStart, setDeviceFlowStart] = useState<DeviceFlowStart | null>(null);

  // Load config and auth status on mount
  useEffect(() => {
    if (hasGitHubAccess) {
      loadConfig();
      loadAuthStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGitHubAccess]);

  const handleAuthorize = async () => {
    setError(null);
    const flowStart = await startDeviceFlow();
    if (flowStart) {
      setDeviceFlowStart(flowStart);
    } else {
      setError(storeError || 'Failed to start GitHub authorization');
    }
  };

  const handleAuthSuccess = () => {
    // Reload auth status and config after successful authorization
    loadAuthStatus();
    loadConfig();
  };

  const handleLogout = async () => {
    setError(null);
    setSaving(true);
    await logout();
    setSaving(false);
  };

  const handleConfigChange = async (key: 'default_public' | 'auto_copy_url', value: boolean) => {
    if (!config) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    const saved = await saveConfig({ [key]: value });

    setSaving(false);

    if (saved) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } else {
      setError(storeError || 'Failed to save configuration');
    }
  };

  if (!hasGitHubAccess) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Github className="w-6 h-6 text-gray-400" />
          <h3 className="text-lg font-semibold text-white">GitHub Gist Integration</h3>
          <ProBadge />
        </div>
        <p className="text-gray-400 mb-4">
          Create GitHub Gists directly from Wingman with a single click. Upgrade to Pro to
          unlock this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Auth Status Section */}
      <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-gray-400" />
            <h4 className="text-sm font-medium text-gray-300">GitHub Account</h4>
          </div>
          {isAuthenticated && (
            <button
              onClick={handleLogout}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : isAuthenticated && username ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <p className="text-sm text-white">
              Authenticated as <span className="font-medium text-gray-200">@{username}</span>
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 bg-gray-500 rounded-full" />
              <p className="text-sm text-gray-400">Not authenticated</p>
            </div>
            <button
              onClick={handleAuthorize}
              disabled={loading}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Github className="w-4 h-4" />
              Authorize GitHub
            </button>
          </div>
        )}
      </div>

      {/* Configuration Section */}
      {isAuthenticated && config && (
        <>
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300 mb-2">Gist Settings</h4>

            {/* Default Public Toggle */}
            <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
              <div>
                <p className="text-white font-medium text-sm">Create public gists by default</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Public gists are discoverable by anyone. Private gists are secret.
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={config.default_public}
                  onChange={(e) => handleConfigChange('default_public', e.target.checked)}
                  disabled={saving}
                  className="sr-only"
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${
                    config.default_public ? 'bg-gray-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                      config.default_public ? 'translate-x-6' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </div>
              </div>
            </label>

            {/* Auto-Copy URL Toggle */}
            <label className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
              <div>
                <p className="text-white font-medium text-sm">Auto-copy gist URL to clipboard</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Automatically copy the gist URL after creating it
                </p>
              </div>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={config.auto_copy_url}
                  onChange={(e) => handleConfigChange('auto_copy_url', e.target.checked)}
                  disabled={saving}
                  className="sr-only"
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${
                    config.auto_copy_url ? 'bg-gray-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                      config.auto_copy_url ? 'translate-x-6' : 'translate-x-0.5'
                    } mt-0.5`}
                  />
                </div>
              </div>
            </label>
          </div>
        </>
      )}

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"
          >
            <p className="mb-2">{error}</p>
            {(error.includes('revoked') || error.includes('Not authenticated')) && !isAuthenticated && (
              <button
                onClick={() => {
                  setError(null);
                  handleAuthorize();
                }}
                disabled={loading}
                className="text-xs text-red-300 hover:text-red-200 underline"
              >
                Re-authorize now
              </button>
            )}
            {error.includes('connection') && (
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-300 hover:text-red-200 underline"
              >
                Dismiss
              </button>
            )}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Settings saved successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Device Flow Modal */}
      {deviceFlowStart && (
        <GitHubDeviceFlowModal
          flowStart={deviceFlowStart}
          onClose={() => setDeviceFlowStart(null)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </div>
  );
}
