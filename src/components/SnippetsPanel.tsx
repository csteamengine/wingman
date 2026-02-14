import { useState, useEffect, useRef } from 'react';
import { AlignLeft, Github, RefreshCw, Link2Off, CloudUpload } from 'lucide-react';
import { useSnippets } from '../hooks/useSnippets';
import { useEditorStore } from '../stores/editorStore';
import { useGitHubStore } from '../stores/githubStore';
import { ProFeatureGate } from './ProFeatureGate';
import type { Snippet } from '../types';

export function SnippetsPanel() {
  return (
    <ProFeatureGate feature="snippets">
      <SnippetsPanelContent />
    </ProFeatureGate>
  );
}

function SnippetsPanelContent() {
  const {
    snippets,
    loading,
    searchQuery,
    loadSnippets,
    handleSearch,
    handleInsert,
    handleEditInEditor,
    handleSaveCurrentAsSnippet,
    handleRename,
    handleDelete,
    createGistFromSnippet,
    syncSnippetToGitHub,
    importWingmanGists,
    disconnectSnippetFromGitHub,
  } = useSnippets();
  const { setActivePanel, content } = useEditorStore();
  const {
    isAuthenticated: isGitHubAuthenticated,
    config,
    loadAuthStatus,
    loadConfig,
    gistLoading,
  } = useGitHubStore();

  const [isCreating, setIsCreating] = useState(false);
  const [newSnippetName, setNewSnippetName] = useState('');
  const [newSnippetContent, setNewSnippetContent] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [importingGists, setImportingGists] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [gistAction, setGistAction] = useState<{ id: string; type: 'create' | 'disconnect' } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConfig();
    loadAuthStatus();
  }, [loadConfig, loadAuthStatus]);

  const safeSelectedIndex = snippets.length > 0 ? Math.min(selectedIndex, snippets.length - 1) : 0;
  const selectedSnippet = snippets[safeSelectedIndex] || null;
  const canUseGitHubActions = (isGitHubAuthenticated || !!config?.is_authenticated) && !gistLoading;
  const creatingSelectedGist = !!(
    selectedSnippet &&
    gistAction?.id === selectedSnippet.id &&
    gistAction.type === 'create'
  );
  const disconnectingSelectedGist = !!(
    selectedSnippet &&
    gistAction?.id === selectedSnippet.id &&
    gistAction.type === 'disconnect'
  );

  useEffect(() => {
    if (isCreating) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement as HTMLElement | null;
      const isEditableElement =
        !!activeElement &&
        (activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT' ||
          activeElement.isContentEditable);
      const isSearchFocused = activeElement === searchInputRef.current;

      // Don't hijack typing/navigation while user is editing any input other than search.
      if (isEditableElement && !isSearchFocused) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (isSearchFocused) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.min(prev + 1, snippets.length - 1));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        if (isSearchFocused) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (isSearchFocused) {
          searchInputRef.current?.blur();
        }
        if (snippets[selectedIndex]) {
          handleInsert(snippets[selectedIndex]);
        }
        return;
      }

      if (!isEditableElement && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [snippets, selectedIndex, handleInsert, isCreating]);

  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    setRenameValue(selectedSnippet?.name ?? '');
  }, [selectedSnippet?.id, selectedSnippet?.name]);

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

  const handleImportGists = async () => {
    setImportingGists(true);
    try {
      await importWingmanGists();
      await loadSnippets();
    } finally {
      setImportingGists(false);
    }
  };

  const handleCreateSnippetGist = async (snippet: Snippet) => {
    if (gistAction) return;
    setGistAction({ id: snippet.id, type: 'create' });
    try {
      const created = await createGistFromSnippet(snippet.id);
      if (created) {
        await loadSnippets();
      }
    } finally {
      setGistAction(null);
    }
  };

  const handleRemoveSnippetGist = async (snippet: Snippet) => {
    if (gistAction) return;
    setGistAction({ id: snippet.id, type: 'disconnect' });
    try {
      const removed = await disconnectSnippetFromGitHub(snippet.id);
      if (removed) {
        await loadSnippets();
      }
    } finally {
      setGistAction(null);
    }
  };

  const handleRenameSelectedSnippet = async () => {
    if (!selectedSnippet || !renameValue.trim() || renaming) return;
    setRenaming(true);
    try {
      const renamed = await handleRename(selectedSnippet.id, renameValue.trim());
      if (renamed) {
        await loadSnippets();
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteSnippet = async (snippet: Snippet, e: React.MouseEvent) => {
    const warning = snippet.github_gist_id
      ? `Delete snippet "${snippet.name}"?\n\nThis snippet is linked to GitHub and this will also permanently delete the linked GitHub Gist.`
      : `Delete snippet "${snippet.name}"?`;
    const confirmed = window.confirm(warning);
    if (!confirmed) return;
    await handleDelete(snippet.id, e);
  };

  return (
    <div className="flex flex-col h-full animate-fade-in">
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
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Type to filter snippets..."
          className="flex-1 bg-transparent text-sm text-[var(--ui-text)] placeholder-[var(--ui-text-muted)] outline-none"
        />
        <button
          onClick={handleImportGists}
          disabled={!canUseGitHubActions || importingGists}
          className="text-xs px-2 py-1 rounded-md bg-[var(--ui-surface)] border border-[var(--ui-border)] text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-all disabled:opacity-50 flex items-center gap-1"
          title="Import Wingman gists from GitHub"
        >
          {importingGists ? <RefreshCw size={12} className="animate-spin" /> : <Github size={12} />}
          <span>Import Gists</span>
        </button>
        <button
          onClick={startCreating}
          className="text-xs px-2 py-1 rounded-md bg-[var(--ui-accent)] text-white hover:brightness-110 transition-all flex-shrink-0"
        >
          + New
        </button>
      </div>

      {isCreating && (
        <div className="px-4 py-3 border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
          <input
            type="text"
            value={newSnippetName}
            onChange={(e) => setNewSnippetName(e.target.value)}
            placeholder="Snippet name..."
            className="w-full bg-[var(--ui-surface)] text-sm px-3 py-2 rounded-md border border-[var(--ui-border)] outline-none focus:border-[var(--ui-accent)] mb-2"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <textarea
            value={newSnippetContent}
            onChange={(e) => setNewSnippetContent(e.target.value)}
            placeholder="Snippet content..."
            className="w-full bg-[var(--ui-surface)] text-sm px-3 py-2 rounded-md border border-[var(--ui-border)] outline-none focus:border-[var(--ui-accent)] min-h-[60px] resize-y mb-2"
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelCreate();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              className="text-xs px-3 py-1.5 rounded-md bg-[var(--ui-accent)] text-white disabled:opacity-50"
              disabled={!newSnippetName.trim() || !newSnippetContent.trim()}
            >
              Save
            </button>
            <button onClick={cancelCreate} className="text-xs px-3 py-1.5 rounded-md hover:bg-[var(--ui-hover)]">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 flex flex-col border-r border-[var(--ui-border)]">
          <div className="flex-1 overflow-auto" ref={listRef}>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-[var(--ui-text-muted)]">Loading...</div>
            ) : snippets.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[var(--ui-text-muted)]">
                <p className="text-sm">No snippets yet</p>
                <p className="text-xs mt-1 opacity-60">Create snippets to reuse text</p>
              </div>
            ) : (
              <div className="py-1">
                <div className="px-4 py-2">
                  <span className="text-xs font-medium text-[var(--ui-text-muted)] uppercase tracking-wide">Saved</span>
                </div>
                {snippets.map((snippet, index) => (
                  <SnippetItem
                    key={snippet.id}
                    snippet={snippet}
                    index={index}
                    isSelected={index === safeSelectedIndex}
                    onPreview={() => setSelectedIndex(index)}
                    onInsert={handleInsert}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col">
          {selectedSnippet ? (
            <>
              <div className="flex-1 overflow-auto p-4">
                <div className="mb-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="flex-1 bg-[var(--ui-surface)] text-sm px-2 py-1.5 rounded-md border border-[var(--ui-border)] outline-none focus:border-[var(--ui-accent)]"
                      placeholder="Snippet name"
                    />
                    <button
                      onClick={handleRenameSelectedSnippet}
                      disabled={renaming || !renameValue.trim() || renameValue.trim() === selectedSnippet.name}
                      className="text-xs px-2.5 py-1.5 rounded-md bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-hover)] disabled:opacity-50"
                    >
                      {renaming ? 'Saving...' : 'Rename'}
                    </button>
                  </div>
                  {selectedSnippet.tags.length > 0 && (
                    <div className="flex gap-1 mt-2">
                      {selectedSnippet.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-xs rounded-md bg-[var(--ui-hover)] text-[var(--ui-text-muted)]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-[var(--ui-surface)] rounded-md p-3 mb-4 max-h-40 overflow-auto">
                  <pre className="text-xs text-[var(--ui-text)] whitespace-pre-wrap font-mono">
                    {selectedSnippet.content.slice(0, 500)}
                    {selectedSnippet.content.length > 500 && '...'}
                  </pre>
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[var(--ui-text-muted)] uppercase tracking-wide mb-2">
                    Information
                  </div>
                  <MetadataRow label="Lines" value={String(selectedSnippet.content.split('\n').length)} />
                  <MetadataRow label="Characters" value={String(selectedSnippet.content.length)} />
                  <MetadataRow
                    label="GitHub"
                    value={selectedSnippet.github_gist_id ? `Linked (${selectedSnippet.github_gist_id.slice(0, 8)}...)` : 'Not linked'}
                  />
                </div>
              </div>

              <div className="p-3 border-t border-[var(--ui-border)] space-y-2">
                <button
                  onClick={() => handleInsert(selectedSnippet)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[var(--ui-surface)] border border-[var(--ui-border)] text-sm text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
                >
                  <span>Insert to Editor</span>
                  <span className="kbd">↵</span>
                </button>
                <button
                  onClick={() => handleEditInEditor(selectedSnippet)}
                  className="w-full text-xs px-3 py-1.5 rounded-md text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
                >
                  Edit in Editor
                </button>

                <div className="grid grid-cols-2 gap-2">
                  {selectedSnippet.github_gist_id ? (
                    <>
                      <button
                        onClick={() => syncSnippetToGitHub(selectedSnippet.id)}
                        disabled={!canUseGitHubActions}
                        className="text-xs px-3 py-1.5 rounded-md bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-hover)] disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <CloudUpload size={12} />
                        <span>Sync</span>
                      </button>
                      <button
                        onClick={() => handleRemoveSnippetGist(selectedSnippet)}
                        disabled={!canUseGitHubActions || !!gistAction}
                        className="text-xs px-3 py-1.5 rounded-md bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-hover)] disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {disconnectingSelectedGist ? <RefreshCw size={12} className="animate-spin" /> : <Link2Off size={12} />}
                        <span>{disconnectingSelectedGist ? 'Removing...' : 'Remove from GitHub'}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleCreateSnippetGist(selectedSnippet)}
                      disabled={!canUseGitHubActions || !!gistAction}
                      className="col-span-2 text-xs px-3 py-1.5 rounded-md bg-[var(--ui-surface)] border border-[var(--ui-border)] hover:bg-[var(--ui-hover)] disabled:opacity-50 flex items-center justify-center gap-1"
                    >
                      {creatingSelectedGist ? <RefreshCw size={12} className="animate-spin" /> : <Github size={12} />}
                      <span>{creatingSelectedGist ? 'Creating...' : 'Create GitHub Gist'}</span>
                    </button>
                  )}
                </div>

                <button
                  onClick={(e) => handleDeleteSnippet(selectedSnippet, e)}
                  className="w-full text-xs px-3 py-1.5 rounded-md text-[var(--ui-text-muted)] hover:text-red-400 hover:bg-[var(--ui-hover)] transition-colors"
                >
                  Delete Snippet {selectedSnippet.github_gist_id ? '(also deletes GitHub gist)' : ''}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--ui-text-muted)]">
              <p className="text-sm">Select a snippet to preview</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-[var(--ui-border)] rounded-b-[10px] text-xs text-[var(--ui-text-muted)] flex justify-between">
        <span>{snippets.length} snippets</span>
        <span className="opacity-50">↑↓ navigate · ↵ insert</span>
      </div>
    </div>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-xs border-b border-[var(--ui-border)] last:border-0">
      <span className="text-[var(--ui-text-muted)]">{label}</span>
      <span className="text-[var(--ui-text)]">{value}</span>
    </div>
  );
}

interface SnippetItemProps {
  snippet: Snippet;
  index: number;
  isSelected: boolean;
  onPreview: () => void;
  onInsert: (snippet: Snippet) => void;
}

function SnippetItem({ snippet, index, isSelected, onPreview, onInsert }: SnippetItemProps) {
  return (
    <div
      data-index={index}
      className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-md cursor-pointer transition-all ${
        isSelected
          ? 'bg-[var(--ui-surface)] outline outline-2 outline-[var(--ui-accent)]'
          : 'hover:bg-[var(--ui-hover)]'
      }`}
      onClick={onPreview}
      onDoubleClick={() => onInsert(snippet)}
      role="button"
      tabIndex={-1}
    >
      <div className={`flex-shrink-0 ${isSelected ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)]'}`}>
        <AlignLeft size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate">{snippet.name}</p>
      </div>
      {snippet.github_gist_id && (
        <Github size={12} className="text-[var(--ui-text-muted)] flex-shrink-0" />
      )}
    </div>
  );
}
