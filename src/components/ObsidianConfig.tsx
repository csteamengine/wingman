import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { usePremiumStore } from '../stores/premiumStore';
import { useLicenseStore } from '../stores/licenseStore';
import { useEditorStore } from '../stores/editorStore';
import { ProBadge } from './ProFeatureGate';
import type { ObsidianConfig as ObsidianConfigType, ObsidianLocation } from '../types';

interface ObsidianConfigProps {
  onClose?: () => void;
}

export function ObsidianConfig({ onClose }: ObsidianConfigProps) {
  const {
    obsidianConfig,
    loadObsidianConfig,
    saveObsidianConfig,
    validateObsidianVault,
    error: storeError,
  } = usePremiumStore();
  const { isProFeatureEnabled } = useLicenseStore();

  const hasObsidianAccess = isProFeatureEnabled('obsidian_integration');

  const [config, setConfig] = useState<ObsidianConfigType>({
    vault_path: '',
    default_location: 'daily_note',
    specific_note_path: null,
    new_note_folder: null,
    template: null,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validatingVault, setValidatingVault] = useState(false);
  const [vaultValid, setVaultValid] = useState<boolean | null>(null);

  useEffect(() => {
    loadObsidianConfig();
  }, [loadObsidianConfig]);

  useEffect(() => {
    if (obsidianConfig) {
      setConfig(obsidianConfig);
    }
  }, [obsidianConfig]);

  const handleBrowseVault = async () => {
    try {
      // Use native folder picker via Rust command
      const selected = await invoke<string | null>('pick_folder', {
        title: 'Select Obsidian Vault',
      });

      // Reshow the window after dialog closes (NSPanel hides when losing focus)
      await invoke('show_window');
      useEditorStore.setState({ isVisible: true });

      if (selected) {
        setConfig((prev) => ({ ...prev, vault_path: selected }));
        // Validate the selected vault
        setValidatingVault(true);
        setVaultValid(null);
        const isValid = await validateObsidianVault(selected);
        setVaultValid(isValid);
        setValidatingVault(false);

        if (!isValid) {
          setError('Selected folder does not appear to be a valid Obsidian vault');
        } else {
          setError(null);
        }
      }
    } catch (err) {
      console.error('Failed to browse for vault:', err);
      // Still try to reshow window on error
      try {
        await invoke('show_window');
        useEditorStore.setState({ isVisible: true });
      } catch (e) {
        // Ignore
      }
    }
  };

  const handleSave = async () => {
    if (!config.vault_path) {
      setError('Please select an Obsidian vault');
      return;
    }

    if (config.default_location === 'specific_note' && !config.specific_note_path) {
      setError('Please enter a specific note path');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(false);

    const saved = await saveObsidianConfig(config);

    setSaving(false);

    if (saved) {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } else {
      setError(storeError || 'Failed to save configuration');
    }
  };

  const handleLocationChange = (location: ObsidianLocation) => {
    setConfig((prev) => ({ ...prev, default_location: location }));
  };

  if (!hasObsidianAccess) {
    return (
      <div className="p-6 bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-6 h-6 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Obsidian Integration</h3>
          <ProBadge />
        </div>
        <p className="text-gray-400 mb-4">
          Quick capture to your Obsidian vault with a keyboard-only workflow. Upgrade to Pro to
          unlock this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg
            className="w-6 h-6 text-purple-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <h3 className="text-lg font-semibold text-white">Obsidian Integration</h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-200 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Vault Path */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Vault Path</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={config.vault_path}
            onChange={(e) => setConfig((prev) => ({ ...prev, vault_path: e.target.value }))}
            placeholder="/Users/you/Documents/Obsidian Vault"
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
          />
          <button
            onClick={handleBrowseVault}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Browse
          </button>
        </div>
        {validatingVault && (
          <p className="mt-2 text-sm text-gray-400">Validating vault...</p>
        )}
        {vaultValid === true && (
          <p className="mt-2 text-sm text-green-400">Valid Obsidian vault detected</p>
        )}
        {vaultValid === false && (
          <p className="mt-2 text-sm text-red-400">
            Not a valid Obsidian vault (missing .obsidian folder)
          </p>
        )}
      </div>

      {/* Default Location */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Default Location</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="radio"
              name="location"
              checked={config.default_location === 'daily_note'}
              onChange={() => handleLocationChange('daily_note')}
              className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600"
            />
            <div>
              <p className="text-white font-medium">Daily Note</p>
              <p className="text-sm text-gray-400">Append to today's note (YYYY-MM-DD.md)</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="radio"
              name="location"
              checked={config.default_location === 'specific_note'}
              onChange={() => handleLocationChange('specific_note')}
              className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600"
            />
            <div>
              <p className="text-white font-medium">Specific Note</p>
              <p className="text-sm text-gray-400">Always append to a specific note</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors">
            <input
              type="radio"
              name="location"
              checked={config.default_location === 'new_note'}
              onChange={() => handleLocationChange('new_note')}
              className="w-4 h-4 text-purple-500 bg-gray-700 border-gray-600"
            />
            <div>
              <p className="text-white font-medium">New Note</p>
              <p className="text-sm text-gray-400">Create a new timestamped note each time</p>
            </div>
          </label>
        </div>
      </div>

      {/* Specific Note Path (conditional) */}
      <AnimatePresence>
        {config.default_location === 'specific_note' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Specific Note Path
            </label>
            <input
              type="text"
              value={config.specific_note_path || ''}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, specific_note_path: e.target.value || null }))
              }
              placeholder="folder/Inbox.md"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
            <p className="mt-1 text-xs text-gray-500">Relative path from vault root</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Note Folder (conditional) */}
      <AnimatePresence>
        {config.default_location === 'new_note' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4"
          >
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Folder for New Notes (optional)
            </label>
            <input
              type="text"
              value={config.new_note_folder || ''}
              onChange={(e) =>
                setConfig((prev) => ({ ...prev, new_note_folder: e.target.value || null }))
              }
              placeholder="Captures"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
            />
            <p className="mt-1 text-xs text-gray-500">Leave empty to create notes in vault root</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template (optional) */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Template (optional)
        </label>
        <textarea
          value={config.template || ''}
          onChange={(e) =>
            setConfig((prev) => ({ ...prev, template: e.target.value || null }))
          }
          placeholder="## {{timestamp}}&#10;&#10;{{content}}&#10;&#10;---"
          className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:border-purple-500/50 font-mono text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Available variables: {'{{content}}'}, {'{{timestamp}}'}, {'{{date}}'}
        </p>
      </div>

      {/* Error/Success Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"
          >
            {error}
          </motion.div>
        )}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-400 text-sm"
          >
            Configuration saved successfully!
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !config.vault_path}
        className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Saving...
          </>
        ) : (
          'Save Configuration'
        )}
      </button>
    </div>
  );
}

// Quick capture button for the editor
export function ObsidianCaptureButton({
  content,
  disabled = false,
}: {
  content: string;
  disabled?: boolean;
}) {
  const { addToObsidian, obsidianConfig } = usePremiumStore();
  const { isProFeatureEnabled } = useLicenseStore();
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState(false);

  const hasObsidianAccess = isProFeatureEnabled('obsidian_integration');
  const isConfigured = obsidianConfig && obsidianConfig.vault_path;

  const handleCapture = async () => {
    if (!content.trim() || !hasObsidianAccess || !isConfigured) return;

    setCapturing(true);
    const success = await addToObsidian(content);
    setCapturing(false);

    if (success) {
      setCaptured(true);
      setTimeout(() => setCaptured(false), 2000);
    }
  };

  if (!hasObsidianAccess) {
    return (
      <button
        disabled
        className="flex items-center gap-1.5 px-2 py-1 rounded text-sm text-gray-500"
        title="Pro feature - Send to Obsidian"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
        <ProBadge className="ml-1" />
      </button>
    );
  }

  return (
    <button
      onClick={handleCapture}
      disabled={disabled || !content.trim() || !isConfigured || capturing}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
        captured
          ? 'text-green-400 bg-green-500/10'
          : 'text-purple-400 hover:text-purple-300 hover:bg-purple-500/10'
      } disabled:opacity-50`}
      title={isConfigured ? 'Send to Obsidian' : 'Configure Obsidian in Settings first'}
    >
      {capturing ? (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : captured ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      )}
      {captured ? 'Sent!' : ''}
    </button>
  );
}
