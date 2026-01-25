import { useEffect, useCallback } from 'react';
import { DiffView } from './DiffView';
import { useDiffStore } from '../stores/diffStore';
import { useLicenseStore } from '../stores/licenseStore';

export function DiffReviewModal() {
  const {
    transformationHistory,
    showReviewModal,
    closeReviewModal,
    undoLastTransformation,
  } = useDiffStore();
  const { getEffectiveTier, devTierOverride } = useLicenseStore();

  // Premium tier has access to all Pro features
  const effectiveTier = getEffectiveTier();
  const hasDiffPreview = effectiveTier === 'pro' || effectiveTier === 'premium';
  const latestTransformation = transformationHistory[0];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showReviewModal) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeReviewModal();
    }
  }, [showReviewModal, closeReviewModal]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!hasDiffPreview || !showReviewModal || !latestTransformation) {
    return null;
  }

  const handleUndo = () => {
    undoLastTransformation();
    closeReviewModal();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeReviewModal();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-review-title"
    >
      <div className="diff-modal max-w-4xl w-[90%] h-[80vh] bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-xl shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
          <div>
            <h2 id="diff-review-title" className="text-sm font-medium text-[var(--ui-text)]">
              Review Changes
            </h2>
            <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
              {latestTransformation.transformationType}
            </p>
          </div>
          <button
            onClick={closeReviewModal}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
            aria-label="Close review"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l10 10M12 2l-10 10"/>
            </svg>
          </button>
        </div>

        {/* Diff View */}
        <div className="flex-1 min-h-0 flex flex-col p-4">
          <DiffView
            originalText={latestTransformation.originalText}
            transformedText={latestTransformation.transformedText}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-[var(--ui-border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--ui-text-muted)]">
            <span className="kbd">Esc</span>
            <span>Close</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={closeReviewModal}
              className="px-4 py-2 text-sm rounded-md border border-[var(--ui-border)] text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleUndo}
              className="px-4 py-2 text-sm rounded-md bg-red-500/80 text-white hover:bg-red-500 transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6"/>
                <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
              </svg>
              Undo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
