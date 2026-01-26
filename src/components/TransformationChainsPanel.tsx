import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useTransformationChainsStore } from '../stores/transformationChainsStore';
import { useCustomTransformationsStore } from '../stores/customTransformationsStore';
import { useLicenseStore } from '../stores/licenseStore';
import { ProFeatureGate } from './ProFeatureGate';
import type { TransformationChain, ChainStep } from '../types';

type ViewMode = 'list' | 'edit';

// Built-in transformations available for chains
const BUILTIN_TRANSFORMATIONS = [
  { id: 'uppercase', name: 'UPPERCASE', description: 'Convert to uppercase' },
  { id: 'lowercase', name: 'lowercase', description: 'Convert to lowercase' },
  { id: 'titlecase', name: 'Title Case', description: 'Capitalize first letter of each word' },
  { id: 'sentencecase', name: 'Sentence case', description: 'Capitalize first letter of sentences' },
  { id: 'trim', name: 'Trim', description: 'Remove leading/trailing whitespace' },
  { id: 'sort', name: 'Sort Lines', description: 'Sort lines alphabetically' },
  { id: 'deduplicate', name: 'Deduplicate', description: 'Remove duplicate lines' },
  { id: 'reverse', name: 'Reverse', description: 'Reverse line order' },
];

export function TransformationChainsPanel() {
  return (
    <ProFeatureGate feature="transformation_chains">
      <TransformationChainsPanelContent />
    </ProFeatureGate>
  );
}

function TransformationChainsPanelContent() {
  const { setActivePanel } = useEditorStore();
  const {
    chains,
    loading,
    loadChains,
    addChain,
    updateChain,
    deleteChain,
    toggleChain,
  } = useTransformationChainsStore();
  const {
    loadTransformations: loadCustomTransformations,
    getEnabledTransformations,
  } = useCustomTransformationsStore();
  const { getEffectiveTier } = useLicenseStore();
  const effectiveTier = getEffectiveTier();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingChain, setEditingChain] = useState<TransformationChain | null>(null);
  const [showStepPicker, setShowStepPicker] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [draggedStepId, setDraggedStepId] = useState<string | null>(null);
  const [dragOverStepId, setDragOverStepId] = useState<string | null>(null);
  const stepRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // Form state for editing
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Check if custom transformations are available based on effective tier
  const hasCustomTransformations = effectiveTier === 'pro' || effectiveTier === 'premium';

  // Load chains and custom transformations on mount
  useEffect(() => {
    loadChains();
    loadCustomTransformations();
  }, [loadChains, loadCustomTransformations]);

  const handleCreateChain = useCallback(() => {
    setEditingChain({
      id: '',
      name: '',
      description: '',
      steps: [],
      created_at: '',
      updated_at: '',
      enabled: true,
    });
    setFormName('');
    setFormDescription('');
    setViewMode('edit');
  }, []);

  const handleEditChain = useCallback((chain: TransformationChain) => {
    setEditingChain(chain);
    setFormName(chain.name);
    setFormDescription(chain.description);
    setViewMode('edit');
  }, []);

  const handleSaveChain = useCallback(() => {
    if (!editingChain || !formName.trim()) return;

    if (editingChain.id) {
      // Update existing chain
      updateChain(editingChain.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        steps: editingChain.steps,
      });
    } else {
      // Create new chain
      addChain({
        name: formName.trim(),
        description: formDescription.trim(),
        steps: editingChain.steps,
        enabled: true,
      });
    }

    setViewMode('list');
    setEditingChain(null);
  }, [editingChain, formName, formDescription, addChain, updateChain]);

  const handleCancelEdit = useCallback(() => {
    setViewMode('list');
    setEditingChain(null);
  }, []);

  const handleAddStep = useCallback((type: 'builtin' | 'custom', transformId: string, name: string) => {
    if (!editingChain) return;

    const newStep: ChainStep = {
      id: crypto.randomUUID(),
      type,
      transformId,
      name,
    };

    setEditingChain({
      ...editingChain,
      steps: [...editingChain.steps, newStep],
    });

    setShowStepPicker(false);
  }, [editingChain]);

  const handleRemoveStep = useCallback((stepId: string) => {
    if (!editingChain) return;

    setEditingChain({
      ...editingChain,
      steps: editingChain.steps.filter((s) => s.id !== stepId),
    });
  }, [editingChain]);

  const handleMoveStepUp = useCallback((stepId: string) => {
    if (!editingChain) return;

    const steps = [...editingChain.steps];
    const index = steps.findIndex((s) => s.id === stepId);

    if (index <= 0) return; // Already at top

    // Swap with previous item
    [steps[index - 1], steps[index]] = [steps[index], steps[index - 1]];

    setEditingChain({
      ...editingChain,
      steps,
    });
  }, [editingChain]);

  const handleMoveStepDown = useCallback((stepId: string) => {
    if (!editingChain) return;

    const steps = [...editingChain.steps];
    const index = steps.findIndex((s) => s.id === stepId);

    if (index === -1 || index >= steps.length - 1) return; // Already at bottom

    // Swap with next item
    [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];

    setEditingChain({
      ...editingChain,
      steps,
    });
  }, [editingChain]);

  const handleDeleteChain = useCallback((id: string) => {
    deleteChain(id);
    setDeleteConfirmId(null);
  }, [deleteChain]);

  // Mouse-based drag and drop for step reordering (HTML5 drag doesn't work in Tauri)
  const handleMouseDragStart = useCallback((e: React.MouseEvent, stepId: string) => {
    if (e.button !== 0) return; // Only left click
    e.preventDefault();
    setDraggedStepId(stepId);
  }, []);

  // Handle mouse move and mouse up globally when dragging
  useEffect(() => {
    if (!draggedStepId || !editingChain) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Find which step we're hovering over
      let foundStepId: string | null = null;
      stepRefsMap.current.forEach((el, id) => {
        if (el && id !== draggedStepId) {
          const rect = el.getBoundingClientRect();
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            foundStepId = id;
          }
        }
      });
      setDragOverStepId(foundStepId);
    };

    const handleMouseUp = () => {
      if (draggedStepId && dragOverStepId && draggedStepId !== dragOverStepId) {
        const steps = [...editingChain.steps];
        const draggedIndex = steps.findIndex((s) => s.id === draggedStepId);
        const targetIndex = steps.findIndex((s) => s.id === dragOverStepId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
          const [draggedStep] = steps.splice(draggedIndex, 1);
          steps.splice(targetIndex, 0, draggedStep);

          setEditingChain({
            ...editingChain,
            steps,
          });
        }
      }
      setDraggedStepId(null);
      setDragOverStepId(null);
    };

    // Add global listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Add cursor style while dragging
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [draggedStepId, dragOverStepId, editingChain]);

  // Render the list view
  const renderListView = () => (
    <div className="flex flex-col h-full">
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
        <div className="flex-1" />
        <button
          onClick={handleCreateChain}
          className="text-xs px-2 py-1 rounded-md bg-[var(--ui-accent)] text-white hover:brightness-110 transition-all flex-shrink-0"
        >
          + New
        </button>
      </div>

      {/* Chain list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <svg className="w-5 h-5 animate-spin text-[var(--ui-text-muted)]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : chains.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--ui-surface)] flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ui-text-muted)]">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
            </div>
            <h3 className="text-sm font-medium text-[var(--ui-text)] mb-1">No Chains Yet</h3>
            <p className="text-xs text-[var(--ui-text-muted)] mb-4 max-w-[200px]">
              Create a chain to combine multiple transformations into a single action.
            </p>
            <button
              onClick={handleCreateChain}
              className="text-xs text-[var(--ui-accent)] hover:underline"
            >
              Create your first chain
            </button>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {chains.map((chain) => (
              <div
                key={chain.id}
                className="group px-3 py-2.5 rounded-md hover:bg-[var(--ui-hover)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleChain(chain.id)}
                    className={`w-8 h-5 rounded-full transition-colors relative flex-shrink-0 ${
                      chain.enabled ? 'bg-[var(--ui-accent)]' : 'bg-[var(--ui-border)]'
                    }`}
                    title={chain.enabled ? 'Disable chain' : 'Enable chain'}
                  >
                    <span
                      className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        chain.enabled ? 'left-3.5' : 'left-0.5'
                      }`}
                    />
                  </button>

                  {/* Chain info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--ui-text)] truncate">{chain.name}</div>
                    <div className="text-xs text-[var(--ui-text-muted)] truncate">
                      {chain.steps.length} step{chain.steps.length !== 1 ? 's' : ''}
                      {chain.description && ` - ${chain.description}`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditChain(chain)}
                      className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ui-surface)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]"
                      title="Edit chain"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8.5 1.5l2 2L4 10H2V8l6.5-6.5z" />
                      </svg>
                    </button>
                    {deleteConfirmId === chain.id ? (
                      <>
                        <button
                          onClick={() => handleDeleteChain(chain.id)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"
                          title="Confirm delete"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 6l3 3 5-5" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ui-surface)] text-[var(--ui-text-muted)]"
                          title="Cancel"
                        >
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 2l8 8M10 2l-8 8" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(chain.id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-[var(--ui-text-muted)] hover:text-red-400"
                        title="Delete chain"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1.5 3h9M4.5 3V2a1 1 0 011-1h1a1 1 0 011 1v1M9.5 3v7a1 1 0 01-1 1h-5a1 1 0 01-1-1V3" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-[var(--ui-border)] text-xs text-[var(--ui-text-muted)]">
        Enabled chains appear in Quick Actions
      </div>
    </div>
  );

  // Render the edit view
  const renderEditView = () => {
    if (!editingChain) return null;

    const enabledCustomTransforms = hasCustomTransformations ? getEnabledTransformations() : [];

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ui-border)]">
          <button
            onClick={handleCancelEdit}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors flex-shrink-0"
            aria-label="Back to list"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 3L4.5 7L8.5 11" />
            </svg>
          </button>
          <span className="text-sm font-medium text-[var(--ui-text)]">
            {editingChain.id ? 'Edit Chain' : 'New Chain'}
          </span>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-auto p-3 space-y-4">
          {/* Name input */}
          <div>
            <label className="block text-xs font-medium text-[var(--ui-text-muted)] mb-1">
              Name
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g., Clean & Format"
              className="w-full px-3 py-2 text-sm bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)]"
            />
          </div>

          {/* Description input */}
          <div>
            <label className="block text-xs font-medium text-[var(--ui-text-muted)] mb-1">
              Description (optional)
            </label>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="What does this chain do?"
              rows={2}
              className="w-full px-3 py-2 text-sm bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)] resize-none"
            />
          </div>

          {/* Steps */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[var(--ui-text-muted)]">
                Steps ({editingChain.steps.length})
              </label>
              <button
                onClick={() => setShowStepPicker(true)}
                className="text-xs text-[var(--ui-accent)] hover:underline"
              >
                + Add Step
              </button>
            </div>

            {editingChain.steps.length === 0 ? (
              <div className="px-3 py-6 text-center border border-dashed border-[var(--ui-border)] rounded-md">
                <p className="text-xs text-[var(--ui-text-muted)] mb-2">No steps yet</p>
                <button
                  onClick={() => setShowStepPicker(true)}
                  className="text-xs text-[var(--ui-accent)] hover:underline"
                >
                  Add your first step
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {editingChain.steps.map((step, index) => (
                  <div
                    key={step.id}
                    ref={(el) => {
                      if (el) stepRefsMap.current.set(step.id, el);
                      else stepRefsMap.current.delete(step.id);
                    }}
                    onMouseDown={(e) => handleMouseDragStart(e, step.id)}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--ui-surface)] border transition-all select-none ${
                      draggedStepId === step.id
                        ? 'opacity-40 border-[var(--ui-border)]'
                        : dragOverStepId === step.id
                        ? 'border-[var(--ui-accent)] border-2'
                        : 'border-[var(--ui-border)]'
                    } cursor-grab`}
                  >
                    {/* Drag handle */}
                    <div className="text-[var(--ui-text-muted)]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                        <circle cx="2.5" cy="2.5" r="1" />
                        <circle cx="7.5" cy="2.5" r="1" />
                        <circle cx="2.5" cy="7.5" r="1" />
                        <circle cx="7.5" cy="7.5" r="1" />
                      </svg>
                    </div>

                    {/* Step number */}
                    <span className="w-5 h-5 flex items-center justify-center text-[10px] rounded bg-[var(--ui-accent)]/20 text-[var(--ui-accent)]">
                      {index + 1}
                    </span>

                    {/* Step info */}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-[var(--ui-text)] truncate">{step.name}</span>
                      <span className="ml-2 text-[10px] text-[var(--ui-text-muted)]">
                        {step.type === 'builtin' ? 'Built-in' : 'Custom'}
                      </span>
                    </div>

                    {/* Move buttons */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStepUp(step.id);
                        }}
                        disabled={index === 0}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Move up"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 8V2M2 5l3-3 3 3" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveStepDown(step.id);
                        }}
                        disabled={index === editingChain.steps.length - 1}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        title="Move down"
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 2v6M2 5l3 3 3-3" />
                        </svg>
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStep(step.id);
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-[var(--ui-text-muted)] hover:text-red-400 transition-all"
                      title="Remove step"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 1l8 8M9 1l-8 8" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-3 py-3 border-t border-[var(--ui-border)] flex gap-2">
          <button
            onClick={handleCancelEdit}
            className="flex-1 px-3 py-2 text-sm rounded-md border border-[var(--ui-border)] text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveChain}
            disabled={!formName.trim()}
            className="flex-1 px-3 py-2 text-sm rounded-md bg-[var(--ui-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {editingChain.id ? 'Save' : 'Create'}
          </button>
        </div>

        {/* Step Picker Modal */}
        {showStepPicker && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-xl w-full max-w-sm max-h-[80%] flex flex-col">
              {/* Modal header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--ui-border)]">
                <h3 className="text-sm font-medium text-[var(--ui-text)]">Add Step</h3>
                <button
                  onClick={() => setShowStepPicker(false)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)]"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2l8 8M10 2l-8 8" />
                  </svg>
                </button>
              </div>

              {/* Modal content */}
              <div className="flex-1 overflow-auto p-2">
                {/* Built-in section */}
                <div className="mb-3">
                  <div className="px-2 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
                    Built-in Transformations
                  </div>
                  <div className="space-y-0.5">
                    {BUILTIN_TRANSFORMATIONS.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleAddStep('builtin', t.id, t.name)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--ui-hover)] transition-colors"
                      >
                        <div className="text-sm text-[var(--ui-text)]">{t.name}</div>
                        <div className="text-xs text-[var(--ui-text-muted)]">{t.description}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom section */}
                {hasCustomTransformations && enabledCustomTransforms.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-xs font-medium text-[var(--ui-text-muted)]">
                      Custom Transformations
                    </div>
                    <div className="space-y-0.5">
                      {enabledCustomTransforms.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => handleAddStep('custom', t.id, t.name)}
                          className="w-full text-left px-3 py-2 rounded-md hover:bg-[var(--ui-hover)] transition-colors"
                        >
                          <div className="text-sm text-[var(--ui-text)]">{t.name}</div>
                          <div className="text-xs text-[var(--ui-text-muted)]">
                            {t.description || 'Custom transformation'}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-fade-in relative">
      {viewMode === 'list' ? renderListView() : renderEditView()}
    </div>
  );
}
