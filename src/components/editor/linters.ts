import {EditorView} from '@codemirror/view';
import type {Diagnostic} from '@codemirror/lint';
import {parse as parseJsonc, printParseErrorCode, type ParseError} from 'jsonc-parser';
import {DOMParser as XMLDOMParser} from '@xmldom/xmldom';
import YAML from 'yaml';
import {parser as pythonParser} from '@lezer/python';
import {Parser as HTMLParser} from 'htmlparser2';

// JSON Linter - uses jsonc-parser for accurate error positions across all JS engines
export function jsonLinter(view: EditorView): Diagnostic[] {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    const errors: ParseError[] = [];
    parseJsonc(doc, errors, { disallowComments: true, allowTrailingComma: false });

    return errors.map(error => {
        const from = Math.min(error.offset, doc.length);
        const to = Math.min(error.offset + Math.max(error.length, 1), doc.length);

        return {
            from,
            to,
            severity: 'error' as const,
            message: printParseErrorCode(error.error),
        };
    });
}

// XML Linter - uses @xmldom/xmldom for accurate error positions
export function xmlLinter(view: EditorView): Diagnostic[] {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    const diagnostics: Diagnostic[] = [];

    const parser = new XMLDOMParser({
        errorHandler: {
            warning: () => { /* ignore warnings */ },
            error: (msg: string) => {
                const diagnostic = parseXmlError(doc, msg);
                if (diagnostic) diagnostics.push(diagnostic);
            },
            fatalError: (msg: string) => {
                const diagnostic = parseXmlError(doc, msg);
                if (diagnostic) diagnostics.push(diagnostic);
            },
        },
    });

    try {
        parser.parseFromString(doc, 'text/xml');
    } catch {
        // Parser errors are handled by errorHandler
    }

    return diagnostics;
}

// Helper to parse XML error messages and extract position
function parseXmlError(doc: string, msg: string): Diagnostic | null {
    // xmldom errors often contain line:column info like "[xmldom error] ... @line:col"
    // or "element parse error: ... @2:15"
    const lineColMatch = msg.match(/@(\d+):(\d+)/);
    if (lineColMatch) {
        const line = parseInt(lineColMatch[1], 10);
        const col = parseInt(lineColMatch[2], 10);
        const pos = lineColToOffset(doc, line, col);
        return {
            from: pos,
            to: Math.min(pos + 1, doc.length),
            severity: 'error',
            message: msg.replace(/@\d+:\d+/, '').trim(),
        };
    }

    // Fallback: try to find line number in message
    const lineMatch = msg.match(/line[:\s]+(\d+)/i);
    if (lineMatch) {
        const line = parseInt(lineMatch[1], 10);
        const pos = lineColToOffset(doc, line, 1);
        return {
            from: pos,
            to: Math.min(pos + 1, doc.length),
            severity: 'error',
            message: msg,
        };
    }

    // No position info - report at start
    return {
        from: 0,
        to: 1,
        severity: 'error',
        message: msg,
    };
}

// Convert line:column to character offset
function lineColToOffset(doc: string, line: number, col: number): number {
    const lines = doc.split('\n');
    let offset = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) {
        offset += lines[i].length + 1; // +1 for \n
    }
    return Math.min(offset + col - 1, doc.length);
}

// Python Linter - uses @lezer/python for accurate syntax error detection
export function pythonLinter(view: EditorView): Diagnostic[] {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    const diagnostics: Diagnostic[] = [];
    const tree = pythonParser.parse(doc);

    // Traverse the tree looking for error nodes
    tree.iterate({
        enter: (node) => {
            if (node.type.isError) {
                diagnostics.push({
                    from: node.from,
                    to: Math.max(node.to, node.from + 1),
                    severity: 'error',
                    message: 'Syntax error',
                });
            }
        },
    });

    return diagnostics;
}

// HTML Linter - uses htmlparser2 for error detection
export function htmlLinter(view: EditorView): Diagnostic[] {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    const diagnostics: Diagnostic[] = [];
    const tagStack: Array<{name: string, pos: number}> = [];

    // Track positions as we parse
    const currentIndex = 0;

    const parser = new HTMLParser({
        onopentag: (name) => {
            // Find this tag in the document from current position
            const tagPattern = new RegExp(`<${name}[\\s>/]`, 'i');
            const searchStr = doc.slice(currentIndex);
            const match = tagPattern.exec(searchStr);
            const pos = match ? currentIndex + match.index : currentIndex;

            // Self-closing tags and void elements don't need closing
            const voidElements = ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'];
            if (!voidElements.includes(name.toLowerCase())) {
                tagStack.push({ name: name.toLowerCase(), pos });
            }
        },
        onclosetag: (name) => {
            const lowerName = name.toLowerCase();

            // Find the matching open tag
            let found = false;
            for (let i = tagStack.length - 1; i >= 0; i--) {
                if (tagStack[i].name === lowerName) {
                    tagStack.splice(i, 1);
                    found = true;
                    break;
                }
            }

            if (!found) {
                // Find the closing tag position
                const closePattern = new RegExp(`</${name}>`, 'i');
                const searchStr = doc.slice(currentIndex);
                const match = closePattern.exec(searchStr);
                const pos = match ? currentIndex + match.index : currentIndex;

                diagnostics.push({
                    from: pos,
                    to: Math.min(pos + name.length + 3, doc.length),
                    severity: 'error',
                    message: `Unexpected closing tag </${name}>`,
                });
            }
        },
        onend: () => {
            // Any remaining unclosed tags
            for (const tag of tagStack) {
                diagnostics.push({
                    from: tag.pos,
                    to: Math.min(tag.pos + tag.name.length + 1, doc.length),
                    severity: 'error',
                    message: `Unclosed tag <${tag.name}>`,
                });
            }
        },
        onerror: (error) => {
            diagnostics.push({
                from: 0,
                to: 1,
                severity: 'error',
                message: error.message,
            });
        },
    }, {
        decodeEntities: true,
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        recognizeSelfClosing: true,
    });

    parser.write(doc);
    parser.end();

    return diagnostics;
}

// YAML Linter - uses yaml library for accurate error positions
export function yamlLinter(view: EditorView): Diagnostic[] {
    const doc = view.state.doc.toString();
    if (!doc.trim()) return [];

    const diagnostics: Diagnostic[] = [];

    try {
        // Parse with detailed error info
        YAML.parse(doc, {
            prettyErrors: true,
            strict: true,
        });
    } catch (e) {
        if (e instanceof YAML.YAMLParseError) {
            // YAMLParseError has linePos with line and col
            const pos = e.linePos?.[0];
            if (pos) {
                const offset = lineColToOffset(doc, pos.line, pos.col);
                diagnostics.push({
                    from: offset,
                    to: Math.min(offset + 1, doc.length),
                    severity: 'error',
                    message: e.message.split('\n')[0], // First line of error
                });
            } else {
                diagnostics.push({
                    from: 0,
                    to: 1,
                    severity: 'error',
                    message: e.message,
                });
            }
        }
    }

    // Also check for tabs (YAML should use spaces)
    const text = view.state.doc;
    for (let i = 1; i <= text.lines; i++) {
        const line = text.line(i);
        const lineText = line.text;

        if (lineText.includes('\t')) {
            const tabPos = lineText.indexOf('\t');
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
