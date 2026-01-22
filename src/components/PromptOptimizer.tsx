import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePremiumStore, formatTokenUsage } from '../stores/premiumStore';
import { useLicenseStore } from '../stores/licenseStore';
import { PremiumFeatureGate, PremiumBadge } from './PremiumFeatureGate';

interface PromptOptimizerProps {
  initialText?: string;
  onOptimized?: (optimizedText: string) => void;
  onClose?: () => void;
}

export function PromptOptimizer({ initialText = '', onOptimized, onClose }: PromptOptimizerProps) {
  const [inputText, setInputText] = useState(initialText);
  const [outputText, setOutputText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { callAIFeature, aiLoading, subscriptionStatus, isSubscriptionActive } =
    usePremiumStore();
  const { tier } = useLicenseStore();

  // Get license key from localStorage (stored during activation)
  const getLicenseKey = useCallback((): string | null => {
    try {
      // The license key is stored in the encrypted cache on disk,
      // but we need to get it from somewhere accessible to JS
      // For now, we'll retrieve it from the Tauri backend
      return localStorage.getItem('wingman_license_key') || null;
    } catch {
      return null;
    }
  }, []);

  const handleOptimize = async () => {
    const trimmedInput = inputText.trim();
    if (!trimmedInput) {
      setError('Please enter some text to optimize');
      return;
    }

    const licenseKey = getLicenseKey();
    if (!licenseKey) {
      setError('License key not found. Please re-activate your license.');
      return;
    }

    setError(null);
    setOutputText('');

    const response = await callAIFeature(licenseKey, trimmedInput, 'prompt_optimizer');

    if (response) {
      setOutputText(response.result);
    } else {
      setError('Failed to optimize prompt. Please try again.');
    }
  };

  const handleCopyOutput = async () => {
    if (outputText) {
      try {
        await navigator.clipboard.writeText(outputText);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleUseOutput = () => {
    if (outputText && onOptimized) {
      onOptimized(outputText);
    }
  };

  const isPremiumEnabled = tier === 'premium' && isSubscriptionActive;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-white">AI Prompt Optimizer</h2>
          {!isPremiumEnabled && <PremiumBadge />}
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

      {/* Content */}
      {!isPremiumEnabled ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <PremiumFeatureGate feature="prompt_optimizer">
            {/* This won't render since we're not Premium */}
            <div />
          </PremiumFeatureGate>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden p-4 gap-4">
          {/* Token Usage Bar */}
          {subscriptionStatus && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-400">AI Token Usage</span>
                <span
                  className={`text-sm ${
                    subscriptionStatus.tokens_remaining <= 0
                      ? 'text-red-400'
                      : subscriptionStatus.tokens_remaining < 200000
                        ? 'text-orange-400'
                        : 'text-green-400'
                  }`}
                >
                  {formatTokenUsage(subscriptionStatus.tokens_used)}
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    subscriptionStatus.tokens_remaining <= 0
                      ? 'bg-red-500'
                      : subscriptionStatus.tokens_remaining < 200000
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                  }`}
                  style={{
                    width: `${Math.min(
                      100,
                      (subscriptionStatus.tokens_used / 1000000) * 100
                    )}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Input Section */}
          <div className="flex-1 min-h-0 flex flex-col">
            <label className="text-sm font-medium text-gray-300 mb-2">
              Your rough notes, bullet points, or unstructured text:
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter your rough notes here...&#10;&#10;- Feature requirement 1&#10;- Some technical detail&#10;- Expected behavior"
              className="flex-1 w-full p-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 resize-none focus:outline-none focus:border-amber-500/50 font-mono text-sm"
              disabled={aiLoading}
            />
          </div>

          {/* Optimize Button */}
          <div className="flex justify-center">
            <button
              onClick={handleOptimize}
              disabled={aiLoading || !inputText.trim()}
              className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {aiLoading ? (
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
                  Optimizing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Optimize Prompt
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Output Section */}
          <AnimatePresence>
            {outputText && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex-1 min-h-0 flex flex-col"
              >
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-300">Optimized Prompt:</label>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopyOutput}
                      className="px-2 py-1 text-xs text-gray-400 hover:text-gray-200 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                    >
                      Copy
                    </button>
                    {onOptimized && (
                      <button
                        onClick={handleUseOutput}
                        className="px-2 py-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded transition-colors"
                      >
                        Use This
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-1 w-full p-3 bg-gray-800/50 border border-green-500/30 rounded-lg text-gray-200 overflow-auto font-mono text-sm whitespace-pre-wrap">
                  {outputText}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// Inline prompt optimizer button for the editor toolbar
export function PromptOptimizerButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const { tier } = useLicenseStore();
  const { isSubscriptionActive } = usePremiumStore();
  const isPremium = tier === 'premium' && isSubscriptionActive;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-sm transition-colors ${
        isPremium
          ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10'
          : 'text-gray-500 hover:text-gray-400'
      } disabled:opacity-50`}
      title={isPremium ? 'Optimize with AI' : 'Premium feature - Optimize with AI'}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      {!isPremium && <PremiumBadge className="ml-1" />}
    </button>
  );
}
