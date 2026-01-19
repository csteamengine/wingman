import {useEffect, useRef, useCallback, useState} from 'react';
import {EditorView, keymap, placeholder} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {javascript} from '@codemirror/lang-javascript';
import {python} from '@codemirror/lang-python';
import {rust} from '@codemirror/lang-rust';
import {html} from '@codemirror/lang-html';
import {css} from '@codemirror/lang-css';
import {json} from '@codemirror/lang-json';
import {markdown} from '@codemirror/lang-markdown';
import {oneDark} from '@codemirror/theme-one-dark';
import {useEditorStore} from '../stores/editorStore';
import {useSettingsStore} from '../stores/settingsStore';
import {useLicenseStore} from '../stores/licenseStore';

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

export function EditorWindow() {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const {
        content,
        setContent,
        language,
        setLanguage,
        stats,
        isVisible,
        pasteAndClose,
        setEditorView,
        images,
        addImage,
        removeImage
    } = useEditorStore();
    const {settings} = useSettingsStore();
    const {isProFeatureEnabled} = useLicenseStore();

    const hasImageSupport = isProFeatureEnabled('image_attachments');

    // Editor keymaps: line operations and auto-list continuation
    const editorKeymap = keymap.of([
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

                // Check if current line starts with a bullet
                if (lineText.trimStart().startsWith('• ')) {
                    // If line is just "• " (empty bullet), remove it instead of adding new bullet
                    if (lineText.trim() === '•') {
                        view.dispatch({
                            changes: {from: line.from, to: line.to, insert: ''},
                        });
                        return true;
                    }

                    // Insert newline + bullet
                    view.dispatch({
                        changes: {
                            from: state.selection.main.head,
                            insert: '\n• ',
                        },
                        selection: {anchor: state.selection.main.head + 3},
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
    const hasSyntaxHighlighting = isProFeatureEnabled('syntax_highlighting');
    const hasLanguageSelection = isProFeatureEnabled('language_selection');

    // Handle paste for files (PRO feature)
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

    // Focus editor when window becomes visible
    useEffect(() => {
        if (isVisible && viewRef.current) {
            // Small delay to ensure window is fully shown
            setTimeout(() => {
                viewRef.current?.focus();
            }, 50);
        }
    }, [isVisible]);

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
            // Custom keymap first so it takes precedence (line ops, auto-list)
            editorKeymap,
            keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
            placeholder('Start typing...'),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    const newContent = update.state.doc.toString();
                    setContent(newContent);
                }
            }),
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
      

            {settings?.show_status_bar !== false && (
                <div className="border-t border-[var(--editor-border)] rounded-b-[10px]">
                    {/* Info row */}
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
                        {/* Language Selector */}
                        <div className="relative">
                            {hasLanguageSelection && hasSyntaxHighlighting ? (
                                <>
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
                                </>
                            ) : (
                                <span
                                    className="opacity-60 text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">PRO</span>
                            )}
                        </div>
                    </div>

                    {/* Action button row */}
                    <div className="px-3 pb-3">
                        <button
                            onClick={pasteAndClose}
                            disabled={!content.trim() && images.length === 0}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[var(--editor-surface)] border border-[var(--editor-border)] text-sm text-[var(--editor-text)] hover:bg-[var(--editor-hover)] disabled:opacity-40 transition-colors"
                        >
                            <span>Copy to Clipboard</span>
                            <span className="kbd">⌘↵</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
