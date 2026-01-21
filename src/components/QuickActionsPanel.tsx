import {useState, useMemo, useRef, useEffect, useCallback} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {useEditorStore} from '../stores/editorStore';
import {useLicenseStore} from '../stores/licenseStore';
import {useClipboardStore} from '../stores/clipboardStore';
import {useDragStore} from '../stores/dragStore';

type TabType = 'clipboard' | 'actions';

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
        title: 'JSON/XML',
        proFeature: 'json_xml_formatting',
        actions: [
            {
                id: 'format_json',
                label: 'Format JSON',
                description: 'Pretty-print JSON with indentation',
                handler: 'format',
                requiresInput: true
            },
            {
                id: 'minify_json',
                label: 'Minify JSON',
                description: 'Compact JSON to single line',
                handler: 'format',
                requiresInput: true
            },
            {
                id: 'format_xml',
                label: 'Format XML',
                description: 'Pretty-print XML with indentation',
                handler: 'format',
                requiresInput: true
            },
        ],
    },
    {
        title: 'Encode/Decode',
        proFeature: 'encode_decode',
        actions: [
            {
                id: 'encode_base64',
                label: 'Base64 Encode',
                description: 'Encode text to Base64',
                handler: 'encode',
                requiresInput: true
            },
            {
                id: 'decode_base64',
                label: 'Base64 Decode',
                description: 'Decode Base64 to text',
                handler: 'encode',
                requiresInput: true
            },
            {
                id: 'encode_url',
                label: 'URL Encode',
                description: 'Percent-encode for URLs',
                handler: 'encode',
                requiresInput: true
            },
            {
                id: 'decode_url',
                label: 'URL Decode',
                description: 'Decode percent-encoded text',
                handler: 'encode',
                requiresInput: true
            },
            {
                id: 'encode_html',
                label: 'HTML Encode',
                description: 'Escape HTML entities',
                handler: 'encode',
                requiresInput: true
            },
            {
                id: 'decode_html',
                label: 'HTML Decode',
                description: 'Unescape HTML entities',
                handler: 'encode',
                requiresInput: true
            },
        ],
    },
    {
        title: 'Generators',
        actions: [
            {
                id: 'generate_uuid',
                label: 'Generate UUID',
                description: 'Generate a random UUID v4',
                handler: 'generate'
            },
            {id: 'lorem_1', label: 'Lorem Ipsum (1 para)', description: 'Generate 1 paragraph', handler: 'generate'},
            {id: 'lorem_3', label: 'Lorem Ipsum (3 para)', description: 'Generate 3 paragraphs', handler: 'generate'},
            {id: 'lorem_5', label: 'Lorem Ipsum (5 para)', description: 'Generate 5 paragraphs', handler: 'generate'},
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
    const {
        setActivePanel,
        transformText,
        content,
        setContent,
        applyBulletList,
        applyNumberedList,
        editorView
    } = useEditorStore();
    const {isProFeatureEnabled} = useLicenseStore();
    const {
        items: clipboardItems,
        startMonitoring,
        stopMonitoring,
        removeItem: removeClipboardItem,
        clearAll: clearClipboard
    } = useClipboardStore();

    const [activeTab, setActiveTab] = useState<TabType>('clipboard');
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const [expandedSections, setExpandedSections] = useState<Set<string>>(
        new Set(actionSections.map(s => s.title))
    );
    const [draggedItem, setDraggedItem] = useState<string | null>(null);

    // Start clipboard monitoring when panel opens
    useEffect(() => {
        startMonitoring();
        return () => {
            stopMonitoring();
        };
    }, [startMonitoring, stopMonitoring]);

    // Focus search input when panel opens or tab changes
    useEffect(() => {
        searchInputRef.current?.focus();
    }, [activeTab]);

    // Reset search and selection when switching tabs
    useEffect(() => {
        setSearchQuery('');
        setSelectedIndex(0);
    }, [activeTab]);

    // Filter clipboard items by search
    const filteredClipboardItems = useMemo(() => {
        if (!searchQuery.trim()) return clipboardItems;
        const query = searchQuery.toLowerCase();
        return clipboardItems.filter(
            item => item.content.toLowerCase().includes(query) || item.preview.toLowerCase().includes(query)
        );
    }, [clipboardItems, searchQuery]);

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
        selectedElement?.scrollIntoView({block: 'nearest'});
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

    // Helper to get selected text or full content, plus cursor position
    const getTextToProcess = useCallback((): {
        text: string;
        hasSelection: boolean;
        from: number;
        to: number;
        cursorPos: number
    } => {
        if (editorView) {
            const selection = editorView.state.selection.main;
            const cursorPos = selection.head;
            if (!selection.empty) {
                return {
                    text: editorView.state.sliceDoc(selection.from, selection.to),
                    hasSelection: true,
                    from: selection.from,
                    to: selection.to,
                    cursorPos,
                };
            }
            return {
                text: editorView.state.doc.toString(),
                hasSelection: false,
                from: 0,
                to: editorView.state.doc.length,
                cursorPos
            };
        }
        return {text: content, hasSelection: false, from: 0, to: content.length, cursorPos: content.length};
    }, [editorView, content]);

    // Helper to apply processed text while preserving cursor position
    const applyProcessedText = useCallback((result: string, hasSelection: boolean, from: number, to: number, cursorPos: number) => {
        if (editorView) {
            // Calculate new cursor position
            let newCursorPos: number;
            if (hasSelection) {
                // Cursor was in or around selection, adjust for length change
                const lengthDiff = result.length - (to - from);
                newCursorPos = cursorPos <= from ? cursorPos : cursorPos + lengthDiff;
            } else {
                // Full content transform, keep cursor at same position clamped to new length
                newCursorPos = Math.min(cursorPos, result.length);
            }

            editorView.dispatch({
                changes: {from, to, insert: result},
                selection: {anchor: newCursorPos},
            });
        } else {
            setContent(result);
        }
    }, [editorView, setContent]);

    // Insert clipboard item at cursor position
    const insertClipboardItem = useCallback((itemContent: string) => {
        if (editorView) {
            const selection = editorView.state.selection.main;
            const cursorPos = selection.head;

            editorView.dispatch({
                changes: {from: cursorPos, to: cursorPos, insert: itemContent},
                selection: {anchor: cursorPos + itemContent.length},
            });
            editorView.focus();
        } else {
            setContent(content + itemContent);
        }
    }, [editorView, content, setContent]);

    // Get drag store functions
    const {startDrag, updateCursorPosition, endDrag, isDraggingClipboardItem} = useDragStore();

    // Check if clipboard history is enabled (PRO feature)
    const hasClipboardHistory = isProFeatureEnabled('history');

    // Track the content being dragged for mouseup handling
    const dragContentRef = useRef<string | null>(null);

    // Handle mouse-based drag start (instead of HTML5 drag which doesn't work in Tauri)
    const handleMouseDragStart = useCallback((e: React.MouseEvent, itemContent: string, itemId: string) => {
        // Only start drag on left click
        if (e.button !== 0) return;

        e.preventDefault();
        setDraggedItem(itemId);
        dragContentRef.current = itemContent;
        startDrag(itemContent);
        updateCursorPosition(e.clientX, e.clientY, null);
    }, [startDrag, updateCursorPosition]);

    // Global mouse event handlers for drag
    useEffect(() => {
        if (!isDraggingClipboardItem) return;

        // Prevent text selection during drag - add a style tag for maximum coverage
        const styleEl = document.createElement('style');
        styleEl.id = 'drag-no-select';
        styleEl.textContent = `
            * { user-select: none !important; -webkit-user-select: none !important; cursor: grabbing !important; }
            .cm-editor { pointer-events: none !important; }
            .cm-content { pointer-events: none !important; }
            .cm-line { pointer-events: none !important; }
            .cm-selectionBackground { display: none !important; }
        `;
        document.head.appendChild(styleEl);

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            updateCursorPosition(e.clientX, e.clientY, null);
        };

        const handleMouseUp = () => {
            setDraggedItem(null);
            dragContentRef.current = null;
            // Reset selection to clear highlighting
            setSelectedIndex(-1);
            // endDrag is called by EditorWindow after it inserts the text
            // or we call it here if the drop wasn't on the editor
            setTimeout(() => {
                // If still dragging after a tick, the drop wasn't handled
                if (useDragStore.getState().isDraggingClipboardItem) {
                    endDrag();
                }
            }, 100);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                // Cancel the drag
                setDraggedItem(null);
                dragContentRef.current = null;
                setSelectedIndex(-1);
                endDrag();
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('keydown', handleKeyDown);
            // Remove the style tag
            const el = document.getElementById('drag-no-select');
            if (el) el.remove();
        };
    }, [isDraggingClipboardItem, updateCursorPosition, endDrag]);

    const handleAction = useCallback(async (action: Action) => {
        setError(null);

        // Check if action is available
        const isPro = action.proFeature ? isProFeatureEnabled(action.proFeature) : true;
        const needsInput = action.requiresInput && !content.trim();
        if (!isPro || needsInput) return;

        try {
            switch (action.handler) {
                case 'transform':
                    // Special handling for lists - uses editor selection
                    if (action.id === 'bulletlist') {
                        applyBulletList();
                    } else if (action.id === 'numberedlist') {
                        applyNumberedList();
                    } else {
                        await transformText(action.id);
                    }
                    break;

                case 'format': {
                    const {text, hasSelection, from, to, cursorPos} = getTextToProcess();
                    if (!text.trim()) {
                        setError('No text to format');
                        return;
                    }
                    const formatted = await invoke<string>(action.id, {text});
                    applyProcessedText(formatted, hasSelection, from, to, cursorPos);
                    break;
                }

                case 'encode': {
                    const {text, hasSelection, from, to, cursorPos} = getTextToProcess();
                    if (!text.trim()) {
                        setError('No text to encode/decode');
                        return;
                    }
                    const encoded = await invoke<string>(action.id, {text});
                    applyProcessedText(encoded, hasSelection, from, to, cursorPos);
                    break;
                }

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
    }, [content, isProFeatureEnabled, setContent, transformText, applyBulletList, applyNumberedList, getTextToProcess, applyProcessedText]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (activeTab === 'clipboard') {
            // Clipboard tab navigation
            switch (e.key) {
                case 'Escape':
                    if (document.activeElement === searchInputRef.current && searchQuery) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSearchQuery('');
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev =>
                        prev < filteredClipboardItems.length - 1 ? prev + 1 : prev
                    );
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
                    break;
                case 'Enter':
                    e.preventDefault();
                    const selectedItem = filteredClipboardItems[selectedIndex];
                    if (selectedItem) {
                        insertClipboardItem(selectedItem.content);
                    }
                    break;
            }
        } else {
            // Actions tab navigation
            switch (e.key) {
                case 'Escape':
                    if (document.activeElement === searchInputRef.current && searchQuery) {
                        e.preventDefault();
                        e.stopPropagation();
                        setSearchQuery('');
                    }
                    break;
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
        }
    }, [activeTab, visibleActions, filteredClipboardItems, selectedIndex, handleAction, insertClipboardItem, searchQuery]);

    const hasContent = content.trim().length > 0;

    const renderAction = (action: Action, index: number, showSection = false) => {
        const isPro = action.proFeature ? isProFeatureEnabled(action.proFeature) : true;
        const needsInput = action.requiresInput && !hasContent;
        const isDisabled = needsInput || !isPro;
        const isSelected = index === selectedIndex;
        const tooltip = showSection ? `${action.section}: ${action.description}` : action.description;

        return (
            <button
                key={action.id}
                data-index={index}
                onClick={() => !isDisabled && handleAction(action)}
                onMouseEnter={() => setSelectedIndex(index)}
                disabled={isDisabled}
                title={tooltip}
                className={`flex items-center justify-between px-2 py-1.5 rounded-md text-left text-sm ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--editor-hover)]'} ${isSelected ? 'bg-[var(--editor-hover)] ring-1 ring-[var(--editor-accent)]/50' : ''}`}
            >
        <span className="text-[var(--editor-text)]">
          {action.label}
        </span>
                {!isPro && (
                    <span
                        className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">
            PRO
          </span>
                )}
            </button>
        );
    };

    // Format timestamp for display
    const formatTime = (timestamp: number): string => {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    };

    // Track if we're in the middle of a drag to prevent click
    const isDragRef = useRef(false);

    const renderClipboardItem = (item: typeof clipboardItems[0], index: number) => {
        const isSelected = index === selectedIndex;
        const isDragging = draggedItem === item.id;

        return (
            <div
                key={item.id}
                data-index={index}
                onMouseDown={(e) => {
                    isDragRef.current = false;
                    // Start drag after a small movement threshold
                    const startX = e.clientX;
                    const startY = e.clientY;

                    const handleMouseMove = (moveEvent: MouseEvent) => {
                        const dx = Math.abs(moveEvent.clientX - startX);
                        const dy = Math.abs(moveEvent.clientY - startY);
                        // If moved more than 5 pixels, start the drag
                        if (dx > 5 || dy > 5) {
                            isDragRef.current = true;
                            document.removeEventListener('mousemove', handleMouseMove);
                            handleMouseDragStart(e, item.content, item.id);
                        }
                    };

                    const handleMouseUp = () => {
                        document.removeEventListener('mousemove', handleMouseMove);
                        document.removeEventListener('mouseup', handleMouseUp);
                        // Clear dragged state in case global handler didn't fire
                        setDraggedItem(null);
                    };

                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                }}
                onClick={() => {
                    // Only insert on click if we didn't drag
                    if (!isDragRef.current && !isDraggingClipboardItem) {
                        insertClipboardItem(item.content);
                    }
                }}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`group relative px-3 py-2.5 rounded-md cursor-grab active:cursor-grabbing transition-all select-none ${
                    isSelected ? 'bg-[var(--editor-hover)] ring-1 ring-[var(--editor-accent)]/50' : 'hover:bg-[var(--editor-hover)]'
                } ${isDragging ? 'opacity-50' : ''}`}
            >
                {/* Full width content - two lines with ellipsis */}
                <p
                    className="text-sm text-[var(--editor-text)] leading-tight overflow-hidden"
                    style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        wordBreak: 'break-word',
                    }}
                >
                    {item.content}
                </p>

                {/* Footer with metadata and actions */}
                <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-[var(--editor-muted)]">
                        {formatTime(item.timestamp)} · {item.content.length} chars
                    </p>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Drag hint */}
                        <div className="text-[var(--editor-muted)] mr-1" title="Drag to insert">
                            <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                                <circle cx="3" cy="3" r="1.5"/>
                                <circle cx="9" cy="3" r="1.5"/>
                                <circle cx="3" cy="9" r="1.5"/>
                                <circle cx="9" cy="9" r="1.5"/>
                            </svg>
                        </div>

                        {/* Delete button */}
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                removeClipboardItem(item.id);
                            }}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-500/20 text-[var(--editor-muted)] hover:text-red-400 transition-all"
                            title="Remove from history"
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                                 strokeWidth="1.5" strokeLinecap="round">
                                <path d="M1 1l8 8M9 1l-8 8"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full animate-fade-in" onKeyDown={handleKeyDown}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
                <h2 className="text-sm font-medium text-[var(--editor-text)]">
                    {activeTab === 'clipboard' ? 'Clipboard' : 'Quick Actions'}
                </h2>
                <button
                    onClick={() => setActivePanel('editor')}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--editor-hover)] text-[var(--editor-muted)] hover:text-[var(--editor-text)] transition-colors"
                    aria-label="Close panel"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                         strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8"/>
                    </svg>
                </button>
            </div>

            {/* Tab buttons */}
            <div className="flex border-b border-[var(--editor-border)]">
                <button
                    onClick={() => setActiveTab('clipboard')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                        activeTab === 'clipboard'
                            ? 'text-[var(--editor-accent)] border-b-2 border-[var(--editor-accent)]'
                            : 'text-[var(--editor-muted)] hover:text-[var(--editor-text)]'
                    }`}
                >
                    <div className="flex items-center justify-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                        </svg>
                        Clipboard
                        {!hasClipboardHistory ? (
                            <span
                                className="text-[10px] px-1 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">
                PRO
              </span>
                        ) : clipboardItems.length > 0 ? (
                            <span
                                className="text-[10px] px-1 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">
                {clipboardItems.length}
              </span>
                        ) : null}
                    </div>
                </button>
                <button
                    onClick={() => setActiveTab('actions')}
                    className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                        activeTab === 'actions'
                            ? 'text-[var(--editor-accent)] border-b-2 border-[var(--editor-accent)]'
                            : 'text-[var(--editor-muted)] hover:text-[var(--editor-text)]'
                    }`}
                >
                    <div className="flex items-center justify-center gap-1.5">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor"
                             strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 1L3 9h5l-1 6 6-8H8l1-6z"/>
                        </svg>
                        Actions
                    </div>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                    <input
                        ref={searchInputRef}
                        id="quick-actions-search"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={activeTab === 'clipboard' ? 'Search clipboard...' : 'Search actions...'}
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-md text-[var(--editor-text)] placeholder:text-[var(--editor-muted)] focus:outline-none focus:border-[var(--editor-accent)]"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center text-[var(--editor-muted)] hover:text-[var(--editor-text)]"
                        >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
                                 strokeWidth="1.5" strokeLinecap="round">
                                <path d="M1 1l8 8M9 1l-8 8"/>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div
                    className="mx-2 mt-2 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-auto p-2" ref={listRef}>
                {activeTab === 'clipboard' ? (
                    /* Clipboard History Tab */
                    !hasClipboardHistory ? (
                        /* PRO feature gate */
                        <div className="px-3 py-8 text-center">
                            <div
                                className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--editor-surface)] border border-[var(--editor-border)] flex items-center justify-center">
                                <svg className="w-6 h-6 text-[var(--editor-accent)]" fill="none" stroke="currentColor"
                                     viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                                </svg>
                            </div>
                            <h3 className="text-sm font-medium text-[var(--editor-text)] mb-1">Clipboard History</h3>
                            <p className="text-xs text-[var(--editor-muted)] mb-3">
                                Track and reuse your recent clipboard items. Upgrade to Pro to unlock.
                            </p>
                            <button
                                onClick={() => setActivePanel('settings')}
                                className="text-xs text-[var(--editor-accent)] hover:underline"
                            >
                                Upgrade to Pro
                            </button>
                        </div>
                    ) : filteredClipboardItems.length > 0 ? (
                        <div className="grid gap-1">
                            {filteredClipboardItems.map((item, index) => renderClipboardItem(item, index))}
                        </div>
                    ) : (
                        <div className="px-3 py-8 text-center text-xs text-[var(--editor-muted)]">
                            {searchQuery ? (
                                <>No clipboard items found for "{searchQuery}"</>
                            ) : (
                                <>
                                    <div className="mb-2">No clipboard history yet</div>
                                    <div className="opacity-60">Copy text to see it here</div>
                                </>
                            )}
                        </div>
                    )
                ) : (
                    /* Quick Actions Tab */
                    <>
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
                                <span
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">
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
                                                    <path d="M2 3.5l3 3 3-3"/>
                                                </svg>
                                            </button>

                                            {expandedSections.has(section.title) && (
                                                <div className="grid gap-1">
                                                    {section.proFeature && !isPro ? (
                                                        <div
                                                            className="px-3 py-4 text-center text-xs text-[var(--editor-muted)]">
                                                            <p className="mb-2">Upgrade to Pro to
                                                                unlock {section.title}</p>
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
                                                                {
                                                                    ...action,
                                                                    section: section.title,
                                                                    proFeature: section.proFeature
                                                                },
                                                                actionIndex
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                            {!expandedSections.has(section.title) && (
                                                // Skip indices for collapsed sections
                                                <>{(() => {
                                                    globalIndex += section.actions.length;
                                                    return null;
                                                })()}</>
                                            )}
                                        </div>
                                    );
                                });
                            })()
                        )}
                    </>
                )}
            </div>

            <div className="px-4 py-2 border-t border-[var(--editor-border)] rounded-br-[10px]">
                {activeTab === 'clipboard' ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-[var(--editor-muted)]">
                            <span className="kbd">Drag</span>
                            <span className="opacity-60">to insert</span>
                            <span className="opacity-30">·</span>
                            <span className="kbd">Click</span>
                            <span className="opacity-60">at cursor</span>
                        </div>
                        {clipboardItems.length > 0 && (
                            <button
                                onClick={clearClipboard}
                                className="text-xs text-[var(--editor-muted)] hover:text-red-400 transition-colors"
                            >
                                Clear all
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 text-xs text-[var(--editor-muted)]">
                        <span className="kbd">↑↓</span>
                        <span className="opacity-60">Navigate</span>
                        <span className="opacity-30">·</span>
                        <span className="kbd">↵</span>
                        <span className="opacity-60">Select</span>
                    </div>
                )}
            </div>
        </div>
    );
}
