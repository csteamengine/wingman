import { useDiffStore } from '../stores/diffStore';
import { useLicenseStore } from '../stores/licenseStore';

export function TransformationFloatingButton() {
  const {
    showFloatingButton,
    transformationHistory,
    openReviewModal,
    undoLastTransformation,
    dismissFloatingButton,
  } = useDiffStore();
  const { getEffectiveTier, devTierOverride } = useLicenseStore();

  // Premium tier has access to all Pro features
  const effectiveTier = getEffectiveTier();
  const hasDiffPreview = effectiveTier === 'pro' || effectiveTier === 'premium';
  const latestTransformation = transformationHistory[0];

  if (!hasDiffPreview || !showFloatingButton || !latestTransformation) {
    return null;
  }

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-1 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-lg overflow-hidden">
        {/* Review Changes button */}
        <button
          onClick={openReviewModal}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Review</span>
        </button>

        <div className="w-px h-6 bg-[var(--ui-border)]" />

        {/* Undo button */}
        <button
          onClick={undoLastTransformation}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
          </svg>
          <span>Undo</span>
        </button>

        <div className="w-px h-6 bg-[var(--ui-border)]" />

        {/* Dismiss button */}
        <button
          onClick={dismissFloatingButton}
          className="flex items-center justify-center w-8 h-full py-2.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l8 8M10 2l-8 8"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
