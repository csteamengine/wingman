import type {Detector} from './types';

const CSS_PATTERNS = [
    /^\s*[.#][a-zA-Z][\w-]*\s*\{/m, // .class { or #id {
    /^\s*@media\b/m,
    /^\s*@import\b/m,
    /^\s*@keyframes\b/m,
    /^\s*@font-face\b/m,
    /:\s*\d+(?:px|rem|em|vh|vw|%)\s*;/,
    /\b(?:margin|padding|display|color|background|font-size|border|width|height)\s*:/,
];

export const cssDetector: Detector = {
    id: 'css',
    priority: 3,
    detect: (text: string) => {
        const matches = CSS_PATTERNS.filter(p => p.test(text));
        // Need at least 2 CSS-like patterns to be confident
        return matches.length >= 2;
    },
    toastMessage: 'CSS detected',
    suggestedLanguage: 'css',
    actions: [
        {
            id: 'sort-css-properties',
            label: 'Sort Properties',
            execute: (text: string) => {
                // Sort CSS properties within each rule block
                return text.replace(
                    /\{([^}]+)\}/g,
                    (_match, block: string) => {
                        const lines = block.split('\n')
                            .map(l => l.trim())
                            .filter(l => l && l.includes(':'));
                        const nonPropLines = block.split('\n')
                            .map(l => l.trim())
                            .filter(l => l && !l.includes(':'));
                        lines.sort((a, b) => a.localeCompare(b));
                        const sorted = [...nonPropLines, ...lines]
                            .map(l => `    ${l}`)
                            .join('\n');
                        return `{\n${sorted}\n}`;
                    }
                );
            },
        },
    ],
};
