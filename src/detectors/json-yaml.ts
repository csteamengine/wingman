import type {Detector, DetectorAction, DetectorActionResult} from './types';

function isValidJson(text: string): boolean {
    const trimmed = text.trim();
    if (!looksLikeJson(trimmed)) return false;
    try {
        JSON.parse(trimmed);
        return true;
    } catch {
        return false;
    }
}

function looksLikeJson(text: string): boolean {
    const trimmed = text.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
           (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function looksLikeInvalidJson(text: string): boolean {
    const trimmed = text.trim();
    if (!looksLikeJson(trimmed)) return false;
    try {
        JSON.parse(trimmed);
        return false; // it's valid, not invalid
    } catch {
        return true;
    }
}

function getJsonError(text: string): { message: string; line?: number; column?: number } {
    try {
        JSON.parse(text.trim());
        return { message: 'Valid JSON' };
    } catch (e) {
        const msg = e instanceof SyntaxError ? e.message : String(e);
        // Try to extract position from "at position N"
        const posMatch = msg.match(/at position (\d+)/);
        if (posMatch) {
            const pos = parseInt(posMatch[1], 10);
            const lines = text.trim().substring(0, pos).split('\n');
            const line = lines.length;
            const column = (lines[lines.length - 1]?.length ?? 0) + 1;
            return { message: msg, line, column };
        }
        // Try "at line N column N"
        const lineMatch = msg.match(/line (\d+) column (\d+)/);
        if (lineMatch) {
            return { message: msg, line: parseInt(lineMatch[1], 10), column: parseInt(lineMatch[2], 10) };
        }
        return { message: msg };
    }
}

function isYaml(text: string): boolean {
    const lines = text.trim().split('\n');
    if (lines.length < 3) return false;
    const yamlPattern = /^[a-zA-Z_][a-zA-Z0-9_-]*:\s*.+/;
    const nonYamlPatterns = [
        /^\s*[{}]/, // CSS/JS blocks
        /;\s*$/, // CSS/C-style line endings
        /^\s*\.[a-zA-Z]/, // CSS class selectors
        /^\s*#[a-zA-Z]/, // CSS ID selectors
        /^\s*@/, // CSS at-rules
        /\{[^}]*\}/, // inline braces (CSS rules)
        /^\s*\/[/*]/, // JS/CSS comments
        /^\s*import\s/, // JS imports
        /^\s*export\s/, // JS exports
        /^\s*function\s/, // JS functions
        /^\s*const\s/, // JS const
        /^\s*let\s/, // JS let
        /^\s*var\s/, // JS var
    ];
    // If many lines match non-YAML patterns, it's not YAML
    const nonYamlCount = lines.filter(l => nonYamlPatterns.some(p => p.test(l))).length;
    if (nonYamlCount > lines.length * 0.2) return false;
    const yamlLines = lines.filter(l => {
        const trimmed = l.trim();
        return trimmed && !trimmed.startsWith('#') && yamlPattern.test(trimmed);
    });
    // Need a good ratio of YAML-like lines
    const nonEmptyLines = lines.filter(l => l.trim() && !l.trim().startsWith('#'));
    return yamlLines.length >= 3 && yamlLines.length / nonEmptyLines.length > 0.5;
}

function sortJsonKeys(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(sortJsonKeys);
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj as Record<string, unknown>)
            .sort()
            .reduce<Record<string, unknown>>((acc, key) => {
                acc[key] = sortJsonKeys((obj as Record<string, unknown>)[key]);
                return acc;
            }, {});
    }
    return obj;
}

const jsonFormatAction: DetectorAction = {
    id: 'format-json',
    label: 'Format',
    execute: (text: string) => {
        const trimmed = text.trim();
        if (isValidJson(trimmed)) {
            return JSON.stringify(JSON.parse(trimmed), null, 2);
        }
        return text;
    },
};

const jsonMinifyAction: DetectorAction = {
    id: 'minify-json',
    label: 'Minify',
    execute: (text: string) => {
        const trimmed = text.trim();
        if (isValidJson(trimmed)) {
            return JSON.stringify(JSON.parse(trimmed));
        }
        return text;
    },
};

const jsonSortKeysAction: DetectorAction = {
    id: 'sort-keys',
    label: 'Sort Keys',
    execute: (text: string) => {
        const trimmed = text.trim();
        if (isValidJson(trimmed)) {
            const parsed = JSON.parse(trimmed);
            return JSON.stringify(sortJsonKeys(parsed), null, 2);
        }
        return text;
    },
};

const jsonValidateAction: DetectorAction = {
    id: 'validate-json',
    label: 'Validate',
    execute: (text: string): string | DetectorActionResult => {
        const trimmed = text.trim();
        if (looksLikeJson(trimmed)) {
            const error = getJsonError(trimmed);
            if (error.message === 'Valid JSON') {
                return {
                    text,
                    validationMessage: 'Valid JSON',
                    validationType: 'success',
                };
            }
            return {
                text,
                validationMessage: error.message,
                validationType: 'error',
                errorLine: error.line,
                errorColumn: error.column,
            };
        }
        return text;
    },
};

const yamlSortKeysAction: DetectorAction = {
    id: 'sort-yaml-keys',
    label: 'Sort Keys',
    execute: (text: string) => {
        const lines = text.split('\n');
        const entries: string[] = [];
        const comments: string[] = [];
        for (const line of lines) {
            if (line.trim().startsWith('#') || !line.trim()) {
                comments.push(line);
            } else {
                entries.push(line);
            }
        }
        entries.sort((a, b) => a.localeCompare(b));
        return [...comments, ...entries].join('\n');
    },
};

export const jsonYamlDetector: Detector = {
    id: 'json-yaml',
    priority: 2,
    detect: (text: string) => isValidJson(text) || looksLikeInvalidJson(text) || isYaml(text),
    toastMessage: 'JSON/YAML detected',
    getToastMessage: (text: string) => {
        if (looksLikeInvalidJson(text)) return 'Invalid JSON detected';
        if (isValidJson(text)) return 'JSON detected';
        return 'YAML detected';
    },
    getSuggestedLanguage: (text: string) => {
        if (isValidJson(text) || looksLikeInvalidJson(text)) return 'json';
        if (isYaml(text)) return 'yaml';
        return undefined;
    },
    actions: [], // use getActions instead
    getActions: (text: string) => {
        if (isYaml(text)) {
            return [yamlSortKeysAction];
        }
        if (looksLikeInvalidJson(text)) {
            return [jsonValidateAction];
        }
        return [jsonFormatAction, jsonMinifyAction, jsonSortKeysAction, jsonValidateAction];
    },
};
