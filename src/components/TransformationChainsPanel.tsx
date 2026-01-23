import { useEditorStore } from '../stores/editorStore';

export function TransformationChainsPanel() {
  const { setActivePanel } = useEditorStore();

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ui-border)]">
        <button
          onClick={() => setActivePanel('editor')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors flex-shrink-0"
          aria-label="Back to editor"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3L4.5 7L8.5 11" />
          </svg>
        </button>
        <span className="text-sm font-medium text-[var(--ui-text)]">Transformation Chains</span>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {/* Chain icon */}
        <div className="w-16 h-16 rounded-full bg-[var(--ui-surface)] flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ui-text-muted)]">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-[var(--ui-text)] mb-2">Coming Soon</h2>

        <p className="text-sm text-[var(--ui-text-muted)] max-w-xs">
          Chain multiple transformations together and save them as reusable workflows.
          Apply complex text processing with a single action.
        </p>

        <div className="mt-6 text-xs text-[var(--ui-text-muted)] opacity-60">
          Stay tuned for updates
        </div>
      </div>
    </div>
  );
}
