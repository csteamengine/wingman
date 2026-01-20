import { useState, useEffect } from 'react';
import { usePremiumStore } from '../stores/premiumStore';

export function AIConfig() {
  const { aiConfig, loadAIConfig, saveAIConfig } = usePremiumStore();
  const [systemInstructions, setSystemInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    loadAIConfig();
  }, [loadAIConfig]);

  useEffect(() => {
    if (aiConfig) {
      setSystemInstructions(aiConfig.system_instructions);
    }
  }, [aiConfig]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    const success = await saveAIConfig({
      system_instructions: systemInstructions,
    });

    setSaving(false);
    if (success) {
      setSaveMessage('Configuration saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveMessage('Failed to save configuration');
    }
  };

  const handleReset = () => {
    const defaultInstructions = 'You are an expert at refining text for AI prompts. Take the user\'s stream of consciousness or rough notes and transform them into clear, well-structured prompts optimized for Claude Code or other AI assistants. Focus on clarity, specificity, and actionable instructions.';
    setSystemInstructions(defaultInstructions);
  };

  return (
    <div className="p-4 bg-[var(--editor-bg)] rounded-lg border border-[var(--editor-border)] space-y-4">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[var(--editor-text)]">
            System Instructions
          </label>
          <button
            onClick={handleReset}
            className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            Reset to Default
          </button>
        </div>
        <p className="text-xs text-[var(--editor-muted)] mb-2">
          Customize how the AI refines your text. This instruction tells the AI how to process and improve your content.
        </p>
        <textarea
          value={systemInstructions}
          onChange={(e) => setSystemInstructions(e.target.value)}
          rows={6}
          className="w-full px-3 py-2 text-sm bg-[var(--editor-surface)] text-[var(--editor-text)] border border-[var(--editor-border)] rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
          placeholder="Enter system instructions for the AI..."
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex-1">
          {saveMessage && (
            <p
              className={`text-xs ${
                saveMessage.includes('success') ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {saveMessage}
            </p>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !systemInstructions.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      <div className="pt-3 border-t border-[var(--editor-border)]">
        <p className="text-xs text-[var(--editor-muted)] leading-relaxed">
          <strong>Tip:</strong> The AI button refines your text based on these instructions.
          You can customize this for different use cases:
        </p>
        <ul className="mt-2 space-y-1 text-xs text-[var(--editor-muted)] list-disc list-inside">
          <li>Optimizing prompts for Claude Code</li>
          <li>Converting notes to professional emails</li>
          <li>Formatting documentation</li>
          <li>Creating social media posts</li>
        </ul>
      </div>
    </div>
  );
}
