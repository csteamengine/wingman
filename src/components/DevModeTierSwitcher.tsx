import { useLicenseStore, isDev } from '../stores/licenseStore';
import { useSettingsStore } from '../stores/settingsStore';
import type { LicenseTier } from '../types';

const tiers: { value: LicenseTier | null; label: string }[] = [
  { value: null, label: 'Real' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
];

export function DevModeTierSwitcher() {
  const { devTierOverride, setDevTierOverride, tier, isDev: isDevLicense } = useLicenseStore();
  const { settings } = useSettingsStore();

  // Only show in development mode OR if user has a dev license AND the setting is enabled
  if (!isDev && !isDevLicense) return null;
  if (!isDev && isDevLicense && !settings?.show_dev_tier_selector) return null;

  const activeTier = devTierOverride ?? null;

  return (
    <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/30">
      <span className="text-[9px] font-medium text-orange-400 uppercase tracking-wide mr-1">Dev</span>
      {tiers.map(({ value, label }) => {
        const isActive = activeTier === value;
        const displayLabel = value === null ? `Real (${tier})` : label;
        return (
          <button
            key={label}
            onClick={(e) => {
              e.stopPropagation();
              setDevTierOverride(value);
            }}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              isActive
                ? 'bg-orange-500 text-white'
                : 'text-orange-300 hover:bg-orange-500/20'
            }`}
            title={value === null ? `Use real tier (currently ${tier})` : `Simulate ${label} tier`}
          >
            {value === null ? 'Real' : displayLabel}
          </button>
        );
      })}
    </div>
  );
}
