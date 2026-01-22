import type { ReactNode } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { useLicenseStore } from '../stores/licenseStore';
import type { ProFeature } from '../types';

const SUPABASE_URL = 'https://yhpetdqcmqpfwhdtbhat.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_t4l4DUhI_I2rpT9pMU8dgg_Y2j55oJY';

interface ProFeatureGateProps {
  feature: ProFeature;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradePrompt?: boolean;
}

const FEATURE_NAMES: Record<ProFeature, string> = {
  history: 'History',
  syntax_highlighting: 'Syntax Highlighting',
  snippets: 'Snippets',
  custom_themes: 'Custom Themes',
  stats_display: 'Stats Display',
  export_history: 'Export History',
  json_xml_formatting: 'JSON/XML Formatting',
  encode_decode: 'Encode/Decode',
  image_attachments: 'Image Attachments',
  obsidian_integration: 'Obsidian Integration',
  font_customization: 'Font Customization',
  opacity_control: 'Opacity Control',
  sticky_mode: 'Sticky Window Mode',
};

export function ProFeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true,
}: ProFeatureGateProps) {
  const { isProFeatureEnabled } = useLicenseStore();
  const isEnabled = isProFeatureEnabled(feature);

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center animate-fade-in">
      <div className="w-12 h-12 rounded-full bg-[var(--editor-surface)] border border-[var(--editor-border)] flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-[var(--editor-accent)]"
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
      <h3 className="text-base font-medium mb-2">{FEATURE_NAMES[feature]}</h3>
      <p className="text-sm text-[var(--editor-muted)] mb-4 max-w-xs">
        This is a Pro feature. Upgrade to Wingman Pro for $4.99 (one-time) to unlock all features.
      </p>
      <button
        onClick={async () => {
          try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
              },
            });
            const data = await response.json();
            if (data.url) {
              open(data.url);
            }
          } catch (err) {
            console.error('Failed to create checkout session:', err);
          }
        }}
        className="btn bg-[var(--editor-accent)] text-white px-4 py-2"
      >
        Upgrade to Pro
      </button>
      <p className="text-xs text-[var(--editor-muted)] mt-3">
        Already have a license? Go to Settings to activate.
      </p>
    </div>
  );
}


// Badge component for showing Pro lock on features
export function ProBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium text-green-400 bg-green-500/10 rounded border border-green-500/20 ${className}`}
    >
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
          clipRule="evenodd"
        />
      </svg>
      Pro
    </span>
  );
}
