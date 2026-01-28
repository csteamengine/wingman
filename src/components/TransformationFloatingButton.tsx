import {Eye, Undo2, X} from 'lucide-react';
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
  const { getEffectiveTier } = useLicenseStore();

  // Premium tier has access to all Pro features
  const effectiveTier = getEffectiveTier();
  const hasDiffPreview = effectiveTier === 'pro' || effectiveTier === 'premium';
  const latestTransformation = transformationHistory[0];

  if (!hasDiffPreview || !showFloatingButton || !latestTransformation) {
    return null;
  }

  return (
    <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className="flex items-center gap-1 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-lg overflow-hidden">
        {/* Review Changes button */}
        <button
          onClick={openReviewModal}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Review</span>
        </button>

        <div className="w-px h-6 bg-[var(--ui-border)]" />

        {/* Undo button */}
        <button
          onClick={undoLastTransformation}
          className="flex items-center gap-2 px-3 py-2.5 text-sm text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span>Undo</span>
        </button>

        <div className="w-px h-6 bg-[var(--ui-border)]" />

        {/* Dismiss button */}
        <button
          onClick={dismissFloatingButton}
          className="flex items-center justify-center w-8 h-full py-2.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
