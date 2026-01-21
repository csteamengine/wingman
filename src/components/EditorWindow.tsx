import {useEffect, useRef, useCallback, useState} from 'react';
import {EditorView, keymap, placeholder, Decoration, ViewPlugin, drawSelection, dropCursor} from '@codemirror/view';
import type {DecorationSet, ViewUpdate} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {search, searchKeymap} from '@codemirror/search';
import {javascript} from '@codemirror/lang-javascript';
import {python} from '@codemirror/lang-python';
import {rust} from '@codemirror/lang-rust';
import {html} from '@codemirror/lang-html';
import {css} from '@codemirror/lang-css';
import {json} from '@codemirror/lang-json';
import {markdown} from '@codemirror/lang-markdown';
import {oneDark} from '@codemirror/theme-one-dark';
import {listen} from '@tauri-apps/api/event';
import {useEditorStore} from '../stores/editorStore';
import {useSettingsStore} from '../stores/settingsStore';
import {useLicenseStore} from '../stores/licenseStore';
import {usePremiumStore} from '../stores/premiumStore';
import type {ObsidianResult} from '../types';

const languages: Record<string, () => ReturnType<typeof javascript>> = {
    javascript: javascript,
    typescript: () => javascript({typescript: true}),
    jsx: () => javascript({jsx: true}),
    tsx: () => javascript({jsx: true, typescript: true}),
    python: python,
    rust: rust,
    html: html,
    css: css,
    json: json,
    markdown: markdown,
};

const LANGUAGE_OPTIONS = [
    {value: 'plaintext', label: 'Plain Text'},
    {value: 'javascript', label: 'JavaScript'},
    {value: 'typescript', label: 'TypeScript'},
    {value: 'jsx', label: 'JSX'},
    {value: 'tsx', label: 'TSX'},
    {value: 'python', label: 'Python'},
    {value: 'rust', label: 'Rust'},
    {value: 'html', label: 'HTML'},
    {value: 'css', label: 'CSS'},
    {value: 'json', label: 'JSON'},
    {value: 'markdown', label: 'Markdown'},
];

// Markdown link decoration - hides syntax and shows only link text in blue
const hiddenMark = Decoration.mark({ class: 'cm-markdown-link-hidden' });
const linkTextMark = Decoration.mark({ class: 'cm-markdown-link-text' });

// Build decorations for markdown links
function buildMarkdownLinkDecorations(view: EditorView): DecorationSet {
    const decorations: {from: number, to: number, decoration: Decoration}[] = [];
    const doc = view.state.doc;
    const text = doc.toString();
    const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const start = match.index;
        const bracketOpen = start; // [
        const textStart = start + 1; // start of link text
        const textEnd = textStart + match[1].length; // end of link text
        const bracketClose = textEnd; // ]
        const end = start + match[0].length; // end of )

        // Hide the opening bracket [
        decorations.push({ from: bracketOpen, to: textStart, decoration: hiddenMark });
        // Style the link text
        decorations.push({ from: textStart, to: textEnd, decoration: linkTextMark });
        // Hide the ](url)
        decorations.push({ from: bracketClose, to: end, decoration: hiddenMark });
    }

    return Decoration.set(decorations.map(d => d.decoration.range(d.from, d.to)), true);
}

const markdownLinkPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = buildMarkdownLinkDecorations(view);
        }
        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged) {
                this.decorations = buildMarkdownLinkDecorations(update.view);
            }
        }
    },
    { decorations: (v) => v.decorations }
);

// CSS theme for markdown links
const markdownLinkTheme = EditorView.baseTheme({
    '.cm-markdown-link-hidden': {
        display: 'none',
    },
    '.cm-markdown-link-text': {
        color: '#3b82f6',
        textDecoration: 'underline',
        textDecorationColor: '#3b82f680',
        cursor: 'pointer',
    },
});

// Helper to check if a string is a URL
const isUrl = (str: string): boolean => {
    return /^https?:\/\/\S+$/.test(str.trim());
};

// Paste handler extension for markdown link creation
const markdownLinkPasteHandler = EditorView.domEventHandlers({
    paste(event, view) {
        const pastedText = event.clipboardData?.getData('text/plain');
        if (!pastedText) return false;

        const selection = view.state.selection.main;
        if (selection.empty || !isUrl(pastedText)) return false;

        // There's a selection and the paste content is a URL
        event.preventDefault();
        const selectedText = view.state.sliceDoc(selection.from, selection.to);
        const markdownLink = `[${selectedText}](${pastedText.trim()})`;

        view.dispatch({
            changes: {
                from: selection.from,
                to: selection.to,
                insert: markdownLink,
            },
            selection: { anchor: selection.from + markdownLink.length },
        });
        return true;
    },
});

export function EditorWindow() {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [obsidianToast, setObsidianToast] = useState<ObsidianResult | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [showAiPopover, setShowAiPopover] = useState(false);
    const aiPopoverRef = useRef<HTMLDivElement>(null);

    // Close AI popover when clicking outside
    useEffect(() => {
        if (!showAiPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (aiPopoverRef.current && !aiPopoverRef.current.contains(e.target as Node)) {
                setShowAiPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAiPopover]);

    const {
        content,
        setContent,
        language,
        setLanguage,
        stats,
        isVisible,
        activePanel,
        pasteAndClose,
        hideWindow,
        setEditorView,
        images,
        addImage,
        removeImage,
        transformText,
        applyBulletList,
        applyNumberedList
    } = useEditorStore();
    const {settings} = useSettingsStore();
    const {isProFeatureEnabled, isPremiumTier} = useLicenseStore();
    const {
        aiLoading,
        obsidianConfig,
        loadAIConfig,
        loadObsidianConfig,
        loadSubscriptionStatus,
        loadAIPresets,
        callAIWithPreset,
        getEnabledPresets,
        addToObsidian,
        openObsidianNote
    } = usePremiumStore();

    const isPremium = isPremiumTier();
    const hasObsidianAccess = isProFeatureEnabled('obsidian_integration');
    const hasObsidianConfigured = obsidianConfig && obsidianConfig.vault_path;

    // Load AI config, presets, and subscription status on mount for premium users
    // Load Obsidian config for Pro users (or higher)
    useEffect(() => {
        if (hasObsidianAccess) {
            loadObsidianConfig();
        }
        if (isPremium) {
            loadAIConfig();
            loadAIPresets();
            // Also load subscription status for API calls
            const licenseKey = localStorage.getItem('wingman_license_key');
            if (licenseKey) {
                loadSubscriptionStatus(licenseKey);
            }
        }
    }, [isPremium, hasObsidianAccess, loadAIConfig, loadObsidianConfig, loadAIPresets, loadSubscriptionStatus]);

    const hasImageSupport = isProFeatureEnabled('image_attachments');

    // Auto-hide obsidian toast after 5 seconds
    useEffect(() => {
        if (obsidianToast) {
            const timer = setTimeout(() => setObsidianToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [obsidianToast]);

    // Auto-hide AI error after 3 seconds
    useEffect(() => {
        if (aiError) {
            const timer = setTimeout(() => setAiError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [aiError]);

    // Handle AI refine action with preset
    const handleAiRefineWithPreset = useCallback(async (preset: { id: string; systemPrompt: string; name: string }) => {
        if (aiLoading || !content.trim()) return;
        setAiError(null);
        setShowAiPopover(false);

        const licenseKey = localStorage.getItem('wingman_license_key');
        if (!licenseKey) {
            setAiError('License key not found');
            return;
        }

        const response = await callAIWithPreset(licenseKey, content, preset as any);
        if (response && response.result) {
            setContent(response.result);
        } else {
            setAiError('Failed to refine text');
        }
    }, [aiLoading, content, callAIWithPreset, setContent]);

    // Get enabled presets for the popover
    const enabledPresets = getEnabledPresets();

    // Handle Obsidian send action
    const handleObsidianSend = useCallback(async () => {
        if (!content.trim()) return;

        const result = await addToObsidian(content);
        if (result) {
            setObsidianToast(result);
        }
    }, [content, addToObsidian]);

    // Handle toast click to open Obsidian note
    const handleToastClick = useCallback(async () => {
        if (obsidianToast) {
            await openObsidianNote(obsidianToast.open_uri);
            setObsidianToast(null);
            // Close the window even if in sticky mode
            await hideWindow();
        }
    }, [obsidianToast, openObsidianNote, hideWindow]);

    // Helper to wrap selected text with brackets/quotes
    const wrapSelection = (view: EditorView, open: string, close: string): boolean => {
        const selection = view.state.selection.main;
        if (selection.empty) return false; // No selection, let default behavior handle it

        const selectedText = view.state.sliceDoc(selection.from, selection.to);
        view.dispatch({
            changes: {
                from: selection.from,
                to: selection.to,
                insert: open + selectedText + close,
            },
            selection: { anchor: selection.from + open.length, head: selection.from + open.length + selectedText.length },
        });
        return true;
    };

    // Editor keymaps: line operations, auto-list continuation, and bracket wrapping
    const editorKeymap = keymap.of([
        // Auto-wrap selection with quotes and brackets
        { key: '"', run: (view) => wrapSelection(view, '"', '"') },
        { key: "'", run: (view) => wrapSelection(view, "'", "'") },
        { key: '[', run: (view) => wrapSelection(view, '[', ']') },
        { key: ']', run: (view) => wrapSelection(view, '[', ']') },
        { key: '{', run: (view) => wrapSelection(view, '{', '}') },
        { key: '}', run: (view) => wrapSelection(view, '{', '}') },
        { key: '(', run: (view) => wrapSelection(view, '(', ')') },
        { key: ')', run: (view) => wrapSelection(view, '(', ')') },
        { key: '<', run: (view) => wrapSelection(view, '<', '>') },
        { key: '>', run: (view) => wrapSelection(view, '<', '>') },
        // Cmd/Ctrl+D: Duplicate line
        {
            key: 'Mod-d',
            run: (view) => {
                const state = view.state;
                const line = state.doc.lineAt(state.selection.main.head);
                const lineText = line.text;

                // Insert a copy of the line below
                view.dispatch({
                    changes: {
                        from: line.to,
                        insert: '\n' + lineText,
                    },
                    // Move cursor to the duplicated line at the same position
                    selection: {anchor: line.to + 1 + (state.selection.main.head - line.from)},
                });
                return true;
            },
        },
        // Cmd/Ctrl+Shift+Up: Move line(s) up
        {
            key: 'Mod-Shift-ArrowUp',
            run: (view) => {
                const state = view.state;
                const selection = state.selection.main;

                // Get the range of lines in the selection
                const startLine = state.doc.lineAt(selection.from);
                const endLine = state.doc.lineAt(selection.to);

                // Can't move up if already at first line
                if (startLine.number === 1) return true;

                const prevLine = state.doc.line(startLine.number - 1);

                // Get the text of all selected lines
                const selectedText = state.doc.sliceString(startLine.from, endLine.to);

                // Calculate new selection positions
                const selectionStartOffset = selection.from - startLine.from;
                const selectionEndOffset = selection.to - startLine.from;

                // Move selected lines above the previous line
                view.dispatch({
                    changes: {
                        from: prevLine.from,
                        to: endLine.to,
                        insert: selectedText + '\n' + prevLine.text,
                    },
                    selection: {
                        anchor: prevLine.from + selectionStartOffset,
                        head: prevLine.from + selectionEndOffset,
                    },
                });
                return true;
            },
        },
        // Cmd/Ctrl+Shift+Down: Move line(s) down
        {
            key: 'Mod-Shift-ArrowDown',
            run: (view) => {
                const state = view.state;
                const selection = state.selection.main;

                // Get the range of lines in the selection
                const startLine = state.doc.lineAt(selection.from);
                const endLine = state.doc.lineAt(selection.to);

                // Can't move down if already at last line
                if (endLine.number === state.doc.lines) return true;

                const nextLine = state.doc.line(endLine.number + 1);

                // Get the text of all selected lines
                const selectedText = state.doc.sliceString(startLine.from, endLine.to);

                // Calculate new selection positions (after nextLine is moved above)
                const selectionStartOffset = selection.from - startLine.from;
                const selectionEndOffset = selection.to - startLine.from;
                const newStart = startLine.from + nextLine.text.length + 1;

                // Move selected lines below the next line
                view.dispatch({
                    changes: {
                        from: startLine.from,
                        to: nextLine.to,
                        insert: nextLine.text + '\n' + selectedText,
                    },
                    selection: {
                        anchor: newStart + selectionStartOffset,
                        head: newStart + selectionEndOffset,
                    },
                });
                return true;
            },
        },
        // Enter: Auto-continue lists
        {
            key: 'Enter',
            run: (view) => {
                const state = view.state;
                const line = state.doc.lineAt(state.selection.main.head);
                const lineText = line.text;

                // Check if current line starts with a bullet (•, -, or *)
                const bulletMatch = lineText.match(/^(\s*)([-*•])\s/);
                if (bulletMatch) {
                    const indent = bulletMatch[1];
                    const bulletChar = bulletMatch[2];

                    // If line is just the bullet with no content after it, remove it
                    const contentAfterBullet = lineText.slice(bulletMatch[0].length).trim();
                    if (contentAfterBullet === '') {
                        view.dispatch({
                            changes: {from: line.from, to: line.to, insert: ''},
                        });
                        return true;
                    }

                    // Insert newline + bullet
                    const nextPrefix = `\n${indent}${bulletChar} `;
                    view.dispatch({
                        changes: {
                            from: state.selection.main.head,
                            insert: nextPrefix,
                        },
                        selection: {anchor: state.selection.main.head + nextPrefix.length},
                    });
                    return true;
                }

                // Check if current line starts with a number (e.g., "1. ", "2. ", "10. ")
                const numberMatch = lineText.match(/^(\s*)(\d+)\.\s/);
                if (numberMatch) {
                    const indent = numberMatch[1];
                    const currentNum = parseInt(numberMatch[2], 10);
                    const nextNum = currentNum + 1;

                    // If line is just the number with no content after it, remove it
                    const contentAfterNumber = lineText.slice(numberMatch[0].length).trim();
                    if (contentAfterNumber === '') {
                        view.dispatch({
                            changes: {from: line.from, to: line.to, insert: ''},
                        });
                        return true;
                    }

                    // Insert newline + next number
                    const nextPrefix = `\n${indent}${nextNum}. `;
                    view.dispatch({
                        changes: {
                            from: state.selection.main.head,
                            insert: nextPrefix,
                        },
                        selection: {anchor: state.selection.main.head + nextPrefix.length},
                    });
                    return true;
                }

                // Not a list line, let default Enter behavior handle it
                return false;
            },
        },
    ]);

    const hasStatsDisplay = isProFeatureEnabled('stats_display');
    // Language selection is free for all users

    // Handle paste for file attachments (PRO feature)
    // Note: Markdown link pasting is handled by CodeMirror extension (markdownLinkPasteHandler)
    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        if (!hasImageSupport) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        const filesToAdd: File[] = [];

        // Collect all files from clipboard
        for (const item of Array.from(items)) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    filesToAdd.push(file);
                }
            }
        }

        // If we have files, prevent default and add them all
        if (filesToAdd.length > 0) {
            e.preventDefault();

            // Just add the files as attachments, no text placeholders
            for (const file of filesToAdd) {
                await addImage(file);
            }
        }
    }, [hasImageSupport, addImage]);

    // Add paste event listener
    useEffect(() => {
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    // Handle drag-and-drop for images (PRO feature)
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasImageSupport && e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    }, [hasImageSupport]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasImageSupport && e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            setIsDragging(true);
        }
    }, [hasImageSupport]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only set dragging to false if we're leaving the main container
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!hasImageSupport) return;

        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // Just add the files as attachments, no text placeholders
        for (const file of files) {
            await addImage(file);
        }
    }, [hasImageSupport, addImage]);

    // Focus editor when window becomes visible or when returning from other panels
    useEffect(() => {
        const shouldFocusEditor = isVisible && (activePanel === 'editor' || activePanel === 'actions');
        if (shouldFocusEditor && viewRef.current) {
            // Small delay to ensure window/panel transition is complete
            setTimeout(() => {
                const view = viewRef.current;
                if (view) {
                    view.focus();
                    // Move cursor to end of content
                    const endPos = view.state.doc.length;
                    view.dispatch({
                        selection: { anchor: endPos },
                    });
                }
            }, 50);
        }
    }, [isVisible, activePanel]);

    const getLanguageExtension = useCallback(() => {
        const langFn = languages[language];
        return langFn ? [langFn()] : [];
    }, [language]);

    // Store current content before recreating editor
    const contentRef = useRef(content);
    contentRef.current = content;

    useEffect(() => {
        if (!editorRef.current) return;

        const extensions = [
            history(),
            // Enable multi-cursor support (Cmd+click to add cursors)
            EditorState.allowMultipleSelections.of(true),
            drawSelection(),
            dropCursor(),
            // Custom keymap first so it takes precedence (line ops, auto-list)
            editorKeymap,
            keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
            // Find/Replace (Cmd+F to open)
            search({ top: true }),
            placeholder('Start typing...'),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    const newContent = update.state.doc.toString();
                    setContent(newContent);
                }
            }),
            // Markdown link paste handling and styling
            markdownLinkPasteHandler,
            markdownLinkPlugin,
            markdownLinkTheme,
            ...getLanguageExtension(),
        ];

        // Add dark theme for dark-ish themes (CodeMirror's oneDark works well for these)
        const darkThemes = ['dark', 'high-contrast', 'solarized-dark', 'dracula', 'nord'];
        if (!settings?.theme || darkThemes.includes(settings.theme)) {
            extensions.push(oneDark);
        }

        // Use contentRef to get latest content even when effect re-runs
        const state = EditorState.create({
            doc: contentRef.current,
            extensions,
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;
        setEditorView(view);

        // Focus the editor
        view.focus();

        return () => {
            view.destroy();
            setEditorView(null);
        };
    }, [language, settings?.theme, setContent, getLanguageExtension]);

    // Listen for refocus events (triggered when workspace changes in sticky mode)
    useEffect(() => {
        const unlisten = listen('refocus-editor', () => {
            console.log('Refocus event received - focusing editor');
            if (viewRef.current) {
                viewRef.current.focus();
            }
        });

        return () => {
            unlisten.then(fn => fn());
        };
    }, []);

    // Update editor content when it changes externally
    useEffect(() => {
        if (viewRef.current) {
            const currentContent = viewRef.current.state.doc.toString();
            if (currentContent !== content) {
                viewRef.current.dispatch({
                    changes: {
                        from: 0,
                        to: currentContent.length,
                        insert: content,
                    },
                });
            }
        }
    }, [content]);

    return (
        <div
            className="flex flex-col h-full relative"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Text Transformation Toolbar - Top */}
            <div className="border-b border-[var(--editor-border)] px-2 py-2 overflow-x-auto">
                <div className="flex items-center gap-0.5 min-w-max">
                    {/* Text Case Group */}
                    <button onClick={() => transformText('uppercase')} title="UPPERCASE" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 18h7l-3-9-3 9z"/><path d="M14 18h7l-3-9-3 9z"/><path d="M5 14h4"/><path d="M16 14h4"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('lowercase')} title="lowercase" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="9" cy="15" r="4"/><path d="M13 11v4c0 2.2 1.8 4 4 4s4-1.8 4-4v-4"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('titlecase')} title="Title Case" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <text x="2" y="17" fontSize="16" fill="currentColor" fontFamily="sans-serif" fontWeight="bold">Aa</text>
                        </svg>
                    </button>
                    <button onClick={() => transformText('sentencecase')} title="Sentence case" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <text x="1" y="16" fontSize="14" fill="currentColor" fontFamily="sans-serif">Aa</text>
                            <circle cx="20" cy="14" r="1.5" fill="currentColor"/>
                        </svg>
                    </button>
                    <div className="w-px h-6 bg-[var(--editor-border)] mx-1"/>

                    {/* Text Formatting Group */}
                    <button onClick={() => transformText('trim')} title="Trim Whitespace" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M6 3v18M18 3v18"/><path d="M9 12h6"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('sort')} title="Sort Lines A→Z" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 11h4"/><path d="M11 15h7"/><path d="M11 19h10"/><path d="M3 7l3-3 3 3"/><path d="M6 4v14"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('deduplicate')} title="Remove Duplicate Lines" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="18" height="5" rx="1"/><rect x="3" y="10" width="18" height="5" rx="1" opacity="0.3"/><line x1="14" y1="18" x2="20" y2="18"/><line x1="17" y1="15" x2="17" y2="21"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('reverse')} title="Reverse Lines" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 5h18"/><path d="M3 12h15"/><path d="M3 19h12"/>
                            <polyline points="17 15 21 19 17 23"/>
                        </svg>
                    </button>
                    <div className="w-px h-6 bg-[var(--editor-border)] mx-1"/>

                    {/* Lists Group */}
                    <button onClick={applyBulletList} title="Bulleted List" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/>
                            <circle cx="4" cy="6" r="1.5" fill="currentColor"/><circle cx="4" cy="12" r="1.5" fill="currentColor"/><circle cx="4" cy="18" r="1.5" fill="currentColor"/>
                        </svg>
                    </button>
                    <button onClick={applyNumberedList} title="Numbered List" className="toolbar-btn">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/>
                            <text x="3" y="8" fontSize="7" fill="currentColor" fontFamily="monospace">1</text>
                            <text x="3" y="14" fontSize="7" fill="currentColor" fontFamily="monospace">2</text>
                            <text x="3" y="20" fontSize="7" fill="currentColor" fontFamily="monospace">3</text>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Drag overlay */}
            {isDragging && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--editor-bg)]/90 border-2 border-dashed border-[var(--editor-accent)] rounded-lg">
                    <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2 text-[var(--editor-accent)]" fill="none"
                             stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <p className="text-sm text-[var(--editor-text)]">Drop files to attach</p>
                    </div>
                </div>
            )}

            {/* AI Loading overlay */}
            {aiLoading && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--editor-bg)]/95 backdrop-blur-sm rounded-lg">
                    <div className="text-center">
                        <svg className="w-10 h-10 mx-auto mb-3 text-purple-400 animate-spin" fill="none"
                             viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        <p className="text-sm font-medium text-purple-300">Refining with AI...</p>
                        <p className="text-xs text-[var(--editor-text-muted)] mt-1">This may take a moment</p>
                    </div>
                </div>
            )}

            <div
                ref={editorRef}
                className="flex-1 overflow-hidden"
                style={{
                    fontFamily: settings?.font_family || 'monospace',
                    fontSize: `${settings?.font_size || 14}px`,
                }}
            />

            {/* Attachments */}
            {images.length > 0 && (
                <div className="border-t border-[var(--editor-border)] px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[var(--editor-muted)]">Attachments:</span>
                        {images.map((attachment) => (
                            <div key={attachment.id} className="relative group">
                                {attachment.type === 'image' ? (
                                    // Image thumbnail
                                    <img
                                        src={attachment.data}
                                        alt={attachment.name}
                                        className="h-10 w-auto rounded border border-[var(--editor-border)] object-cover"
                                        title={`[image #${attachment.id}] - ${attachment.name}`}
                                    />
                                ) : (
                                    // File icon for non-images
                                    <div
                                        className="h-10 w-10 rounded border border-[var(--editor-border)] bg-[var(--editor-surface)] flex items-center justify-center"
                                        title={`[file #${attachment.id}] - ${attachment.name}`}
                                    >
                                        {attachment.type === 'text' ? (
                                            // Text file icon
                                            <svg className="w-5 h-5 text-[var(--editor-muted)]" fill="none"
                                                 stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                            </svg>
                                        ) : (
                                            // Generic file icon
                                            <svg className="w-5 h-5 text-[var(--editor-muted)]" fill="none"
                                                 stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                            </svg>
                                        )}
                                    </div>
                                )}
                                <button
                                    onClick={() => removeImage(attachment.id)}
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                    title="Remove"
                                >
                                    ×
                                </button>
                                <span
                                    className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 truncate">
                  #{attachment.id}
                </span>
                            </div>
                        ))}
                    </div>
                    {/* Info notice when both text and files present */}
                    {content.trim() && (
                        <div
                            className="mt-2 flex items-start gap-1.5 text-[10px] text-[var(--editor-muted)] opacity-70">
                            <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <span className="text-yellow-600 dark:text-yellow-400 font-semibold">
                Most apps will paste either files or text, not both. Try Ctrl+V for files, Cmd+V for text.
              </span></div>
                    )}
                </div>
            )}

            {/* Stats bar - optional */}
            {settings?.show_status_bar !== false && (
                <div className="border-t border-[var(--editor-border)]">
                    {/* Stats info row */}
                    <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--editor-muted)]">
                        <div className="flex items-center gap-3">
                            {hasStatsDisplay ? (
                                <>
                                    <span>{stats.character_count} chars</span>
                                    <span className="opacity-30">·</span>
                                    <span>{stats.word_count} words</span>
                                    <span className="opacity-30">·</span>
                                    <span>{stats.line_count} lines</span>
                                </>
                            ) : (
                                <span className="opacity-60">Pro: Stats</span>
                            )}
                        </div>
                        {/* Language Selector - Free for all users */}
                        <div className="relative">
                            <button
                                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                                className="text-xs px-2 py-1 rounded-md hover:bg-[var(--editor-hover)] transition-colors"
                            >
                                {LANGUAGE_OPTIONS.find(l => l.value === language)?.label || 'Plain Text'}
                                <span className="ml-1 opacity-40">▾</span>
                            </button>
                            {showLanguageDropdown && (
                                <div
                                    className="absolute bottom-full mb-1 right-0 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-md shadow-lg z-50 min-w-[140px] max-h-[200px] overflow-y-auto py-1">
                                    {LANGUAGE_OPTIONS.map((lang) => (
                                        <button
                                            key={lang.value}
                                            onClick={() => {
                                                setLanguage(lang.value);
                                                setShowLanguageDropdown(false);
                                            }}
                                            className={`w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--editor-hover)] ${
                                                language === lang.value ? 'text-[var(--editor-accent)]' : ''
                                            }`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Action buttons - always visible */}
            <div className={`${settings?.show_status_bar !== false ? '' : 'border-t border-[var(--editor-border)]'} rounded-b-[10px]`}>
                {/* Action button row */}
                <div className="px-3 py-3 flex gap-2">
                        {/* AI Refine button with popover - green */}
                        <div className="relative" ref={aiPopoverRef}>
                            <button
                                onClick={() => setShowAiPopover(!showAiPopover)}
                                disabled={!isPremium || !content.trim() || aiLoading}
                                title="Refine text with AI"
                                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm transition-colors bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                            >
                                {aiLoading ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                                        <path d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                                        <path d="M16.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                                    </svg>
                                )}
                                <span>AI</span>
                                <svg className="w-3 h-3 ml-0.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                </svg>
                            </button>

                            {/* AI Presets Popover */}
                            {showAiPopover && (
                                <div className="absolute bottom-full mb-2 left-0 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-lg shadow-lg z-50 min-w-[220px] py-1 animate-fade-in">
                                    <div className="px-3 py-2 border-b border-[var(--editor-border)]">
                                        <p className="text-xs font-medium text-[var(--editor-text)]">Transform with AI</p>
                                        <p className="text-[10px] text-[var(--editor-muted)]">Select a preset to refine your text</p>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {enabledPresets.map((preset) => (
                                            <button
                                                key={preset.id}
                                                onClick={() => handleAiRefineWithPreset(preset)}
                                                className="w-full text-left px-3 py-2 hover:bg-[var(--editor-hover)] transition-colors"
                                            >
                                                <p className="text-xs font-medium text-[var(--editor-text)]">{preset.name}</p>
                                                <p className="text-[10px] text-[var(--editor-muted)]">{preset.description}</p>
                                            </button>
                                        ))}
                                    </div>
                                    {enabledPresets.length === 0 && (
                                        <p className="px-3 py-2 text-xs text-[var(--editor-muted)]">No presets enabled. Configure in Settings.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Obsidian button - purple/violet (Obsidian brand color) - Pro feature */}
                        <button
                            onClick={handleObsidianSend}
                            disabled={!hasObsidianAccess || !hasObsidianConfigured || !content.trim()}
                            title={!hasObsidianAccess ? "Pro feature - Send to Obsidian" : (!hasObsidianConfigured ? "Configure Obsidian vault in Settings first" : "Send to Obsidian")}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm transition-colors bg-purple-500/10 border border-purple-500/30 text-purple-300 hover:bg-purple-500/20 disabled:opacity-40"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/>
                            </svg>
                            <span>Obsidian</span>
                        </button>

                        {/* Copy to Clipboard - main action */}
                        <button
                            onClick={pasteAndClose}
                            disabled={!content.trim() && images.length === 0}
                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[var(--editor-surface)] border border-[var(--editor-border)] text-sm text-[var(--editor-text)] hover:bg-[var(--editor-hover)] disabled:opacity-40 transition-colors"
                        >
                            <span>Copy to Clipboard</span>
                            <span className="kbd">⌘↵</span>
                        </button>
                    </div>

                {/* AI Error message */}
                {aiError && (
                    <div className="mx-3 mb-3 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
                        {aiError}
                    </div>
                )}
            </div>

            {/* Obsidian Toast Notification */}
            {obsidianToast && (
                <div
                    onClick={handleToastClick}
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 cursor-pointer animate-slide-up"
                >
                    <div className="flex items-center gap-3 px-4 py-3 bg-violet-600/95 rounded-lg shadow-lg border border-violet-500/50 hover:bg-violet-600 transition-colors">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                        <div className="text-white">
                            <p className="text-sm font-medium">Saved to Obsidian</p>
                            <p className="text-xs opacity-80">Click to open "{obsidianToast.note_name}"</p>
                        </div>
                        <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
}
