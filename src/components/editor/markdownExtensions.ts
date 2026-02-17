import {EditorView, Decoration, ViewPlugin, WidgetType} from '@codemirror/view';
import type {DecorationSet, ViewUpdate} from '@codemirror/view';
import type {SelectionRange} from '@codemirror/state';

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
const mdListItem = Decoration.line({ class: 'cm-md-list-item' });

// Bullet widget that replaces `- ` or `* ` with a bullet dot
class BulletWidget extends WidgetType {
    indent: number;
    constructor(indent: number) {
        super();
        this.indent = indent;
    }
    eq(other: BulletWidget) { return other.indent === this.indent; }
    toDOM() {
        const span = document.createElement('span');
        span.className = 'cm-md-bullet';
        span.textContent = '•';
        return span;
    }
    ignoreEvent() { return false; }
}
// Zero-width space widget to maintain line height when fence text is replaced
class EmptyFenceWidget extends WidgetType {
    eq() { return true; }
    toDOM() {
        const span = document.createElement('span');
        span.textContent = '\u200B';
        return span;
    }
    ignoreEvent() { return false; }
}
// Code block line decorations - separate for first, middle, last to create unified block
const mdCodeBlockFirst = Decoration.line({ class: 'cm-md-codeblock cm-md-codeblock-first' });
const mdCodeBlockMiddle = Decoration.line({ class: 'cm-md-codeblock cm-md-codeblock-middle' });
const mdCodeBlockLast = Decoration.line({ class: 'cm-md-codeblock cm-md-codeblock-last' });

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

    // Track lines that are part of fenced code blocks (to skip in line processing)
    const codeBlockLines = new Set<number>();

    // === FENCED CODE BLOCKS ===
    // Process fenced code blocks first (``` ... ```)
    const codeBlockRegex = /^```(\w*)[ \t]*\n([\s\S]*?)^```[ \t]*$/gm;
    let codeBlockMatch;
    while ((codeBlockMatch = codeBlockRegex.exec(text)) !== null) {
        const blockStart = codeBlockMatch.index;
        const blockEnd = blockStart + codeBlockMatch[0].length;

        // Check if cursor is inside this code block (including the ``` lines)
        const cursorInside = isCursorInRange(selections, blockStart, blockEnd);

        // Find line numbers for the code block
        const startLine = doc.lineAt(blockStart);
        const endLine = doc.lineAt(blockEnd - 1);

        // Mark all lines in this block
        for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
            codeBlockLines.add(lineNum);
        }

        // Always style fence lines as part of the code block (top/bottom padding)
        decorations.push({ from: startLine.from, to: startLine.from, decoration: mdCodeBlockFirst });
        decorations.push({ from: endLine.from, to: endLine.from, decoration: mdCodeBlockLast });

        // All content lines get middle styling
        for (let lineNum = startLine.number + 1; lineNum <= endLine.number - 1; lineNum++) {
            const codeLine = doc.line(lineNum);
            decorations.push({ from: codeLine.from, to: codeLine.from, decoration: mdCodeBlockMiddle });
        }

        if (!cursorInside) {
            // Replace fence text with zero-width space to hide backticks/language
            // while keeping the line rendered with code block background
            if (startLine.from < startLine.to) {
                decorations.push({
                    from: startLine.from,
                    to: startLine.to,
                    decoration: Decoration.replace({ widget: new EmptyFenceWidget() }),
                });
            }
            if (endLine.from < endLine.to) {
                decorations.push({
                    from: endLine.from,
                    to: endLine.to,
                    decoration: Decoration.replace({ widget: new EmptyFenceWidget() }),
                });
            }
        }
    }

    // Process line-by-line for block elements and inline elements
    for (let i = 1; i <= doc.lines; i++) {
        const line = doc.line(i);
        const lineText = line.text;
        const lineFrom = line.from;

        // Skip if line is part of a fenced code block
        if (codeBlockLines.has(i)) continue;

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

        // Unordered list items: - item or * item (with optional indentation)
        const listMatch = lineText.match(/^(\s*)([-*])\s/);
        if (listMatch) {
            const cursorInLine = isCursorInRange(selections, lineFrom, line.to);
            const indentLen = listMatch[1].length;
            decorations.push({ from: lineFrom, to: lineFrom, decoration: mdListItem });

            if (!cursorInLine) {
                // Replace the raw `- ` / `* ` marker with a visual bullet.
                // Using a single replace decoration avoids mixed marker artifacts.
                const markerStart = lineFrom + indentLen;
                const markerEnd = markerStart + 2; // `- ` or `* `
                decorations.push({
                    from: markerStart,
                    to: markerEnd,
                    decoration: Decoration.replace({
                        widget: new BulletWidget(indentLen),
                    }),
                });
            }
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

export const markdownPlugin = ViewPlugin.fromClass(
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
export const markdownTheme = EditorView.baseTheme({
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
    // List items
    '.cm-md-list-item': {
        paddingLeft: '4px',
    },
    '.cm-md-bullet': {
        color: 'currentColor',
        opacity: '0.7',
        marginRight: '4px',
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

// CSS theme for code block backgrounds in markdown
export const codeBlockTheme = EditorView.baseTheme({
    // Style fenced code block content - CodeMirror uses these classes for code blocks
    '.cm-line .tok-meta': {
        color: '#6b7280',
    },
    // Code inside fenced blocks gets syntax highlighting from language-data
    '.cm-line .tok-keyword': {
        color: '#c678dd',
    },
    '.cm-line .tok-string': {
        color: '#98c379',
    },
    '.cm-line .tok-comment': {
        color: '#5c6370',
        fontStyle: 'italic',
    },
    '.cm-line .tok-number': {
        color: '#d19a66',
    },
    '.cm-line .tok-operator': {
        color: '#56b6c2',
    },
    '.cm-line .tok-variableName': {
        color: '#e06c75',
    },
    '.cm-line .tok-function': {
        color: '#61afef',
    },
    '.cm-line .tok-typeName': {
        color: '#e5c07b',
    },
});

// Helper to check if a string is a URL
export const isUrl = (str: string): boolean => {
    return /^https?:\/\/\S+$/.test(str.trim());
};

// Paste handler extension for markdown link creation
export const markdownLinkPasteHandler = EditorView.domEventHandlers({
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
export const clipboardDropHandler = EditorView.domEventHandlers({
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
