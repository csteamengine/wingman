import { useState, useEffect, useCallback } from 'react';
import { useCustomTransformationsStore } from '../stores/customTransformationsStore';
import { useLicenseStore } from '../stores/licenseStore';
import type { CustomTransformation } from '../types';

const DEFAULT_CODE = `// Transform the input text and return the result
// The 'text' variable contains the input
// Return the transformed string

return text.toUpperCase();`;

const EXAMPLE_TRANSFORMATIONS = [
  {
    name: 'Reverse Text',
    description: 'Reverses the entire text',
    code: `return text.split('').reverse().join('');`,
  },
  {
    name: 'Remove Empty Lines',
    description: 'Removes all empty lines from the text',
    code: `return text.split('\\n').filter(line => line.trim() !== '').join('\\n');`,
  },
  {
    name: 'Add Line Numbers',
    description: 'Prefixes each line with its number',
    code: `return text.split('\\n').map((line, i) => \`\${i + 1}. \${line}\`).join('\\n');`,
  },
  {
    name: 'Snake Case',
    description: 'Converts text to snake_case',
    code: `return text
  .replace(/([a-z])([A-Z])/g, '$1_$2')
  .replace(/[\\s-]+/g, '_')
  .toLowerCase();`,
  },
  {
    name: 'Camel Case',
    description: 'Converts text to camelCase',
    code: `return text
  .replace(/[_\\s-]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
  .replace(/^./, s => s.toLowerCase());`,
  },
];

interface TransformationEditorProps {
  transformation: CustomTransformation | null;
  onSave: (data: Omit<CustomTransformation, 'id' | 'created_at' | 'updated_at'>) => void;
  onCancel: () => void;
  onTest: (code: string) => { success: boolean; result?: string; error?: string };
}

function TransformationEditor({ transformation, onSave, onCancel, onTest }: TransformationEditorProps) {
  const [name, setName] = useState(transformation?.name || '');
  const [description, setDescription] = useState(transformation?.description || '');
  const [code, setCode] = useState(transformation?.code || DEFAULT_CODE);
  const [testResult, setTestResult] = useState<{ success: boolean; result?: string; error?: string } | null>(null);
  const [showExamples, setShowExamples] = useState(false);

  const handleTest = useCallback(() => {
    const result = onTest(code);
    setTestResult(result);
  }, [code, onTest]);

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      code,
      language: 'javascript',
      enabled: transformation?.enabled ?? true,
    });
  }, [name, description, code, transformation, onSave]);

  const handleUseExample = useCallback((example: typeof EXAMPLE_TRANSFORMATIONS[0]) => {
    setName(example.name);
    setDescription(example.description);
    setCode(example.code);
    setShowExamples(false);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
        <h3 className="text-sm font-medium text-[var(--ui-text)]">
          {transformation ? 'Edit Transformation' : 'New Transformation'}
        </h3>
        <button
          onClick={onCancel}
          className="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l10 10M12 2l-10 10"/>
          </svg>
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-[var(--ui-text)] mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Transformation"
            className="w-full px-3 py-2 text-sm bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)]"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-[var(--ui-text)] mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this transformation do?"
            className="w-full px-3 py-2 text-sm bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)]"
          />
        </div>

        {/* Code */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-[var(--ui-text)]">JavaScript Code</label>
            <button
              onClick={() => setShowExamples(!showExamples)}
              className="text-xs text-[var(--ui-accent)] hover:underline"
            >
              {showExamples ? 'Hide Examples' : 'Show Examples'}
            </button>
          </div>

          {showExamples && (
            <div className="mb-2 p-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md">
              <p className="text-xs text-[var(--ui-text-muted)] mb-2">Click an example to use it:</p>
              <div className="space-y-1">
                {EXAMPLE_TRANSFORMATIONS.map((example, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleUseExample(example)}
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-[var(--ui-hover)]"
                  >
                    <span className="font-medium text-[var(--ui-text)]">{example.name}</span>
                    <span className="text-[var(--ui-text-muted)]"> - {example.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={10}
            spellCheck={false}
            className="w-full px-3 py-2 text-sm font-mono bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-[var(--ui-text)] resize-none"
          />
          <p className="text-xs text-[var(--ui-text-muted)] mt-1">
            The <code className="bg-[var(--ui-surface)] px-1 rounded">text</code> variable contains the input. Return the transformed string.
          </p>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`p-3 rounded-md text-sm ${testResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
            {testResult.success ? (
              <>
                <p className="text-green-400 font-medium text-xs mb-1">Test Passed</p>
                <pre className="text-xs text-[var(--ui-text)] whitespace-pre-wrap break-all max-h-24 overflow-y-auto">
                  {testResult.result}
                </pre>
              </>
            ) : (
              <>
                <p className="text-red-400 font-medium text-xs mb-1">Error</p>
                <pre className="text-xs text-red-400 whitespace-pre-wrap">{testResult.error}</pre>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--ui-border)]">
        <button
          onClick={handleTest}
          className="px-3 py-1.5 text-sm text-[var(--ui-text)] border border-[var(--ui-border)] rounded-md hover:bg-[var(--ui-hover)]"
        >
          Test with Sample
        </button>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-[var(--ui-text)] border border-[var(--ui-border)] rounded-md hover:bg-[var(--ui-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm bg-[var(--ui-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function CustomTransformationsPanel() {
  const {
    transformations,
    loading,
    loadTransformations,
    addTransformation,
    updateTransformation,
    deleteTransformation,
    toggleTransformation,
  } = useCustomTransformationsStore();

  const { getEffectiveTier } = useLicenseStore();

  // Premium tier has access to all Pro features
  const effectiveTier = getEffectiveTier();
  const hasAccess = effectiveTier === 'pro' || effectiveTier === 'premium';

  const [editing, setEditing] = useState<CustomTransformation | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadTransformations();
  }, [loadTransformations]);

  const handleTest = useCallback((code: string) => {
    const testText = 'Hello World\nThis is a test.\nLine 3';
    try {
      const wrappedCode = `
        "use strict";
        return (function(text) {
          ${code}
        })(inputText);
      `;
      const fn = new Function('inputText', wrappedCode);
      const result = fn(testText);

      if (result === undefined || result === null) {
        return { success: false, error: 'Function returned undefined/null' };
      }

      return { success: true, result: String(result) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }, []);

  const handleSave = useCallback((data: Omit<CustomTransformation, 'id' | 'created_at' | 'updated_at'>) => {
    if (editing) {
      updateTransformation(editing.id, data);
    } else {
      addTransformation(data);
    }
    setEditing(null);
    setIsCreating(false);
  }, [editing, updateTransformation, addTransformation]);

  const handleDelete = useCallback((id: string) => {
    deleteTransformation(id);
    setDeleteConfirm(null);
  }, [deleteTransformation]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg className="w-12 h-12 text-[var(--ui-accent)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h3 className="text-sm font-medium text-[var(--ui-text)] mb-2">Pro Feature</h3>
        <p className="text-xs text-[var(--ui-text-muted)]">
          Custom text transformations require a Pro license.
        </p>
      </div>
    );
  }

  if (isCreating || editing) {
    return (
      <TransformationEditor
        transformation={editing}
        onSave={handleSave}
        onCancel={() => {
          setEditing(null);
          setIsCreating(false);
        }}
        onTest={handleTest}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
        <h3 className="text-sm font-medium text-[var(--ui-text)]">Custom Transformations</h3>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--ui-accent)] text-white rounded-md hover:opacity-90"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-[var(--ui-accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : transformations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center p-4">
            <p className="text-sm text-[var(--ui-text-muted)] mb-2">No custom transformations yet</p>
            <button
              onClick={() => setIsCreating(true)}
              className="text-xs text-[var(--ui-accent)] hover:underline"
            >
              Create your first transformation
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[var(--ui-border)]">
            {transformations.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--ui-hover)]"
              >
                {/* Toggle */}
                <button
                  onClick={() => toggleTransformation(t.id)}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                    t.enabled ? 'bg-[var(--ui-accent)]' : 'bg-[var(--ui-border)]'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                      t.enabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--ui-text)] truncate">{t.name}</p>
                  {t.description && (
                    <p className="text-xs text-[var(--ui-text-muted)] truncate">{t.description}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditing(t)}
                    className="p-1.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface)] rounded"
                    title="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  {deleteConfirm === t.id ? (
                    <>
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded"
                        title="Confirm delete"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 13l4 4L19 7"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="p-1.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-surface)] rounded"
                        title="Cancel"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(t.id)}
                      className="p-1.5 text-[var(--ui-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded"
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
