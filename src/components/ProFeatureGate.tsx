import type { ReactNode } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { useLicenseStore } from '../stores/licenseStore';
import type { ProFeature } from '../types';

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
      <h3 className="text-lg font-semibold mb-2">{FEATURE_NAMES[feature]}</h3>
      <p className="text-sm text-[var(--editor-muted)] mb-4 max-w-xs">
        This is a Pro feature. Upgrade to Niblet Pro for $4.99 (one-time) to unlock all features.
      </p>
      <button
        onClick={() => open('https://gumroad.com/l/niblet-pro')}
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

// Simple inline gate for conditionally showing elements
export function useProFeature(feature: ProFeature): boolean {
  const { isProFeatureEnabled } = useLicenseStore();
  return isProFeatureEnabled(feature);
}
