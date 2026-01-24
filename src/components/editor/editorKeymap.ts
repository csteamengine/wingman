import { keymap } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

// Helper to wrap selected text with brackets/quotes
export function wrapSelection(view: EditorView, open: string, close: string): boolean {
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
}

// Editor keymaps: line operations, auto-list continuation, and bracket wrapping
export const editorKeymap = keymap.of([
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
    { key: '`', run: (view) => wrapSelection(view, '`', '`') },

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
                selection: { anchor: line.to + 1 + (state.selection.main.head - line.from) },
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
                        changes: { from: line.from, to: line.to, insert: '' },
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
                    selection: { anchor: state.selection.main.head + nextPrefix.length },
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
                        changes: { from: line.from, to: line.to, insert: '' },
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
                    selection: { anchor: state.selection.main.head + nextPrefix.length },
                });
                return true;
            }

            // Not a list line, let default Enter behavior handle it
            return false;
        },
    },
]);
