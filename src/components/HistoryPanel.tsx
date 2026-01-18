import { useState, useEffect, useRef } from 'react';
import { useHistory } from '../hooks/useHistory';
import { useEditorStore, type EditorImage } from '../stores/editorStore';
import { useHistoryStore } from '../stores/historyStore';
import { useLicenseStore } from '../stores/licenseStore';
import { ProFeatureGate } from './ProFeatureGate';
import type { HistoryEntry } from '../types';

// Helper to parse images from history entry
function parseImages(entry: HistoryEntry): EditorImage[] {
  if (!entry.images) return [];
  try {
    return JSON.parse(entry.images);
  } catch {
    return [];
  }
}

export function HistoryPanel() {
  return (
    <ProFeatureGate feature="history">
      <HistoryPanelContent />
    </ProFeatureGate>
  );
}

// Document icon for text entries
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
      <path d="M5.5 5h5M5.5 7.5h5M5.5 10h3" strokeLinecap="round" />
    </svg>
  );
}

// Code icon for code entries
function CodeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <path d="M5.5 4L2 8l3.5 4M10.5 4L14 8l-3.5 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Image icon for entries with images
function ImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <circle cx="5.5" cy="5.5" r="1" />
      <path d="M2 11l3-3 2 2 4-4 3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryPanelContent() {
  const { entries, loading, searchQuery, handleSearch, handleSelect, handleDelete } = useHistory();
  const { setActivePanel } = useEditorStore();
  const { exportHistory } = useHistoryStore();
  const { isProFeatureEnabled } = useLicenseStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const canExport = isProFeatureEnabled('export_history');
  const selectedEntry = entries[selectedIndex] || null;

  const handleExport = async () => {
    if (!canExport || exporting) return;
    setExporting(true);
    try {
      const historyData = await exportHistory();
      const json = JSON.stringify(historyData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wingman-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  // Reset selection when entries change
  useEffect(() => {
    setSelectedIndex(0);
  }, [entries]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
        }
        setSelectedIndex((prev) => Math.min(prev + 1, entries.length - 1));
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
        if (entries[selectedIndex]) {
          handleSelect(entries[selectedIndex]);
        }
        return;
      }

      if (document.activeElement !== searchInputRef.current && e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [entries, selectedIndex, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
           ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const truncate = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const isCodeEntry = (entry: HistoryEntry) => {
    return entry.language && entry.language !== 'plaintext';
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
          placeholder="Type to filter entries..."
          className="flex-1 bg-transparent text-sm text-[var(--editor-text)] placeholder-[var(--editor-muted)] outline-none"
        />
        <button
          onClick={handleExport}
          disabled={!canExport || exporting || entries.length === 0}
          className="text-xs px-2 py-1 rounded-md bg-[var(--editor-surface)] text-[var(--editor-muted)] hover:text-[var(--editor-text)] disabled:opacity-40 transition-colors flex-shrink-0"
          aria-label="Export history"
          title={canExport ? 'Export history to JSON' : 'Pro feature'}
        >
          {exporting ? '...' : 'Export'}
        </button>
      </div>

      {/* Main content area - two columns */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left column - list */}
        <div className="w-1/2 flex flex-col border-r border-[var(--editor-border)]">
          <div className="flex-1 overflow-auto" ref={listRef}>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-[var(--editor-muted)]">
                Loading...
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[var(--editor-muted)]">
                <p className="text-sm">No history yet</p>
                <p className="text-xs mt-1 opacity-60">Your drafts will appear here</p>
              </div>
            ) : (
              <div className="py-1">
                {/* Section header */}
                <div className="px-4 py-2">
                  <span className="text-xs font-medium text-[var(--editor-muted)] uppercase tracking-wide">Recent</span>
                </div>
                {/* List items */}
                {entries.map((entry, index) => (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    index={index}
                    isSelected={index === selectedIndex}
                    onSelect={handleSelect}
                    onDelete={handleDelete}
                    onHover={() => setSelectedIndex(index)}
                    truncate={truncate}
                    isCode={!!isCodeEntry(entry)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column - preview */}
        <div className="w-1/2 flex flex-col">
          {selectedEntry ? (
            <>
              {/* Preview content */}
              <div className="flex-1 overflow-auto p-4">
                <div className="bg-[var(--editor-surface)] rounded-md p-3 mb-4 max-h-40 overflow-auto">
                  <pre className="text-xs text-[var(--editor-text)] whitespace-pre-wrap font-mono">
                    {selectedEntry.content.slice(0, 500)}
                    {selectedEntry.content.length > 500 && '...'}
                  </pre>
                </div>

                {/* Image thumbnails */}
                {(() => {
                  const images = parseImages(selectedEntry);
                  if (images.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-[var(--editor-muted)] uppercase tracking-wide mb-2">
                        Images ({images.length})
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {images.map((img) => (
                          <img
                            key={img.id}
                            src={img.data}
                            alt={img.name}
                            className="h-12 w-auto rounded border border-[var(--editor-border)] object-cover"
                            title={img.name}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Metadata */}
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[var(--editor-muted)] uppercase tracking-wide mb-2">
                    Information
                  </div>
                  <MetadataRow label="Content type" value={isCodeEntry(selectedEntry) ? selectedEntry.language || 'Code' : 'Text'} />
                  <MetadataRow label="Words" value={String(selectedEntry.word_count)} />
                  <MetadataRow label="Characters" value={String(selectedEntry.character_count)} />
                  <MetadataRow label="Lines" value={String(selectedEntry.line_count)} />
                  <MetadataRow label="Created" value={formatFullDate(selectedEntry.created_at)} />
                </div>
              </div>

              {/* Action button */}
              <div className="p-3 border-t border-[var(--editor-border)]">
                <button
                  onClick={() => handleSelect(selectedEntry)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-[var(--editor-surface)] border border-[var(--editor-border)] text-sm text-[var(--editor-text)] hover:bg-[var(--editor-hover)] transition-colors"
                >
                  <span>Load to Editor</span>
                  <span className="kbd">↵</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--editor-muted)]">
              <p className="text-sm">Select an entry to preview</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-b-[10px] text-xs text-[var(--editor-muted)] flex justify-between">
        <span>{entries.length} entries</span>
        <span className="opacity-50">↑↓ navigate · ↵ select · ⌫ delete</span>
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

interface HistoryItemProps {
  entry: HistoryEntry;
  index: number;
  isSelected: boolean;
  onSelect: (entry: HistoryEntry) => void;
  onDelete: (id: number, e?: React.MouseEvent) => void;
  onHover: () => void;
  truncate: (text: string, length: number) => string;
  isCode: boolean;
}

function HistoryItem({ entry, index, isSelected, onSelect, onDelete, onHover, truncate, isCode }: HistoryItemProps) {
  const hasImages = parseImages(entry).length > 0;

  return (
    <div
      data-index={index}
      className={`group flex items-center gap-3 px-4 py-2 mx-2 rounded-md cursor-pointer transition-colors ${
        isSelected
          ? 'bg-[var(--editor-surface)]'
          : 'hover:bg-[var(--editor-hover)]'
      }`}
      onClick={() => onSelect(entry)}
      onMouseEnter={onHover}
      role="button"
      tabIndex={-1}
    >
      {/* Icon */}
      <div className={`flex-shrink-0 ${isSelected ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-muted)]'}`}>
        {hasImages ? <ImageIcon /> : isCode ? <CodeIcon /> : <DocumentIcon />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isSelected ? 'text-[var(--editor-text)]' : 'text-[var(--editor-text)]'}`}>
          {truncate(entry.content.split('\n')[0] || 'Empty', 40)}
        </p>
      </div>

      {/* Delete button - shows on hover */}
      <button
        onClick={(e) => onDelete(entry.id, e)}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-[var(--editor-muted)] hover:text-red-500 transition-all"
        title="Delete"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3.5h10M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M11 3.5v8a1 1 0 01-1 1H4a1 1 0 01-1-1v-8" />
          <path d="M5.5 6v4M8.5 6v4" />
        </svg>
      </button>
    </div>
  );
}
