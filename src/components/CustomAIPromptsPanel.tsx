import { useEditorStore } from '../stores/editorStore';
import { PremiumFeatureGate } from './PremiumFeatureGate';
import { CustomAIPromptConfig } from './CustomAIPromptConfig';

export function CustomAIPromptsPanel() {
  return (
    <PremiumFeatureGate feature="custom_ai_prompts">
      <CustomAIPromptsPanelContent />
    </PremiumFeatureGate>
  );
}

function CustomAIPromptsPanelContent() {
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
        <span className="text-sm font-medium text-[var(--ui-text)]">Custom AI Prompts</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <CustomAIPromptConfig />
      </div>
    </div>
  );
}
