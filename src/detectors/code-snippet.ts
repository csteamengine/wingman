import type {Detector} from './types';

const CODE_PATTERNS = [
    /\bfunction\s+\w+\s*\(/,
    /\bclass\s+\w+/,
    /\bimport\s+.*\bfrom\b/,
    /\bconst\s+\w+\s*=/,
    /\bdef\s+\w+\s*\(/,
    /\bpub\s+fn\s+\w+/,
    /\bfunc\s+\w+/,
    /\bpackage\s+\w+/,
    /\b(?:public|private|protected)\s+(?:static\s+)?(?:void|int|string|boolean)\s+\w+/i,
    /=>\s*\{/,
];

function detectLanguage(text: string): string {
    if (/\bimport\s+.*\bfrom\b/.test(text) || /\bconst\s+\w+\s*=/.test(text) || /=>\s*\{/.test(text)) return 'typescript';
    if (/\bdef\s+\w+\s*\(/.test(text)) return 'python';
    if (/\bpub\s+fn\s+/.test(text) || /\blet\s+mut\s+/.test(text)) return 'rust';
    if (/\bfunc\s+\w+/.test(text) && /\bpackage\s+/.test(text)) return 'go';
    if (/\bpublic\s+(?:static\s+)?(?:void|int|String)\s+/.test(text)) return 'java';
    return 'code';
}

export const codeSnippetDetector: Detector = {
    id: 'code-snippet',
    priority: 17,
    detect: (text: string) => {
        const matches = CODE_PATTERNS.filter(p => p.test(text));
        return matches.length >= 1;
    },
    toastMessage: 'Code snippet detected',
    actions: [], // Dynamic actions provided by getActions
    getActions: (text: string) => {
        const lang = detectLanguage(text);
        return [
            {
                id: 'wrap-markdown',
                label: 'Wrap in Markdown',
                execute: (t: string) => `\`\`\`${lang}\n${t}\n\`\`\``,
            },
            {
                id: `switch-language:${lang}`,
                label: `Switch to ${lang.toUpperCase()}`,
                execute: (t: string) => t, // No-op, handler switches language based on ID
            },
        ];
    },
};
