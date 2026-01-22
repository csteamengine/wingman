import {useEffect, useRef, useCallback, useState} from 'react';
import {EditorView, keymap, placeholder, Decoration, ViewPlugin, drawSelection, dropCursor, WidgetType} from '@codemirror/view';
import type {DecorationSet, ViewUpdate} from '@codemirror/view';
import type {SelectionRange} from '@codemirror/state';
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
import {sql} from '@codemirror/lang-sql';
import {yaml} from '@codemirror/lang-yaml';
import {xml} from '@codemirror/lang-xml';
import {java} from '@codemirror/lang-java';
import {go} from '@codemirror/lang-go';
import {php} from '@codemirror/lang-php';
import {cpp} from '@codemirror/lang-cpp';
import {StreamLanguage} from '@codemirror/language';
import {shell} from '@codemirror/legacy-modes/mode/shell';
import {ruby} from '@codemirror/legacy-modes/mode/ruby';
import {swift} from '@codemirror/legacy-modes/mode/swift';
import {csharp} from '@codemirror/legacy-modes/mode/clike';
import {kotlin} from '@codemirror/legacy-modes/mode/clike';
import {bracketMatching} from '@codemirror/language';
import {autocompletion, closeBrackets, closeBracketsKeymap} from '@codemirror/autocomplete';
import {linter, lintGutter} from '@codemirror/lint';
import type {Diagnostic} from '@codemirror/lint';
import {oneDark} from '@codemirror/theme-one-dark';
import {listen} from '@tauri-apps/api/event';
import {useEditorStore} from '../stores/editorStore';
import {useSettingsStore} from '../stores/settingsStore';
import {useLicenseStore} from '../stores/licenseStore';
import {usePremiumStore} from '../stores/premiumStore';
import {useDragStore} from '../stores/dragStore';
import type {ObsidianResult} from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const languages: Record<string, () => any> = {
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
    // Primary languages (free)
    sql: sql,
    yaml: yaml,
    xml: xml,
    bash: () => StreamLanguage.define(shell),
    java: java,
    go: go,
    php: php,
    c: cpp,
    cpp: cpp,
    // Secondary languages (PRO)
    ruby: () => StreamLanguage.define(ruby),
    swift: () => StreamLanguage.define(swift),
    kotlin: () => StreamLanguage.define(kotlin),
    csharp: () => StreamLanguage.define(csharp),
};

interface LanguageOption {
    value: string;
    label: string;
    isPro?: boolean;
}

const LANGUAGE_OPTIONS: LanguageOption[] = [
    // Text formats
    {value: 'plaintext', label: 'Plain Text'},
    {value: 'markdown', label: 'Markdown'},
    // Web languages
    {value: 'javascript', label: 'JavaScript'},
    {value: 'typescript', label: 'TypeScript'},
    {value: 'jsx', label: 'JSX'},
    {value: 'tsx', label: 'TSX'},
    {value: 'html', label: 'HTML'},
    {value: 'css', label: 'CSS'},
    {value: 'json', label: 'JSON'},
    // Primary languages (free)
    {value: 'sql', label: 'SQL'},
    {value: 'yaml', label: 'YAML'},
    {value: 'xml', label: 'XML'},
    {value: 'bash', label: 'Bash/Shell'},
    {value: 'python', label: 'Python'},
    {value: 'java', label: 'Java'},
    {value: 'go', label: 'Go'},
    {value: 'php', label: 'PHP'},
    {value: 'c', label: 'C'},
    {value: 'cpp', label: 'C++'},
    {value: 'rust', label: 'Rust'},
    // Secondary languages (PRO)
    {value: 'ruby', label: 'Ruby', isPro: true},
    {value: 'swift', label: 'Swift', isPro: true},
    {value: 'kotlin', label: 'Kotlin', isPro: true},
    {value: 'csharp', label: 'C#', isPro: true},
];

// JSON Linter - validates JSON syntax and reports errors
function jsonLinter(view: EditorView): Diagnostic[] {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    try {
        JSON.parse(doc);
        return [];
    } catch (e) {
        if (e instanceof SyntaxError) {
            // Try to extract line/column from error message
            const match = e.message.match(/at position (\d+)/);
            let pos = 0;
            if (match) {
                pos = parseInt(match[1], 10);
            }
            // Clamp position to document bounds
            pos = Math.min(pos, doc.length);

            return [{
                from: pos,
                to: Math.min(pos + 1, doc.length),
                severity: 'error',
                message: e.message,
            }];
        }
        return [];
    }
}

// YAML Linter - basic validation for common YAML issues
function yamlLinter(view: EditorView): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const doc = view.state.doc;

    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const text = line.text;

        // Check for tabs (YAML should use spaces)
        if (text.includes('\t')) {
            const tabPos = text.indexOf('\t');
            diagnostics.push({
                from: line.from + tabPos,
                to: line.from + tabPos + 1,
                severity: 'warning',
                message: 'YAML should use spaces, not tabs for indentation',
            });
        }

        // Check for trailing colons without values on same line (common mistake)
        const colonMatch = text.match(/:\s*$/);
        if (colonMatch && !text.trim().endsWith(':') && text.trim().length > 1) {
            // This is valid YAML (multi-line value), skip
        }
    }

    return diagnostics;
}

// ===== UNIFIED MARKDOWN DECORATION SYSTEM =====
// Obsidian-style editing: syntax hidden when cursor is outside, shown when cursor is inside

// Decoration marks for different markdown elements
const mdHidden = Decoration.mark({ class: 'cm-md-hidden' });
const mdBold = Decoration.mark({ class: 'cm-md-bold' });
const mdItalic = Decoration.mark({ class: 'cm-md-italic' });
const mdBoldItalic = Decoration.mark({ class: 'cm-md-bold cm-md-italic' });
const mdStrikethrough = Decoration.mark({ class: 'cm-md-strikethrough' });
const mdCode = Decoration.mark({ class: 'cm-md-code' });
const mdLink = Decoration.mark({ class: 'cm-md-link' });
const mdH1 = Decoration.line({ class: 'cm-md-h1' });
const mdH2 = Decoration.line({ class: 'cm-md-h2' });
const mdH3 = Decoration.line({ class: 'cm-md-h3' });
const mdH4 = Decoration.line({ class: 'cm-md-h4' });
const mdBlockquote = Decoration.line({ class: 'cm-md-blockquote' });
const mdHr = Decoration.line({ class: 'cm-md-hr' });

// Image widget for rendering inline images
class ImageWidget extends WidgetType {
    url: string;
    alt: string;

    constructor(url: string, alt: string) {
        super();
        this.url = url;
        this.alt = alt;
    }

    eq(other: ImageWidget) {
        return other.url === this.url && other.alt === this.alt;
    }

    toDOM() {
        const container = document.createElement('span');
        container.className = 'cm-md-image-preview';

        const img = document.createElement('img');
        img.src = this.url;
        img.alt = this.alt;
        img.style.maxHeight = '200px';
        img.style.maxWidth = '100%';
        img.style.display = 'inline-block';
        img.style.verticalAlign = 'middle';
        img.style.borderRadius = '4px';
        img.onerror = () => { img.style.display = 'none'; };

        container.appendChild(img);
        return container;
    }

    ignoreEvent() { return false; }
}

// Check if cursor is within a range
function isCursorInRange(selections: readonly SelectionRange[], from: number, to: number): boolean {
    return selections.some(sel =>
        (sel.from >= from && sel.from <= to) ||
        (sel.to >= from && sel.to <= to) ||
        (sel.from <= from && sel.to >= to)
    );
}

// Check if position is inside a code block (``` ... ```)
function isInsideCodeBlock(text: string, pos: number): boolean {
    const codeBlockRegex = /```[\s\S]*?```/g;
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (pos >= match.index && pos < match.index + match[0].length) {
            return true;
        }
    }
    return false;
}

// Check if a character is escaped (preceded by backslash)
function isEscaped(text: string, pos: number): boolean {
    let backslashes = 0;
    let i = pos - 1;
    while (i >= 0 && text[i] === '\\') {
        backslashes++;
        i--;
    }
    return backslashes % 2 === 1;
}

interface DecorationEntry {
    from: number;
    to: number;
    decoration: Decoration;
}

// Build all markdown decorations
function buildMarkdownDecorations(view: EditorView): DecorationSet {
    const decorations: DecorationEntry[] = [];
    const widgets: {pos: number, widget: Decoration}[] = [];
    const doc = view.state.doc;
    const text = doc.toString();
    const selections = view.state.selection.ranges;

    // Track ranges that have been decorated to avoid overlaps
    const decoratedRanges: {from: number, to: number}[] = [];

    const isRangeDecorated = (from: number, to: number): boolean => {
        return decoratedRanges.some(r =>
            (from >= r.from && from < r.to) ||
            (to > r.from && to <= r.to) ||
            (from <= r.from && to >= r.to)
        );
    };

    const markDecorated = (from: number, to: number) => {
        decoratedRanges.push({from, to});
    };

    // Process line-by-line for block elements and inline elements
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;
        const lineFrom = line.from;

        // Skip if line is inside a code block
        if (isInsideCodeBlock(text, lineFrom)) continue;

        // === BLOCK ELEMENTS ===

        // Headers: # to ######
        const headerMatch = lineText.match(/^(#{1,6})\s+(.+)$/);
        if (headerMatch) {
            const hashCount = headerMatch[1].length;
            const cursorInLine = isCursorInRange(selections, lineFrom, line.to);

            // Apply header styling to the line
            const headerDeco = hashCount === 1 ? mdH1 :
                              hashCount === 2 ? mdH2 :
                              hashCount === 3 ? mdH3 : mdH4;
            decorations.push({ from: lineFrom, to: lineFrom, decoration: headerDeco });

            // Hide hash marks when cursor is outside
            if (!cursorInLine) {
                const hashEnd = lineFrom + hashCount + 1; // +1 for space
                decorations.push({ from: lineFrom, to: hashEnd, decoration: mdHidden });
            }
            continue; // Don't process inline elements on header lines when hiding syntax
        }

        // Blockquote: > text
        const blockquoteMatch = lineText.match(/^>\s+(.+)$/);
        if (blockquoteMatch) {
            const cursorInLine = isCursorInRange(selections, lineFrom, line.to);
            decorations.push({ from: lineFrom, to: lineFrom, decoration: mdBlockquote });

            // Hide > when cursor is outside
            if (!cursorInLine) {
                decorations.push({ from: lineFrom, to: lineFrom + 2, decoration: mdHidden });
            }
            continue;
        }

        // Horizontal rule: --- or *** or ___
        if (/^(---|\*\*\*|___)$/.test(lineText.trim())) {
            const cursorInLine = isCursorInRange(selections, lineFrom, line.to);

            // Only show rendered line when cursor is outside, otherwise show raw syntax
            if (!cursorInLine) {
                decorations.push({ from: lineFrom, to: lineFrom, decoration: mdHr });
                decorations.push({ from: lineFrom, to: line.to, decoration: mdHidden });
            }
            continue;
        }

        // === INLINE ELEMENTS ===

        // Images: ![alt](url) - process before links
        const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
        let imageMatch;
        while ((imageMatch = imageRegex.exec(lineText)) !== null) {
            const matchStart = lineFrom + imageMatch.index;
            const matchEnd = matchStart + imageMatch[0].length;

            if (isEscaped(text, matchStart)) continue;
            if (isRangeDecorated(matchStart, matchEnd)) continue;

            const cursorInside = isCursorInRange(selections, matchStart, matchEnd);
            markDecorated(matchStart, matchEnd);

            if (!cursorInside) {
                // Hide syntax and show image
                decorations.push({ from: matchStart, to: matchEnd, decoration: mdHidden });
                widgets.push({
                    pos: matchStart,
                    widget: Decoration.widget({
                        widget: new ImageWidget(imageMatch[2], imageMatch[1]),
                        side: 1,
                    })
                });
            }
        }

        // Links: [text](url)
        const linkRegex = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(lineText)) !== null) {
            const matchStart = lineFrom + linkMatch.index;
            const matchEnd = matchStart + linkMatch[0].length;

            if (isEscaped(text, matchStart)) continue;
            if (isRangeDecorated(matchStart, matchEnd)) continue;

            const textStart = matchStart + 1;
            const textEnd = textStart + linkMatch[1].length;
            const cursorInside = isCursorInRange(selections, matchStart, matchEnd);
            markDecorated(matchStart, matchEnd);

            if (cursorInside) {
                decorations.push({ from: textStart, to: textEnd, decoration: mdLink });
            } else {
                decorations.push({ from: matchStart, to: textStart, decoration: mdHidden });
                decorations.push({ from: textStart, to: textEnd, decoration: mdLink });
                decorations.push({ from: textEnd, to: matchEnd, decoration: mdHidden });
            }
        }

        // Bold+Italic: ***text***
        const boldItalicRegex = /\*\*\*([^*]+)\*\*\*/g;
        let boldItalicMatch;
        while ((boldItalicMatch = boldItalicRegex.exec(lineText)) !== null) {
            const matchStart = lineFrom + boldItalicMatch.index;
            const matchEnd = matchStart + boldItalicMatch[0].length;

            if (isEscaped(text, matchStart)) continue;
            if (isRangeDecorated(matchStart, matchEnd)) continue;

            const contentStart = matchStart + 3;
            const contentEnd = matchEnd - 3;
            const cursorInside = isCursorInRange(selections, matchStart, matchEnd);
            markDecorated(matchStart, matchEnd);

            if (cursorInside) {
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdBoldItalic });
            } else {
                decorations.push({ from: matchStart, to: contentStart, decoration: mdHidden });
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdBoldItalic });
                decorations.push({ from: contentEnd, to: matchEnd, decoration: mdHidden });
            }
        }

        // Bold: **text** or __text__
        const boldRegex = /(\*\*|__)([^*_]+)\1/g;
        let boldMatch;
        while ((boldMatch = boldRegex.exec(lineText)) !== null) {
            const matchStart = lineFrom + boldMatch.index;
            const matchEnd = matchStart + boldMatch[0].length;

            if (isEscaped(text, matchStart)) continue;
            if (isRangeDecorated(matchStart, matchEnd)) continue;

            const contentStart = matchStart + 2;
            const contentEnd = matchEnd - 2;
            const cursorInside = isCursorInRange(selections, matchStart, matchEnd);
            markDecorated(matchStart, matchEnd);

            if (cursorInside) {
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdBold });
            } else {
                decorations.push({ from: matchStart, to: contentStart, decoration: mdHidden });
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdBold });
                decorations.push({ from: contentEnd, to: matchEnd, decoration: mdHidden });
            }
        }

        // Italic: *text* or _text_ (not preceded/followed by same char)
        const italicRegex = /(?<![*_])([*_])([^*_]+)\1(?![*_])/g;
        let italicMatch;
        while ((italicMatch = italicRegex.exec(lineText)) !== null) {
            const matchStart = lineFrom + italicMatch.index;
            const matchEnd = matchStart + italicMatch[0].length;

            if (isEscaped(text, matchStart)) continue;
            if (isRangeDecorated(matchStart, matchEnd)) continue;

            const contentStart = matchStart + 1;
            const contentEnd = matchEnd - 1;
            const cursorInside = isCursorInRange(selections, matchStart, matchEnd);
            markDecorated(matchStart, matchEnd);

            if (cursorInside) {
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdItalic });
            } else {
                decorations.push({ from: matchStart, to: contentStart, decoration: mdHidden });
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdItalic });
                decorations.push({ from: contentEnd, to: matchEnd, decoration: mdHidden });
            }
        }

        // Strikethrough: ~~text~~
        const strikeRegex = /~~([^~]+)~~/g;
        let strikeMatch;
        while ((strikeMatch = strikeRegex.exec(lineText)) !== null) {
            const matchStart = lineFrom + strikeMatch.index;
            const matchEnd = matchStart + strikeMatch[0].length;

            if (isEscaped(text, matchStart)) continue;
            if (isRangeDecorated(matchStart, matchEnd)) continue;

            const contentStart = matchStart + 2;
            const contentEnd = matchEnd - 2;
            const cursorInside = isCursorInRange(selections, matchStart, matchEnd);
            markDecorated(matchStart, matchEnd);

            if (cursorInside) {
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdStrikethrough });
            } else {
                decorations.push({ from: matchStart, to: contentStart, decoration: mdHidden });
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdStrikethrough });
                decorations.push({ from: contentEnd, to: matchEnd, decoration: mdHidden });
            }
        }

        // Inline code: `code`
        const codeRegex = /`([^`]+)`/g;
        let codeMatch;
        while ((codeMatch = codeRegex.exec(lineText)) !== null) {
            const matchStart = lineFrom + codeMatch.index;
            const matchEnd = matchStart + codeMatch[0].length;

            if (isEscaped(text, matchStart)) continue;
            if (isRangeDecorated(matchStart, matchEnd)) continue;

            const contentStart = matchStart + 1;
            const contentEnd = matchEnd - 1;
            const cursorInside = isCursorInRange(selections, matchStart, matchEnd);
            markDecorated(matchStart, matchEnd);

            if (cursorInside) {
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdCode });
            } else {
                decorations.push({ from: matchStart, to: contentStart, decoration: mdHidden });
                decorations.push({ from: contentStart, to: contentEnd, decoration: mdCode });
                decorations.push({ from: contentEnd, to: matchEnd, decoration: mdHidden });
            }
        }
    }

    // Combine mark decorations and widgets, sorted by position
    const allDecorations = [
        ...decorations.map(d => d.decoration.range(d.from, d.to)),
        ...widgets.map(w => w.widget.range(w.pos))
    ];

    // Sort by from position (required by CodeMirror)
    allDecorations.sort((a, b) => a.from - b.from);

    return Decoration.set(allDecorations, true);
}

const markdownPlugin = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;
        constructor(view: EditorView) {
            this.decorations = buildMarkdownDecorations(view);
        }
        update(update: ViewUpdate) {
            if (update.docChanged || update.viewportChanged || update.selectionSet) {
                this.decorations = buildMarkdownDecorations(update.view);
            }
        }
    },
    { decorations: (v) => v.decorations }
);

// CSS theme for all markdown elements
const markdownTheme = EditorView.baseTheme({
    // Hidden syntax
    '.cm-md-hidden': {
        display: 'none',
    },
    // Inline elements
    '.cm-md-bold': {
        fontWeight: 'bold',
    },
    '.cm-md-italic': {
        fontStyle: 'italic',
    },
    '.cm-md-strikethrough': {
        textDecoration: 'line-through',
        opacity: '0.7',
    },
    '.cm-md-code': {
        background: 'var(--ui-surface)',
        padding: '1px 4px',
        borderRadius: '3px',
        fontFamily: 'monospace',
    },
    '.cm-md-link': {
        color: '#3b82f6',
        textDecoration: 'underline',
        textDecorationColor: '#3b82f680',
        cursor: 'pointer',
    },
    // Image preview
    '.cm-md-image-preview': {
        display: 'inline-block',
        verticalAlign: 'middle',
    },
    '.cm-md-image-preview img': {
        maxHeight: '200px',
        maxWidth: '100%',
        borderRadius: '4px',
        border: '1px solid var(--ui-border)',
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

// Note: HTML5 drag and drop doesn't work properly in Tauri on macOS
// We use mouse-based drag instead (see useEffect in EditorWindow)
// Keeping this for potential future use or other platforms
const clipboardDropHandler = EditorView.domEventHandlers({
    drop(event, view) {
        const isClipboardItem = event.dataTransfer?.types.includes('application/x-clipboard-item-id');
        if (!isClipboardItem) return false;

        const droppedText = event.dataTransfer?.getData('text/plain');
        if (!droppedText) return false;

        event.preventDefault();
        event.stopPropagation();

        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        const insertPos = pos ?? view.state.selection.main.head;

        view.dispatch({
            changes: { from: insertPos, to: insertPos, insert: droppedText },
            selection: { anchor: insertPos + droppedText.length },
        });
        view.focus();
        return true;
    },
    dragover(event) {
        const isClipboardItem = event.dataTransfer?.types.includes('application/x-clipboard-item-id');
        if (isClipboardItem) {
            event.preventDefault();
            event.dataTransfer!.dropEffect = 'copy';
            return true;
        }
        return false;
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
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const aiPopoverRef = useRef<HTMLDivElement>(null);
    const languageDropdownRef = useRef<HTMLDivElement>(null);


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

    // Close language dropdown when clicking outside
    useEffect(() => {
        if (!showLanguageDropdown) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
                setShowLanguageDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showLanguageDropdown]);

    // Get drag store state and functions
    const {
        isDraggingClipboardItem,
        draggedContent,
        cursorPosition,
        editorInsertPosition,
        endDrag,
        updateCursorPosition,
        clearCursor,
    } = useDragStore();

    // Ref for the editor container to calculate relative positions
    const editorContainerRef = useRef<HTMLDivElement>(null);

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

    // Check if clipboard drag/drop is enabled (PRO feature - uses history feature gate)
    const hasClipboardDragDrop = isProFeatureEnabled('history');

    // Handle mouse-based drag over the editor (since HTML5 drag doesn't work in Tauri on macOS)
    useEffect(() => {
        if (!isDraggingClipboardItem || !hasClipboardDragDrop) return;

        const handleMouseMove = (e: MouseEvent) => {
            // Check if mouse is over the editor
            if (editorContainerRef.current && viewRef.current) {
                const rect = editorContainerRef.current.getBoundingClientRect();
                const isOverEditor = (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                );

                if (isOverEditor) {
                    // Get editor position from mouse coordinates
                    const pos = viewRef.current.posAtCoords({ x: e.clientX, y: e.clientY });
                    updateCursorPosition(e.clientX, e.clientY, pos ?? null);
                } else {
                    clearCursor();
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            // Check if drop is over the editor
            if (editorContainerRef.current && viewRef.current && draggedContent) {
                const rect = editorContainerRef.current.getBoundingClientRect();
                const isOverEditor = (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                );

                if (isOverEditor) {
                    const view = viewRef.current;
                    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
                    const insertPos = pos ?? view.state.selection.main.head;

                    view.dispatch({
                        changes: { from: insertPos, to: insertPos, insert: draggedContent },
                        selection: { anchor: insertPos + draggedContent.length },
                    });
                    view.focus();
                    endDrag();
                }
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingClipboardItem, hasClipboardDragDrop, draggedContent, updateCursorPosition, clearCursor, endDrag]);

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
    const handleAiRefineWithPreset = useCallback(async (preset: Parameters<typeof callAIWithPreset>[2]) => {
        if (aiLoading || !content.trim()) return;
        setAiError(null);
        setShowAiPopover(false);

        const licenseKey = localStorage.getItem('wingman_license_key');
        if (!licenseKey) {
            setAiError('License key not found');
            return;
        }

        const response = await callAIWithPreset(licenseKey, content, preset);
        if (response && response.result) {
            setContent(response.result);
        } else {
            setAiError('Failed to refine text');
        }
    }, [aiLoading, content, callAIWithPreset, setContent]);

    // Get enabled presets for the popover
    const enabledPresets = getEnabledPresets();

    // Load selected preset from localStorage on mount
    useEffect(() => {
        const savedPresetId = localStorage.getItem('wingman_selected_ai_preset');
        if (savedPresetId) {
            setSelectedPresetId(savedPresetId);
        }
    }, []);

    // Get the currently selected preset (or first enabled preset as default)
    const selectedPreset = enabledPresets.find(p => p.id === selectedPresetId) || enabledPresets[0] || null;

    // Handle selecting a preset as the default
    const handleSelectPreset = useCallback((presetId: string) => {
        setSelectedPresetId(presetId);
        localStorage.setItem('wingman_selected_ai_preset', presetId);
        setShowAiPopover(false);
    }, []);

    // Handle clicking the main AI button (triggers refinement with selected preset)
    const handleAiButtonClick = useCallback(async () => {
        if (!selectedPreset) {
            // No preset selected, show the popover to select one
            setShowAiPopover(true);
            return;
        }
        await handleAiRefineWithPreset(selectedPreset);
    }, [selectedPreset, handleAiRefineWithPreset]);

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
    const hasProEditorFeatures = isProFeatureEnabled('syntax_highlighting'); // PRO editor enhancements

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
        const hasFiles = e.dataTransfer.types.includes('Files');
        if (hasImageSupport && hasFiles) {
            setIsDragging(true);
        }
    }, [hasImageSupport]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const hasFiles = e.dataTransfer.types.includes('Files');
        if (hasImageSupport && hasFiles) {
            e.dataTransfer.dropEffect = 'copy';
            setIsDragging(true);
        }
    }, [hasImageSupport]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        // Handle file drops (PRO feature)
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

    // Update ref in effect to avoid refs-during-render lint error
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

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
            // Markdown styling and paste handling
            markdownLinkPasteHandler,
            markdownPlugin,
            markdownTheme,
            // Clipboard item drop handling
            clipboardDropHandler,
            ...getLanguageExtension(),
        ];

        // PRO Editor Features: bracket matching, auto-closing brackets, autocomplete
        if (hasProEditorFeatures) {
            extensions.push(
                bracketMatching(),
                closeBrackets(),
                keymap.of(closeBracketsKeymap),
                autocompletion({
                    activateOnTyping: true,
                    maxRenderedOptions: 10,
                })
            );

            // PRO Linting: Add language-specific linters
            if (language === 'json') {
                extensions.push(
                    lintGutter(),
                    linter(jsonLinter, { delay: 300 })
                );
            } else if (language === 'yaml') {
                extensions.push(
                    lintGutter(),
                    linter(yamlLinter, { delay: 300 })
                );
            }
        }

        // Add theme based on light/dark setting
        const lightThemes = ['light', 'solarized-light'];
        const isLightTheme = settings?.theme && lightThemes.includes(settings.theme);

        if (!isLightTheme) {
            // Dark themes use oneDark
            extensions.push(oneDark);
        }

        // Override background to transparent for native macOS vibrancy
        extensions.push(EditorView.theme({
            '&': { backgroundColor: 'transparent' },
            '.cm-scroller': { backgroundColor: 'transparent' },
            '.cm-content': { backgroundColor: 'transparent' },
            '.cm-gutters': { backgroundColor: 'transparent' },
        }));

        // Add light theme overrides for text visibility
        if (isLightTheme) {
            extensions.push(EditorView.theme({
                '.cm-content': { color: '#1a1a1a' },
                '.cm-gutters': { color: '#666666' },
                '.cm-cursor': { borderLeftColor: '#1a1a1a' },
                '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                '.cm-activeLineGutter': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
            }));
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
    // Note: editorKeymap and setEditorView are stable references, intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, settings?.theme, setContent, getLanguageExtension, hasProEditorFeatures]);

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
            <div className="border-b border-[var(--ui-border)] px-2 py-2 overflow-x-auto">
                <div className="flex items-center gap-0.5 min-w-max">
                    {/* Text Case Group */}
                    <button onClick={() => transformText('uppercase')} title="UPPERCASE" className="toolbar-btn">
                        {/* A with up arrow */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 18l4-12h2l4 12"/>
                            <path d="M5 14h6"/>
                            <path d="M18 4v8"/>
                            <path d="M15 7l3-3 3 3"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('lowercase')} title="lowercase" className="toolbar-btn">
                        {/* a with down arrow */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="7" cy="14" r="4"/>
                            <path d="M11 10v8"/>
                            <path d="M18 12v8"/>
                            <path d="M15 17l3 3 3-3"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('titlecase')} title="Title Case" className="toolbar-btn">
                        {/* T with underline */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 6h14"/>
                            <path d="M12 6v10"/>
                            <path d="M7 20h10"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('sentencecase')} title="Sentence case" className="toolbar-btn">
                        {/* Capital A with period - sentence starts with capital, ends with period */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 18l5-14h2l5 14"/>
                            <path d="M7 13h8"/>
                            <circle cx="20" cy="17" r="1.5" fill="currentColor"/>
                        </svg>
                    </button>
                    <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>

                    {/* Text Formatting Group */}
                    <button onClick={() => transformText('trim')} title="Trim Whitespace" className="toolbar-btn">
                        {/* Scissors */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="6" cy="6" r="3"/>
                            <circle cx="6" cy="18" r="3"/>
                            <path d="M8.12 8.12L12 12"/>
                            <path d="M20 4L8.12 15.88"/>
                            <path d="M14.47 14.48L20 20"/>
                            <path d="M8.12 8.12L12 12"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('sort')} title="Sort Lines A→Z" className="toolbar-btn">
                        {/* Bars ascending with arrow */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 6h4"/>
                            <path d="M4 12h7"/>
                            <path d="M4 18h11"/>
                            <path d="M18 6v12"/>
                            <path d="M15 15l3 3 3-3"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('deduplicate')} title="Remove Duplicate Lines" className="toolbar-btn">
                        {/* Two lines, one crossed out */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 8h16"/>
                            <path d="M4 14h16"/>
                            <path d="M3 18l18-12"/>
                        </svg>
                    </button>
                    <button onClick={() => transformText('reverse')} title="Reverse Lines" className="toolbar-btn">
                        {/* Vertical flip arrows */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 3l4 4-4 4"/>
                            <path d="M4 7h12"/>
                            <path d="M16 21l-4-4 4-4"/>
                            <path d="M20 17H8"/>
                        </svg>
                    </button>
                    <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>

                    {/* Lists Group */}
                    <button onClick={applyBulletList} title="Bulleted List" className="toolbar-btn">
                        {/* Lucide: list */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="8" y1="6" x2="21" y2="6"/>
                            <line x1="8" y1="12" x2="21" y2="12"/>
                            <line x1="8" y1="18" x2="21" y2="18"/>
                            <line x1="3" y1="6" x2="3.01" y2="6"/>
                            <line x1="3" y1="12" x2="3.01" y2="12"/>
                            <line x1="3" y1="18" x2="3.01" y2="18"/>
                        </svg>
                    </button>
                    <button onClick={applyNumberedList} title="Numbered List" className="toolbar-btn">
                        {/* Lucide: list-ordered */}
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="10" y1="6" x2="21" y2="6"/>
                            <line x1="10" y1="12" x2="21" y2="12"/>
                            <line x1="10" y1="18" x2="21" y2="18"/>
                            <path d="M4 6h1v4"/>
                            <path d="M4 10h2"/>
                            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Drag overlay for files */}
            {isDragging && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--ui-surface)]/90 border-2 border-dashed border-[var(--ui-accent)] rounded-lg">
                    <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2 text-[var(--ui-accent)]" fill="none"
                             stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <p className="text-sm text-[var(--ui-text)]">Drop to insert</p>
                    </div>
                </div>
            )}

            {/* Clipboard drag indicator - floating badge that follows cursor */}
            {isDraggingClipboardItem && hasClipboardDragDrop && cursorPosition && (
                <>
                    {/* Floating drag badge */}
                    <div
                        className="fixed z-[100] pointer-events-none"
                        style={{
                            left: cursorPosition.x + 16,
                            top: cursorPosition.y + 16,
                        }}
                    >
                        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--ui-accent)] text-white text-xs font-medium shadow-lg">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                            </svg>
                            <span>+</span>
                        </div>
                    </div>
                    {/* Insert cursor line - snapped to actual character position */}
                    {editorContainerRef.current && viewRef.current && editorInsertPosition !== null && (() => {
                        const rect = editorContainerRef.current!.getBoundingClientRect();
                        const isOverEditor = (
                            cursorPosition.x >= rect.left &&
                            cursorPosition.x <= rect.right &&
                            cursorPosition.y >= rect.top &&
                            cursorPosition.y <= rect.bottom
                        );
                        if (!isOverEditor) return null;

                        // Get the actual pixel coordinates of the character position
                        const coords = viewRef.current!.coordsAtPos(editorInsertPosition);
                        if (!coords) return null;

                        // Get the line height for proper cursor sizing
                        const lineHeight = viewRef.current!.defaultLineHeight;

                        return (
                            <div
                                className="fixed z-[100] pointer-events-none"
                                style={{
                                    left: coords.left,
                                    top: coords.top,
                                }}
                            >
                                <div
                                    className="bg-[var(--ui-accent)] animate-pulse"
                                    style={{
                                        width: '2px',
                                        height: `${lineHeight}px`,
                                    }}
                                />
                            </div>
                        );
                    })()}
                </>
            )}

            {/* AI Loading overlay */}
            {aiLoading && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--ui-surface)]/95 backdrop-blur-sm rounded-lg">
                    <div className="text-center">
                        <svg className="w-10 h-10 mx-auto mb-3 text-purple-400 animate-spin" fill="none"
                             viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                        </svg>
                        <p className="text-sm font-medium text-purple-300">Refining with AI...</p>
                        <p className="text-xs text-[var(--ui-text-muted)] mt-1">This may take a moment</p>
                    </div>
                </div>
            )}

            <div
                ref={(el) => {
                    editorRef.current = el;
                    editorContainerRef.current = el;
                }}
                className="flex-1 overflow-hidden editor-pane"
                style={{
                    fontFamily: settings?.font_family || 'monospace',
                    fontSize: `${settings?.font_size || 14}px`,
                }}
            />

            {/* Attachments */}
            {images.length > 0 && (
                <div className="border-t border-[var(--ui-border)] px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-[var(--ui-text-muted)]">Attachments:</span>
                        {images.map((attachment) => (
                            <div key={attachment.id} className="relative group">
                                {attachment.type === 'image' ? (
                                    // Image thumbnail
                                    <img
                                        src={attachment.data}
                                        alt={attachment.name}
                                        className="h-10 w-auto rounded border border-[var(--ui-border)] object-cover"
                                        title={`[image #${attachment.id}] - ${attachment.name}`}
                                    />
                                ) : (
                                    // File icon for non-images
                                    <div
                                        className="h-10 w-10 rounded border border-[var(--ui-border)] bg-[var(--ui-surface)] flex items-center justify-center"
                                        title={`[file #${attachment.id}] - ${attachment.name}`}
                                    >
                                        {attachment.type === 'text' ? (
                                            // Text file icon
                                            <svg className="w-5 h-5 text-[var(--ui-text-muted)]" fill="none"
                                                 stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                            </svg>
                                        ) : (
                                            // Generic file icon
                                            <svg className="w-5 h-5 text-[var(--ui-text-muted)]" fill="none"
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
                            className="mt-2 flex items-start gap-1.5 text-[10px] text-[var(--ui-text-muted)] opacity-70">
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
                <div className="border-t border-[var(--ui-border)]">
                    {/* Stats info row */}
                    <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--ui-text-muted)]">
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
                        <div className="relative" ref={languageDropdownRef}>
                            <button
                                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                                className="text-xs px-2 py-1 rounded-md hover:bg-[var(--ui-hover)] transition-colors"
                            >
                                {LANGUAGE_OPTIONS.find(l => l.value === language)?.label || 'Plain Text'}
                                {LANGUAGE_OPTIONS.find(l => l.value === language)?.isPro && (
                                    <span className="ml-1 text-[9px] text-[var(--ui-accent)]">PRO</span>
                                )}
                                <span className="ml-1 opacity-40">▾</span>
                            </button>
                            {showLanguageDropdown && (
                                <div
                                    className="absolute bottom-full mb-1 right-0 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-md shadow-lg z-50 min-w-[140px] max-h-[280px] overflow-y-auto py-1">
                                    {LANGUAGE_OPTIONS.map((lang) => {
                                        const isProLang = lang.isPro;
                                        const hasAccess = !isProLang || isProFeatureEnabled('syntax_highlighting');
                                        return (
                                            <button
                                                key={lang.value}
                                                onClick={() => {
                                                    if (hasAccess) {
                                                        setLanguage(lang.value);
                                                        setShowLanguageDropdown(false);
                                                    }
                                                }}
                                                disabled={!hasAccess}
                                                className={`w-full text-left text-xs px-3 py-1.5 flex items-center justify-between ${
                                                    hasAccess ? 'hover:bg-[var(--ui-hover)]' : 'opacity-50 cursor-not-allowed'
                                                } ${language === lang.value ? 'text-[var(--ui-accent)]' : ''}`}
                                            >
                                                <span>{lang.label}</span>
                                                {isProLang && (
                                                    <span className="text-[9px] text-[var(--ui-accent)] ml-2">PRO</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Action buttons - always visible */}
            <div className={`${settings?.show_status_bar !== false ? '' : 'border-t border-[var(--ui-border)]'} rounded-b-[10px]`}>
                {/* Action button row */}
                <div className="px-3 py-3 flex gap-2">
                        {/* AI Refine split button - green */}
                        <div className="relative flex" ref={aiPopoverRef}>
                            {/* Main button - triggers refinement with selected preset */}
                            <button
                                onClick={handleAiButtonClick}
                                disabled={!isPremium || !content.trim() || aiLoading}
                                title={selectedPreset ? `Refine with ${selectedPreset.name}` : "Refine text with AI"}
                                className="btn-ai flex items-center justify-center gap-1.5 pl-3 pr-2 py-2.5 rounded-l-md text-sm transition-colors disabled:opacity-40 border-r-0"
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
                                <span>{selectedPreset?.name || 'AI'}</span>
                            </button>
                            {/* Dropdown button - opens preset selector */}
                            <button
                                onClick={() => setShowAiPopover(!showAiPopover)}
                                disabled={!isPremium || aiLoading}
                                title="Select AI preset"
                                className="btn-ai flex items-center justify-center px-1.5 py-2.5 rounded-r-md text-sm transition-colors disabled:opacity-40"
                            >
                                <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                </svg>
                            </button>

                            {/* AI Presets Popover */}
                            {showAiPopover && (
                                <div className="absolute bottom-full mb-2 left-0 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-lg z-50 min-w-[220px] py-1 animate-fade-in">
                                    <div className="px-3 py-2 border-b border-[var(--ui-border)]">
                                        <p className="text-xs font-medium text-[var(--ui-text)]">Select Default Preset</p>
                                        <p className="text-[10px] text-[var(--ui-text-muted)]">Choose a preset for the AI button</p>
                                    </div>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {enabledPresets.map((preset) => (
                                            <button
                                                key={preset.id}
                                                onClick={() => handleSelectPreset(preset.id)}
                                                className={`w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors ${
                                                    selectedPreset?.id === preset.id ? 'bg-[var(--btn-ai-bg)]' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {selectedPreset?.id === preset.id && (
                                                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                                        </svg>
                                                    )}
                                                    <div className={selectedPreset?.id === preset.id ? '' : 'ml-5'}>
                                                        <p className="text-xs font-medium text-[var(--ui-text)]">{preset.name}</p>
                                                        <p className="text-[10px] text-[var(--ui-text-muted)]">{preset.description}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                    {enabledPresets.length === 0 && (
                                        <p className="px-3 py-2 text-xs text-[var(--ui-text-muted)]">No presets enabled. Configure in Settings.</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Obsidian button - purple/violet (Obsidian brand color) - Pro feature */}
                        <button
                            onClick={handleObsidianSend}
                            disabled={!hasObsidianAccess || !hasObsidianConfigured || !content.trim()}
                            title={!hasObsidianAccess ? "Pro feature - Send to Obsidian" : (!hasObsidianConfigured ? "Configure Obsidian vault in Settings first" : "Send to Obsidian")}
                            className="btn-obsidian flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm transition-colors disabled:opacity-40"
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
                            className="btn-primary flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md text-sm disabled:opacity-40 transition-colors"
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
