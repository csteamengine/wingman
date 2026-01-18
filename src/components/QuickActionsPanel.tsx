import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useEditorStore } from '../stores/editorStore';
import { useLicenseStore } from '../stores/licenseStore';

interface ActionSection {
  title: string;
  actions: Action[];
  proFeature?: 'json_xml_formatting' | 'encode_decode';
}

interface Action {
  id: string;
  label: string;
  description: string;
  requiresInput?: boolean;
  handler?: 'transform' | 'format' | 'encode' | 'generate';
  section?: string;
  proFeature?: 'json_xml_formatting' | 'encode_decode';
}

const actionSections: ActionSection[] = [
  {
    title: 'Text Transforms',
    actions: [
      { id: 'uppercase', label: 'UPPERCASE', description: 'Convert to uppercase', handler: 'transform' },
      { id: 'lowercase', label: 'lowercase', description: 'Convert to lowercase', handler: 'transform' },
      { id: 'titlecase', label: 'Title Case', description: 'Capitalize each word', handler: 'transform' },
      { id: 'sentencecase', label: 'Sentence case', description: 'Capitalize first letter of sentences', handler: 'transform' },
      { id: 'trim', label: 'Trim Whitespace', description: 'Remove leading/trailing spaces', handler: 'transform' },
      { id: 'sort', label: 'Sort Lines', description: 'Sort lines alphabetically', handler: 'transform' },
      { id: 'deduplicate', label: 'Remove Duplicates', description: 'Remove duplicate lines', handler: 'transform' },
      { id: 'reverse', label: 'Reverse Lines', description: 'Reverse line order', handler: 'transform' },
      { id: 'bulletlist', label: 'Bulleted List', description: 'Add bullet points to each line', handler: 'transform', requiresInput: true },
    ],
  },
  {
    title: 'JSON/XML',
    proFeature: 'json_xml_formatting',
    actions: [
      { id: 'format_json', label: 'Format JSON', description: 'Pretty-print JSON with indentation', handler: 'format', requiresInput: true },
      { id: 'minify_json', label: 'Minify JSON', description: 'Compact JSON to single line', handler: 'format', requiresInput: true },
      { id: 'format_xml', label: 'Format XML', description: 'Pretty-print XML with indentation', handler: 'format', requiresInput: true },
    ],
  },
  {
    title: 'Encode/Decode',
    proFeature: 'encode_decode',
    actions: [
      { id: 'encode_base64', label: 'Base64 Encode', description: 'Encode text to Base64', handler: 'encode', requiresInput: true },
      { id: 'decode_base64', label: 'Base64 Decode', description: 'Decode Base64 to text', handler: 'encode', requiresInput: true },
      { id: 'encode_url', label: 'URL Encode', description: 'Percent-encode for URLs', handler: 'encode', requiresInput: true },
      { id: 'decode_url', label: 'URL Decode', description: 'Decode percent-encoded text', handler: 'encode', requiresInput: true },
      { id: 'encode_html', label: 'HTML Encode', description: 'Escape HTML entities', handler: 'encode', requiresInput: true },
      { id: 'decode_html', label: 'HTML Decode', description: 'Unescape HTML entities', handler: 'encode', requiresInput: true },
    ],
  },
  {
    title: 'Generators',
    actions: [
      { id: 'generate_uuid', label: 'Generate UUID', description: 'Generate a random UUID v4', handler: 'generate' },
      { id: 'lorem_1', label: 'Lorem Ipsum (1 para)', description: 'Generate 1 paragraph', handler: 'generate' },
      { id: 'lorem_3', label: 'Lorem Ipsum (3 para)', description: 'Generate 3 paragraphs', handler: 'generate' },
      { id: 'lorem_5', label: 'Lorem Ipsum (5 para)', description: 'Generate 5 paragraphs', handler: 'generate' },
    ],
  },
];

// Flatten all actions with section info for search
const allActions: Action[] = actionSections.flatMap(section =>
  section.actions.map(action => ({
    ...action,
    section: section.title,
    proFeature: section.proFeature,
  }))
);

export function QuickActionsPanel() {
  const { setActivePanel, transformText, content, setContent } = useEditorStore();
  const { isProFeatureEnabled } = useLicenseStore();
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(actionSections.map(s => s.title))
  );

  // Focus search input when panel opens
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase();
    return allActions.filter(
      action =>
        action.label.toLowerCase().includes(query) ||
        action.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Get visible actions for keyboard navigation
  const visibleActions = useMemo(() => {
    if (filteredActions !== null) {
      return filteredActions;
    }
    // When not searching, return all actions from expanded sections
    return actionSections.flatMap(section => {
      if (!expandedSections.has(section.title)) return [];
      return section.actions.map(action => ({
        ...action,
        section: section.title,
        proFeature: section.proFeature,
      }));
    });
  }, [filteredActions, expandedSections]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) {
        next.delete(title);
      } else {
        next.add(title);
      }
      return next;
    });
  };

  const handleAction = useCallback(async (action: Action) => {
    setError(null);

    // Check if action is available
    const isPro = action.proFeature ? isProFeatureEnabled(action.proFeature) : true;
    const needsInput = action.requiresInput && !content.trim();
    if (!isPro || needsInput) return;

    try {
      switch (action.handler) {
        case 'transform':
          await transformText(action.id);
          break;

        case 'format':
          if (!content.trim()) {
            setError('No text to format');
            return;
          }
          const formatted = await invoke<string>(action.id, { text: content });
          setContent(formatted);
          break;

        case 'encode':
          if (!content.trim()) {
            setError('No text to encode/decode');
            return;
          }
          const encoded = await invoke<string>(action.id, { text: content });
          setContent(encoded);
          break;

        case 'generate':
          if (action.id === 'generate_uuid') {
            const uuid = await invoke<string>('generate_uuid');
            setContent(content ? content + '\n' + uuid : uuid);
          } else if (action.id.startsWith('lorem_')) {
            const paragraphs = parseInt(action.id.split('_')[1], 10);
            const lorem = await invoke<string>('generate_lorem_ipsum', {
              paragraphs,
              format: 'plain',
            });
            setContent(content ? content + '\n\n' + lorem : lorem);
          }
          break;
      }
    } catch (err) {
      setError(String(err));
    }
  }, [content, isProFeatureEnabled, setContent, transformText]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < visibleActions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        const selectedAction = visibleActions[selectedIndex];
        if (selectedAction) {
          handleAction(selectedAction);
        }
        break;
    }
  }, [visibleActions, selectedIndex, handleAction]);

  const hasContent = content.trim().length > 0;

  const renderAction = (action: Action, index: number, showSection = false) => {
    const isPro = action.proFeature ? isProFeatureEnabled(action.proFeature) : true;
    const needsInput = action.requiresInput && !hasContent;
    const isDisabled = needsInput || !isPro;
    const isSelected = index === selectedIndex;

    return (
      <button
        key={action.id}
        data-index={index}
        onClick={() => !isDisabled && handleAction(action)}
        onMouseEnter={() => setSelectedIndex(index)}
        disabled={isDisabled}
        className={`list-item text-left ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''} ${isSelected ? 'bg-[var(--editor-hover)] ring-1 ring-[var(--editor-accent)]/50' : ''}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{action.label}</span>
          {!isPro && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">
              PRO
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--editor-muted)]">
          {showSection && <span className="opacity-60">{action.section} · </span>}
          {action.description}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full animate-fade-in" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
        <h2 className="text-sm font-medium text-[var(--editor-text)]">Quick Actions</h2>
        <button
          onClick={() => setActivePanel('editor')}
          className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--editor-hover)] text-[var(--editor-muted)] hover:text-[var(--editor-text)] transition-colors"
          aria-label="Close quick actions"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2l8 8M10 2l-8 8" />
          </svg>
        </button>
      </div>

      {/* Search input */}
      <div className="px-2 py-2 border-b border-[var(--editor-border)]">
        <div className="relative">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--editor-muted)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search actions..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-md text-[var(--editor-text)] placeholder:text-[var(--editor-muted)] focus:outline-none focus:border-[var(--editor-accent)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[var(--editor-muted)] hover:text-[var(--editor-text)]"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 1l8 8M9 1l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-2 mt-2 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-2" ref={listRef}>
        {/* Search results */}
        {filteredActions !== null ? (
          filteredActions.length > 0 ? (
            <div className="grid gap-1">
              {filteredActions.map((action, index) => renderAction(action, index, true))}
            </div>
          ) : (
            <div className="px-3 py-8 text-center text-xs text-[var(--editor-muted)]">
              No actions found for "{searchQuery}"
            </div>
          )
        ) : (
          /* Section view */
          (() => {
            let globalIndex = 0;
            return actionSections.map((section) => {
              const isPro = section.proFeature ? isProFeatureEnabled(section.proFeature) : true;
              const sectionStartIndex = globalIndex;

              return (
                <div key={section.title} className="mb-2">
                  <button
                    onClick={() => toggleSection(section.title)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-[var(--editor-muted)] hover:text-[var(--editor-text)] transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {section.title}
                      {section.proFeature && !isPro && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">
                          PRO
                        </span>
                      )}
                    </span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      className={`transition-transform ${expandedSections.has(section.title) ? 'rotate-180' : ''}`}
                    >
                      <path d="M2 3.5l3 3 3-3" />
                    </svg>
                  </button>

                  {expandedSections.has(section.title) && (
                    <div className="grid gap-1">
                      {section.proFeature && !isPro ? (
                        <div className="px-3 py-4 text-center text-xs text-[var(--editor-muted)]">
                          <p className="mb-2">Upgrade to Pro to unlock {section.title}</p>
                          <button
                            onClick={() => setActivePanel('settings')}
                            className="text-[var(--editor-accent)] hover:underline"
                          >
                            View Pro features
                          </button>
                        </div>
                      ) : (
                        section.actions.map((action, idx) => {
                          const actionIndex = sectionStartIndex + idx;
                          globalIndex++;
                          return renderAction(
                            { ...action, section: section.title, proFeature: section.proFeature },
                            actionIndex
                          );
                        })
                      )}
                    </div>
                  )}
                  {!expandedSections.has(section.title) && (
                    // Skip indices for collapsed sections
                    <>{(() => { globalIndex += section.actions.length; return null; })()}</>
                  )}
                </div>
              );
            });
          })()
        )}
      </div>

      <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-br-[10px] text-xs text-[var(--editor-muted)]">
        <div className="flex items-center gap-2">
          <span className="kbd">↑↓</span>
          <span className="opacity-60">Navigate</span>
          <span className="opacity-30">·</span>
          <span className="kbd">↵</span>
          <span className="opacity-60">Select</span>
        </div>
      </div>
    </div>
  );
}
