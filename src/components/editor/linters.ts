import {EditorView} from '@codemirror/view';
import type {Diagnostic} from '@codemirror/lint';
import {invoke} from '@tauri-apps/api/core';

interface JsonValidationResult {
    valid: boolean;
    error_message?: string;
    error_line?: number;
    error_column?: number;
    error_position?: number;
}

interface XmlValidationResult {
    valid: boolean;
    error_message?: string;
    error_line?: number;
    error_column?: number;
    error_position?: number;
}

interface PythonValidationResult {
    valid: boolean;
    error_message?: string;
    error_line?: number;
    error_column?: number;
    error_position?: number;
}

interface HtmlValidationResult {
    valid: boolean;
    error_message?: string;
    error_line?: number;
    error_column?: number;
    error_position?: number;
}

// Find the character position where JSON parsing fails.
// Works on all JS engines (V8, JSC, SpiderMonkey) by trying to extract
// position from the error message, then falling back to a binary search.
function findJsonErrorPosition(doc: string, errorMessage: string): number {
    // V8: "at position N"
    const posMatch = errorMessage.match(/at position (\d+)/);
    if (posMatch) return Math.min(parseInt(posMatch[1], 10), doc.length);

    // SpiderMonkey: "at line L column C"
    const lineColMatch = errorMessage.match(/at line (\d+) column (\d+)/);
    if (lineColMatch) {
        const targetLine = parseInt(lineColMatch[1], 10);
        const targetCol = parseInt(lineColMatch[2], 10);
        let line = 1;
        for (let i = 0; i < doc.length; i++) {
            if (line === targetLine) return Math.min(i + targetCol - 1, doc.length);
            if (doc[i] === '\n') line++;
        }
    }

    // JSC/WebKit gives no position info — binary search by line to find the
    // first line whose prefix causes a different parse error or still fails.
    const lines = doc.split('\n');
    let lo = 0;
    let hi = lines.length - 1;

    // Check if a prefix up to (and including) line index `idx` parses without error
    const parsesOk = (idx: number): boolean => {
        // Build a prefix and try to close any open structures to see if
        // the error is before or after this point.
        const prefix = lines.slice(0, idx + 1).join('\n');
        // Try parsing the prefix — if it fails with "end of input" style error,
        // the actual syntax error hasn't been reached yet
        try {
            JSON.parse(prefix);
            return true;
        } catch (e) {
            if (e instanceof SyntaxError) {
                const msg = e.message.toLowerCase();
                // These indicate truncation, not a real syntax error in the prefix
                if (msg.includes('end of') || msg.includes('unexpected end') ||
                    msg.includes('unterminated') || msg.includes('eof')) {
                    return true; // error is past this point
                }
            }
            return false;
        }
    };

    // Binary search for the first line that has a real error
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (parsesOk(mid)) {
            lo = mid + 1;
        } else {
            hi = mid;
        }
    }

    // `lo` is the line index with the error — return start of that line
    let offset = 0;
    for (let i = 0; i < lo && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for \n
    }
    return Math.min(offset, doc.length);
}

// JSON Linter - validates JSON syntax and reports errors using Rust backend
export async function jsonLinter(view: EditorView): Promise<Diagnostic[]> {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    try {
        const result = await invoke<JsonValidationResult>('validate_json', { text: doc });

        if (result.valid) {
            return [];
        }

        if (result.error_position !== undefined) {
            const pos = Math.min(result.error_position, doc.length);
            const endPos = Math.min(pos + 1, doc.length);

            return [{
                from: pos,
                to: endPos,
                severity: 'error',
                message: result.error_message || 'Invalid JSON',
            }];
        }

        return [];
    } catch (e) {
        // Fallback to browser JSON.parse if backend fails
        try {
            JSON.parse(doc);
            return [];
        } catch (parseError) {
            if (parseError instanceof SyntaxError) {
                const pos = findJsonErrorPosition(doc, parseError.message);

                return [{
                    from: pos,
                    to: Math.min(pos + 1, doc.length),
                    severity: 'error',
                    message: parseError.message,
                }];
            }
            return [];
        }
    }
}

// XML Linter - validates XML syntax and reports errors using Rust backend
export async function xmlLinter(view: EditorView): Promise<Diagnostic[]> {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    try {
        const result = await invoke<XmlValidationResult>('validate_xml', { text: doc });

        if (result.valid) {
            return [];
        }

        if (result.error_position !== undefined) {
            const pos = Math.min(result.error_position, doc.length);
            const endPos = Math.min(pos + 1, doc.length);

            return [{
                from: pos,
                to: endPos,
                severity: 'error',
                message: result.error_message || 'Invalid XML',
            }];
        }

        return [];
    } catch (e) {
        // If backend fails, return no diagnostics
        return [];
    }
}

// Python Linter - validates Python syntax using Rust backend
export async function pythonLinter(view: EditorView): Promise<Diagnostic[]> {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    try {
        const result = await invoke<PythonValidationResult>('validate_python', { text: doc });

        if (result.valid) {
            return [];
        }

        if (result.error_position !== undefined) {
            const pos = Math.min(result.error_position, doc.length);
            const endPos = Math.min(pos + 1, doc.length);

            return [{
                from: pos,
                to: endPos,
                severity: 'error',
                message: result.error_message || 'Invalid Python syntax',
            }];
        }

        return [];
    } catch (e) {
        return [];
    }
}

// HTML Linter - validates HTML structure using Rust backend
export async function htmlLinter(view: EditorView): Promise<Diagnostic[]> {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    try {
        const result = await invoke<HtmlValidationResult>('validate_html', { text: doc });

        if (result.valid) {
            return [];
        }

        if (result.error_position !== undefined) {
            const pos = Math.min(result.error_position, doc.length);
            const endPos = Math.min(pos + 1, doc.length);

            return [{
                from: pos,
                to: endPos,
                severity: 'error',
                message: result.error_message || 'Invalid HTML',
            }];
        }

        return [];
    } catch (e) {
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
