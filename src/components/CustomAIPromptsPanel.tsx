import { useEditorStore } from '../stores/editorStore';
import { ProFeatureGate } from './ProFeatureGate';
import { CustomAIPromptConfig } from './CustomAIPromptConfig';
import { X } from 'lucide-react';

export function CustomAIPromptsPanel() {
  return (
    <ProFeatureGate feature="custom_ai_prompts">
      <CustomAIPromptsPanelContent />
    </ProFeatureGate>
  );
}

function CustomAIPromptsPanelContent() {
  const { setActivePanel } = useEditorStore();

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
        <h2 className="text-sm font-medium text-[var(--ui-text)]">
          Custom AI Prompts
        </h2>
        <button
          onClick={() => setActivePanel('editor')}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
          aria-label="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        <CustomAIPromptConfig />
      </div>
    </div>
  );
}
