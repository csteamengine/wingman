import {EditorView} from '@codemirror/view';
import type {Diagnostic} from '@codemirror/lint';

// JSON Linter - validates JSON syntax and reports errors
export function jsonLinter(view: EditorView): Diagnostic[] {
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
export function yamlLinter(view: EditorView): Diagnostic[] {
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
    }

    return diagnostics;
}
