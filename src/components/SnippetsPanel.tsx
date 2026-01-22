import { useState, useEffect, useRef } from 'react';
import { useSnippets } from '../hooks/useSnippets';
import { useEditorStore } from '../stores/editorStore';
import { ProFeatureGate } from './ProFeatureGate';
import type { Snippet } from '../types';

export function SnippetsPanel() {
  return (
    <ProFeatureGate feature="snippets">
      <SnippetsPanelContent />
    </ProFeatureGate>
  );
}

// Snippet icon
function SnippetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d="M4 4h8M4 7h6M4 10h8M4 13h4" strokeLinecap="round" />
    </svg>
  );
}

function SnippetsPanelContent() {
  const {
    snippets,
    loading,
    searchQuery,
    editingSnippet,
    setEditingSnippet,
    handleSearch,
    handleInsert,
    handleSaveCurrentAsSnippet,
    handleUpdate,
    handleDelete,
  } = useSnippets();
  const { setActivePanel, content } = useEditorStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Compute safe index to avoid out-of-bounds when snippets change
  const safeSelectedIndex = snippets.length > 0 ? Math.min(selectedIndex, snippets.length - 1) : 0;
  const selectedSnippet = snippets[safeSelectedIndex] || null;

  // Handle keyboard navigation
  useEffect(() => {
    if (isCreating || editingSnippet) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.min(prev + 1, snippets.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        if (snippets[selectedIndex]) {
          handleInsert(snippets[selectedIndex]);
        }
        return;
      }

      if (document.activeElement !== searchInputRef.current && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [snippets, selectedIndex, handleInsert, isCreating, editingSnippet]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const startCreating = () => {
    setNewSnippetContent(content);
    setIsCreating(true);
  };

  const handleCreate = async () => {
    if (!newSnippetName.trim() || !newSnippetContent.trim()) return;
    await handleSaveCurrentAsSnippet(newSnippetName.trim(), newSnippetContent.trim());
    setNewSnippetName('');
    setNewSnippetContent('');
    setIsCreating(false);
  };

  const cancelCreate = () => {
    setNewSnippetName('');
    setNewSnippetContent('');
    setIsCreating(false);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Search bar - full width at top */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--editor-border)]">
        <button
          onClick={() => setActivePanel('editor')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--editor-hover)] text-[var(--editor-muted)] hover:text-[var(--editor-text)] transition-colors flex-shrink-0"
          aria-label="Back to editor"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3L4.5 7L8.5 11" />
          </svg>
        </button>
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Type to filter snippets..."
          className="flex-1 bg-transparent text-sm text-[var(--editor-text)] placeholder-[var(--editor-muted)] outline-none"
        />
        <button
          onClick={startCreating}
          className="text-xs px-2 py-1 rounded-md bg-[var(--editor-accent)] text-white hover:brightness-110 transition-all flex-shrink-0"
        >
          + New
        </button>
      </div>

      {/* Create form */}
      {isCreating && (
        <div className="px-4 py-3 border-b border-[var(--editor-border)] bg-[var(--editor-surface)]">
          <input
            type="text"
            value={newSnippetName}
            onChange={(e) => setNewSnippetName(e.target.value)}
            placeholder="Snippet name..."
            className="w-full bg-[var(--editor-bg)] text-sm px-3 py-2 rounded-md border border-[var(--editor-border)] outline-none focus:border-[var(--editor-accent)] mb-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <textarea
            value={newSnippetContent}
            onChange={(e) => setNewSnippetContent(e.target.value)}
            placeholder="Snippet content..."
            className="w-full bg-[var(--editor-bg)] text-sm px-3 py-2 rounded-md border border-[var(--editor-border)] outline-none focus:border-[var(--editor-accent)] min-h-[60px] resize-y mb-2"
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="text-xs px-3 py-1.5 rounded-md bg-[var(--editor-accent)] text-white disabled:opacity-50"
              disabled={!newSnippetName.trim() || !newSnippetContent.trim()}
            >
              Save
            </button>
            <button onClick={cancelCreate} className="text-xs px-3 py-1.5 rounded-md hover:bg-[var(--editor-hover)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Main content area - two columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column - list */}
        <div className="w-1/2 flex flex-col border-r border-[var(--editor-border)]">
          <div className="flex-1 overflow-auto" ref={listRef}>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-[var(--editor-muted)]">
                Loading...
              </div>
            ) : snippets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[var(--editor-muted)]">
                <p className="text-sm">No snippets yet</p>
                <p className="text-xs mt-1 opacity-60">Create snippets to reuse text</p>
              </div>
            ) : (
              <div className="py-1">
                {/* Section header */}
                <div className="px-4 py-2">
                  <span className="text-xs font-medium text-[var(--editor-muted)] uppercase tracking-wide">Saved</span>
                </div>
                {/* List items */}
                {snippets.map((snippet, index) => (
                  <SnippetItem
                    key={snippet.id}
                    snippet={snippet}
                    index={index}
                    isSelected={index === safeSelectedIndex}
                    onInsert={handleInsert}
                    onHover={() => setSelectedIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column - preview */}
        <div className="w-1/2 flex flex-col">
          {selectedSnippet && !editingSnippet ? (
            <>
              {/* Preview content */}
              <div className="flex-1 overflow-auto p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-medium text-[var(--editor-text)]">{selectedSnippet.name}</h3>
                  {selectedSnippet.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {selectedSnippet.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-xs rounded-md bg-[var(--editor-hover)] text-[var(--editor-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[var(--editor-surface)] rounded-md p-3 mb-4 max-h-40 overflow-auto">
                  <pre className="text-xs text-[var(--editor-text)] whitespace-pre-wrap font-mono">
                    {selectedSnippet.content.slice(0, 500)}
                    {selectedSnippet.content.length > 500 && '...'}
                  </pre>
                </div>

                {/* Metadata */}
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[var(--editor-muted)] uppercase tracking-wide mb-2">
                    Information
                  </div>
                  <MetadataRow label="Lines" value={String(selectedSnippet.content.split('\n').length)} />
                  <MetadataRow label="Characters" value={String(selectedSnippet.content.length)} />
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-3 border-t border-[var(--editor-border)] space-y-2">
                <button
                  onClick={() => handleInsert(selectedSnippet)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[var(--editor-surface)] border border-[var(--editor-border)] text-sm text-[var(--editor-text)] hover:bg-[var(--editor-hover)] transition-colors"
                >
                  <span>Insert to Editor</span>
                  <span className="kbd">↵</span>
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingSnippet(selectedSnippet)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-md text-[var(--editor-muted)] hover:text-[var(--editor-text)] hover:bg-[var(--editor-hover)] transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleDelete(selectedSnippet.id, e)}
                    className="flex-1 text-xs px-3 py-1.5 rounded-md text-[var(--editor-muted)] hover:text-red-400 hover:bg-[var(--editor-hover)] transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </>
          ) : editingSnippet ? (
            <EditSnippetForm
              snippet={editingSnippet}
              onUpdate={handleUpdate}
              onCancel={() => setEditingSnippet(null)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--editor-muted)]">
              <p className="text-sm">Select a snippet to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-b-[10px] text-xs text-[var(--editor-muted)] flex justify-between">
        <span>{snippets.length} snippets</span>
        <span className="opacity-50">↑↓ navigate · ↵ insert</span>
      </div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-[var(--editor-border)] last:border-0">
      <span className="text-[var(--editor-muted)]">{label}</span>
      <span className="text-[var(--editor-text)]">{value}</span>
    </div>
  );
}

interface EditSnippetFormProps {
  snippet: Snippet;
  onUpdate: (id: string, name: string, content: string, tags: string[]) => void;
  onCancel: () => void;
}

function EditSnippetForm({ snippet, onUpdate, onCancel }: EditSnippetFormProps) {
  const [editName, setEditName] = useState(snippet.name);
  const [editContent, setEditContent] = useState(snippet.content);

  return (
    <div className="flex-1 flex flex-col p-4">
      <div className="text-xs font-medium text-[var(--editor-muted)] uppercase tracking-wide mb-3">
        Edit Snippet
      </div>
      <input
        type="text"
        value={editName}
        onChange={(e) => setEditName(e.target.value)}
        placeholder="Snippet name..."
        className="w-full bg-[var(--editor-surface)] text-sm px-3 py-2 rounded-md border border-[var(--editor-border)] outline-none focus:border-[var(--editor-accent)] mb-2"
        autoFocus
      />
      <textarea
        value={editContent}
        onChange={(e) => setEditContent(e.target.value)}
        className="flex-1 w-full bg-[var(--editor-surface)] text-sm px-3 py-2 rounded-md border border-[var(--editor-border)] outline-none focus:border-[var(--editor-accent)] resize-none font-mono"
        placeholder="Snippet content..."
      />
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onUpdate(snippet.id, editName, editContent, snippet.tags)}
          className="text-xs px-3 py-1.5 rounded-md bg-[var(--editor-accent)] text-white"
        >
          Save
        </button>
        <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded-md hover:bg-[var(--editor-hover)]">
          Cancel
        </button>
      </div>
    </div>
  );
}

interface SnippetItemProps {
  snippet: Snippet;
  index: number;
  isSelected: boolean;
  onInsert: (snippet: Snippet) => void;
  onHover: () => void;
}

function SnippetItem({ snippet, index, isSelected, onInsert, onHover }: SnippetItemProps) {
  return (
    <div
      data-index={index}
      className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--editor-surface)]'
          : 'hover:bg-[var(--editor-hover)]'
      }`}
      onClick={() => onInsert(snippet)}
      onMouseEnter={onHover}
      role="button"
      tabIndex={-1}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${isSelected ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-muted)]'}`}>
        <SnippetIcon />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{snippet.name}</p>
      </div>
    </div>
  );
}
