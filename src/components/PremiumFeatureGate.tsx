import type { ReactNode } from 'react';
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
  const { isPremiumFeatureEnabled } = usePremiumStore();
  // Subscribe to devTierOverride to force re-render when dev tier changes
  useLicenseStore((state) => state.devTierOverride); // Subscribe to trigger re-render

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

  // Show full-screen lock screen
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-full bg-[var(--ui-surface)] border border-[var(--ui-border)] flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-[var(--ui-accent)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-base font-medium mb-2">
        <FeatureLabel feature={feature} />
      </h3>
      <p className="text-sm text-[var(--ui-text-muted)] mb-4 max-w-xs">
        This is a Premium feature. Upgrade to Wingman Premium for $4.99/month to unlock AI features.
      </p>
      <button
        onClick={async () => {
          try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-premium-checkout`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
              },
            });
            const data = await response.json();
            if (data.url) {
              await open(data.url);
            }
          } catch (err) {
            console.error('Failed to create checkout session:', err);
          }
        }}
        className="btn bg-[var(--ui-accent)] text-white px-4 py-2"
      >
        Upgrade to Premium
      </button>
      <p className="text-xs text-[var(--ui-text-muted)] mt-3">
        Already have a license? Go to Settings to activate.
      </p>
    </div>
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
