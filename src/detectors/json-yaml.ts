import type {Detector} from './types';

function isJson(text: string): boolean {
    const trimmed = text.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
            JSON.parse(trimmed);
            return true;
        } catch {
            return false;
        }
    }
    return false;
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
    detect: (text: string) => isJson(text) || isYaml(text),
    toastMessage: 'JSON/YAML detected',
    actions: [
        {
            id: 'format-json',
            label: 'Format',
            execute: (text: string) => {
                const trimmed = text.trim();
                if (isJson(trimmed)) {
                    try {
                        return JSON.stringify(JSON.parse(trimmed), null, 2);
                    } catch {
                        return text;
                    }
                }
                return text;
            },
        },
        {
            id: 'minify-json',
            label: 'Minify',
            execute: (text: string) => {
                const trimmed = text.trim();
                if (isJson(trimmed)) {
                    try {
                        return JSON.stringify(JSON.parse(trimmed));
                    } catch {
                        return text;
                    }
                }
                return text;
            },
        },
        {
            id: 'sort-keys',
            label: 'Sort Keys',
            execute: (text: string) => {
                const trimmed = text.trim();
                if (isJson(trimmed)) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        return JSON.stringify(sortJsonKeys(parsed), null, 2);
                    } catch {
                        return text;
                    }
                }
                return text;
            },
        },
    ],
};
