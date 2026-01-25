import { useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-shell';
import { usePremiumStore } from '../stores/premiumStore';
import { useLicenseStore } from '../stores/licenseStore';
import type { PremiumFeature } from '../types';

const SUPABASE_URL = 'https://yhpetdqcmqpfwhdtbhat.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_t4l4DUhI_I2rpT9pMU8dgg_Y2j55oJY';

interface PremiumFeatureGateProps {
  feature: PremiumFeature;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

export function PremiumFeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: PremiumFeatureGateProps) {
  const { isPremiumFeatureEnabled, isAtTokenLimit, subscriptionStatus } = usePremiumStore();
  const { getEffectiveTier } = useLicenseStore();
  const effectiveTier = getEffectiveTier();
  const [showModal, setShowModal] = useState(false);

  const isEnabled = isPremiumFeatureEnabled(feature);

  // If feature is enabled, render children
  if (isEnabled) {
    return <>{children}</>;
  }

  // If we have a fallback, render that
  if (fallback) {
    return <>{fallback}</>;
  }

  // If we don't want to show upgrade prompt, return null
  if (!showUpgradePrompt) {
    return null;
  }

  // Determine why the feature is locked
  const isTokenLimitReached = effectiveTier === 'premium' && isAtTokenLimit;
  const subscriptionExpired = effectiveTier === 'premium' && !subscriptionStatus?.is_active;

  const handleUpgradeClick = async () => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/create-premium-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
      });
      const data = await response.json();
      console.log('Premium checkout response:', data);
      if (data.url) {
        await open(data.url);
        setShowModal(false);
      }
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-amber-500/50 hover:text-amber-400 transition-colors cursor-pointer"
      >
        <span className="text-amber-500">Premium</span>
        <FeatureLabel feature={feature} />
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-900 rounded-xl border border-gray-700 p-6 max-w-md w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {isTokenLimitReached ? (
                <TokenLimitContent
                  onClose={() => setShowModal(false)}
                />
              ) : subscriptionExpired ? (
                <SubscriptionExpiredContent
                  onUpgrade={handleUpgradeClick}
                  onClose={() => setShowModal(false)}
                />
              ) : (
                <UpgradeContent
                  feature={feature}
                  onUpgrade={handleUpgradeClick}
                  onClose={() => setShowModal(false)}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function FeatureLabel({ feature }: { feature: PremiumFeature }) {
  const labels: Record<PremiumFeature, string> = {
    prompt_optimizer: 'AI Prompt Optimizer',
    ai_features: 'AI Features',
    custom_ai_prompts: 'Custom AI Prompts',
  };
  return <span>{labels[feature]}</span>;
}

function UpgradeContent({
  feature,
  onUpgrade,
  onClose,
}: {
  feature: PremiumFeature;
  onUpgrade: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Upgrade to Premium</h3>
          <p className="text-sm text-gray-400">$4.99/month</p>
        </div>
      </div>

      <p className="text-gray-300 mb-4">
        <FeatureLabel feature={feature} /> is a Premium feature. Upgrade to unlock:
      </p>

      <ul className="space-y-2 mb-6">
        <li className="flex items-center gap-2 text-sm text-gray-300">
          <span className="text-green-400">✓</span>
          AI Prompt Optimizer - Transform rough notes into polished prompts
        </li>
        <li className="flex items-center gap-2 text-sm text-gray-300">
          <span className="text-green-400">✓</span>
          Custom AI Prompts - Create your own AI prompt templates
        </li>
        <li className="flex items-center gap-2 text-sm text-gray-300">
          <span className="text-green-400">✓</span>
          AI Presets - Email, Slack, Git commits, and more
        </li>
        <li className="flex items-center gap-2 text-sm text-gray-300">
          <span className="text-green-400">✓</span>
          1,000,000 AI tokens per month
        </li>
        <li className="flex items-center gap-2 text-sm text-gray-300">
          <span className="text-green-400">✓</span>
          All Pro features included
        </li>
      </ul>

      <div className="flex gap-3">
        <button
          onClick={onUpgrade}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-700 transition-colors"
        >
          Upgrade Now
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </>
  );
}

function TokenLimitContent({
  onClose,
}: {
  onClose: () => void;
}) {
  // Calculate reset date (1st of next month)
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const resetDateStr = nextMonth.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-orange-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Token Limit Reached</h3>
          <p className="text-sm text-gray-400">Monthly allowance used</p>
        </div>
      </div>

      <p className="text-gray-300 mb-4">
        You've used all 1,000,000 AI tokens for this month. Your limit will reset on{' '}
        <span className="text-amber-400 font-medium">{resetDateStr}</span>.
      </p>

      <div className="bg-gray-800/50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Token Usage</span>
          <span className="text-sm text-orange-400">100%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full w-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full" />
        </div>
        <p className="text-xs text-gray-500 mt-2">1,000,000 / 1,000,000 tokens used</p>
      </div>

      <button
        onClick={onClose}
        className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
      >
        Got It
      </button>
    </>
  );
}

function SubscriptionExpiredContent({
  onUpgrade,
  onClose,
}: {
  onUpgrade: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Subscription Expired</h3>
          <p className="text-sm text-gray-400">Renew to continue using AI features</p>
        </div>
      </div>

      <p className="text-gray-300 mb-4">
        Your Premium subscription has expired. You still have access to Pro features, but AI
        features require an active subscription.
      </p>

      <div className="flex gap-3">
        <button
          onClick={onUpgrade}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-medium rounded-lg hover:from-amber-600 hover:to-orange-700 transition-colors"
        >
          Renew Subscription
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
        >
          Close
        </button>
      </div>
    </>
  );
}

// Badge component for showing Premium lock on features
export function PremiumBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-amber-400 bg-amber-500/10 rounded border border-amber-500/20 ${className}`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clipRule="evenodd"
        />
      </svg>
      Premium
    </span>
  );
}
