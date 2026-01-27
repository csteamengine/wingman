import type {Detector} from './types';

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

function getJsonError(text: string): string {
    try {
        JSON.parse(text.trim());
        return 'Valid JSON';
    } catch (e) {
        return e instanceof SyntaxError ? e.message : String(e);
    }
}

function isYaml(text: string): boolean {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    const yamlPattern = /^[a-zA-Z_][a-zA-Z0-9_]*:\s*.+/;
    const matchCount = lines.filter(l => yamlPattern.test(l.trim())).length;
    return matchCount >= 2;
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
    actions: [
        {
            id: 'format-json',
            label: 'Format',
            execute: (text: string) => {
                const trimmed = text.trim();
                if (isValidJson(trimmed)) {
                    return JSON.stringify(JSON.parse(trimmed), null, 2);
                }
                return text;
            },
        },
        {
            id: 'minify-json',
            label: 'Minify',
            execute: (text: string) => {
                const trimmed = text.trim();
                if (isValidJson(trimmed)) {
                    return JSON.stringify(JSON.parse(trimmed));
                }
                return text;
            },
        },
        {
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
        },
        {
            id: 'validate-json',
            label: 'Validate',
            execute: (text: string) => {
                const trimmed = text.trim();
                if (looksLikeJson(trimmed)) {
                    const error = getJsonError(trimmed);
                    if (error === 'Valid JSON') {
                        return `// ✓ Valid JSON\n${text}`;
                    }
                    return `// ✗ Invalid JSON: ${error}\n${text}`;
                }
                return text;
            },
        },
    ],
};
