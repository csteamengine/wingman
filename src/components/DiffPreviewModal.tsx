import { useEffect, useCallback } from 'react';
import { DiffView } from './DiffView';
import { useDiffStore } from '../stores/diffStore';
import { useLicenseStore } from '../stores/licenseStore';
import { useSettingsStore } from '../stores/settingsStore';

export function DiffPreviewModal() {
  const {
    pendingDiff,
    showPreviewModal,
    confirmTransformation,
    cancelTransformation,
  } = useDiffStore();
  const { getEffectiveTier } = useLicenseStore();
  const { settings } = useSettingsStore();

  // Premium tier has access to all Pro features
  const effectiveTier = getEffectiveTier();
  const hasDiffPreview = effectiveTier === 'pro' || effectiveTier === 'premium';

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showPreviewModal) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelTransformation();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      confirmTransformation();
    }
  }, [showPreviewModal, cancelTransformation, confirmTransformation]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!hasDiffPreview || !showPreviewModal || !pendingDiff) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          cancelTransformation();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="diff-preview-title"
    >
      <div className="diff-modal max-w-4xl w-[90%] h-[80vh] bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-xl shadow-2xl flex flex-col animate-scale-in">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
          <div>
            <h2 id="diff-preview-title" className="text-sm font-medium text-[var(--ui-text)]">
              Preview Changes
            </h2>
            <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">
              {pendingDiff.transformationType}
            </p>
          </div>
          <button
            onClick={cancelTransformation}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
            aria-label="Close preview"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2l10 10M12 2l-10 10"/>
            </svg>
          </button>
        </div>

        {/* Diff View */}
        <div className="flex-1 min-h-0 flex flex-col p-4">
          <DiffView
            originalText={pendingDiff.originalText}
            transformedText={pendingDiff.transformedText}
            colorblindMode={settings?.colorblind_mode}
          />
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-[var(--ui-border)]">
          <div className="flex items-center gap-2 text-xs text-[var(--ui-text-muted)]">
            <span className="kbd">Esc</span>
            <span>Cancel</span>
            <span className="opacity-30 mx-1">|</span>
            <span className="kbd">Enter</span>
            <span>Apply</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={cancelTransformation}
              className="px-4 py-2 text-sm rounded-md border border-[var(--ui-border)] text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmTransformation}
              className="px-4 py-2 text-sm rounded-md bg-[var(--ui-accent)] text-white hover:opacity-90 transition-opacity"
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
