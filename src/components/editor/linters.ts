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
                const match = parseError.message.match(/at position (\d+)/);
                let pos = 0;
                if (match) {
                    pos = parseInt(match[1], 10);
                }
                pos = Math.min(pos, doc.length);

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
