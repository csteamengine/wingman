import type {Detector} from './types';

function wordCount(text: string): string {
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const lines = text.split('\n').length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;

    return [
        `Words: ${words.length}`,
        `Characters: ${chars}`,
        `Characters (no spaces): ${charsNoSpaces}`,
        `Lines: ${lines}`,
        `Sentences: ${sentences}`,
        `Paragraphs: ${paragraphs}`,
    ].join('\n');
}

function toUpperCase(text: string): string {
    return text.toUpperCase();
}

function toLowerCase(text: string): string {
    return text.toLowerCase();
}

function toTitleCase(text: string): string {
    return text.replace(/\b\w/g, char => char.toUpperCase());
}

function toSentenceCase(text: string): string {
    return text.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, char => char.toUpperCase());
}

function sortLines(text: string): string {
    const lines = text.split('\n');
    lines.sort((a, b) => a.localeCompare(b));
    return lines.join('\n');
}

function sortLinesReverse(text: string): string {
    const lines = text.split('\n');
    lines.sort((a, b) => b.localeCompare(a));
    return lines.join('\n');
}

function dedupeLines(text: string): string {
    const lines = text.split('\n');
    const seen = new Set<string>();
    const result: string[] = [];

    for (const line of lines) {
        if (!seen.has(line)) {
            seen.add(line);
            result.push(line);
        }
    }

    return result.join('\n');
}

function reverseLines(text: string): string {
    return text.split('\n').reverse().join('\n');
}

function trimLines(text: string): string {
    return text.split('\n').map(line => line.trim()).join('\n');
}

function removeEmptyLines(text: string): string {
    return text.split('\n').filter(line => line.trim().length > 0).join('\n');
}

function shuffleLines(text: string): string {
    const lines = text.split('\n');
    // Fisher-Yates shuffle
    for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[j]] = [lines[j], lines[i]];
    }
    return lines.join('\n');
}

function numberLines(text: string): string {
    const lines = text.split('\n');
    const padding = String(lines.length).length;
    return lines.map((line, i) => `${String(i + 1).padStart(padding, ' ')}. ${line}`).join('\n');
}

export const plainTextDetector: Detector = {
    id: 'plain-text',
    priority: 99,
    detect: () => true, // Always matches as fallback
    toastMessage: 'Plain text',
    actions: [
        {
            id: 'word-count',
            label: 'Word Count',
            execute: wordCount,
        },
        {
            id: 'uppercase',
            label: 'UPPER',
            execute: toUpperCase,
        },
        {
            id: 'lowercase',
            label: 'lower',
            execute: toLowerCase,
        },
        {
            id: 'titlecase',
            label: 'Title',
            execute: toTitleCase,
        },
        {
            id: 'sentencecase',
            label: 'Sentence',
            execute: toSentenceCase,
        },
        {
            id: 'sort-lines',
            label: 'Sort A-Z',
            execute: sortLines,
        },
        {
            id: 'sort-lines-reverse',
            label: 'Sort Z-A',
            execute: sortLinesReverse,
        },
        {
            id: 'dedupe-lines',
            label: 'Dedupe',
            execute: dedupeLines,
        },
        {
            id: 'reverse-lines',
            label: 'Reverse',
            execute: reverseLines,
        },
        {
            id: 'trim-lines',
            label: 'Trim',
            execute: trimLines,
        },
        {
            id: 'remove-empty',
            label: 'No Empty',
            execute: removeEmptyLines,
        },
        {
            id: 'shuffle-lines',
            label: 'Shuffle',
            execute: shuffleLines,
        },
        {
            id: 'number-lines',
            label: 'Number',
            execute: numberLines,
        },
    ],
};
