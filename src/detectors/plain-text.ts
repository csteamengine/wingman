import type {Detector, DetectorAction} from './types';

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

// All available actions
const allActions: DetectorAction[] = [
    { id: 'word-count', label: 'Word Count', execute: wordCount },
    { id: 'uppercase', label: 'UPPER', execute: toUpperCase },
    { id: 'lowercase', label: 'lower', execute: toLowerCase },
    { id: 'titlecase', label: 'Title', execute: toTitleCase },
    { id: 'sentencecase', label: 'Sentence', execute: toSentenceCase },
    { id: 'sort-lines', label: 'Sort A-Z', execute: sortLines },
    { id: 'sort-lines-reverse', label: 'Sort Z-A', execute: sortLinesReverse },
    { id: 'dedupe-lines', label: 'Dedupe', execute: dedupeLines },
    { id: 'reverse-lines', label: 'Reverse', execute: reverseLines },
    { id: 'trim-lines', label: 'Trim', execute: trimLines },
    { id: 'remove-empty', label: 'No Empty', execute: removeEmptyLines },
    { id: 'shuffle-lines', label: 'Shuffle', execute: shuffleLines },
    { id: 'number-lines', label: 'Number', execute: numberLines },
];

// Max actions to show in the floating bar
const MAX_ACTIONS = 5;

/**
 * Intelligently select the most relevant actions based on content characteristics
 */
function getRelevantActions(text: string): DetectorAction[] {
    const lines = text.split('\n');
    const lineCount = lines.length;
    const hasMultipleLines = lineCount > 1;
    const hasDuplicateLines = new Set(lines).size < lines.length;
    const hasEmptyLines = lines.some(l => l.trim() === '');
    const hasLeadingTrailingWhitespace = lines.some(l => l !== l.trim());
    const isAllUppercase = text === text.toUpperCase() && /[a-zA-Z]/.test(text);
    const isAllLowercase = text === text.toLowerCase() && /[a-zA-Z]/.test(text);

    const actions: DetectorAction[] = [];

    // Case transformations - suggest based on current case
    if (isAllUppercase) {
        actions.push(allActions.find(a => a.id === 'lowercase')!);
        actions.push(allActions.find(a => a.id === 'titlecase')!);
    } else if (isAllLowercase) {
        actions.push(allActions.find(a => a.id === 'uppercase')!);
        actions.push(allActions.find(a => a.id === 'titlecase')!);
    } else {
        // Mixed case - offer title case
        actions.push(allActions.find(a => a.id === 'titlecase')!);
    }

    // Line-based actions only for multi-line content
    if (hasMultipleLines) {
        // Prioritize based on content characteristics
        if (hasDuplicateLines) {
            actions.push(allActions.find(a => a.id === 'dedupe-lines')!);
        }
        if (hasEmptyLines) {
            actions.push(allActions.find(a => a.id === 'remove-empty')!);
        }
        if (hasLeadingTrailingWhitespace) {
            actions.push(allActions.find(a => a.id === 'trim-lines')!);
        }
        // Sort is generally useful for lists
        if (lineCount >= 3) {
            actions.push(allActions.find(a => a.id === 'sort-lines')!);
        }
    }

    // If we have very few relevant actions, add some general-purpose ones
    if (actions.length < 3) {
        const generalActions = ['word-count', 'uppercase', 'lowercase'];
        for (const id of generalActions) {
            if (!actions.find(a => a.id === id) && actions.length < MAX_ACTIONS) {
                actions.push(allActions.find(a => a.id === id)!);
            }
        }
    }

    // Limit to max actions
    return actions.slice(0, MAX_ACTIONS);
}

export const plainTextDetector: Detector = {
    id: 'plain-text',
    priority: 99,
    detect: () => true, // Always matches as fallback
    toastMessage: 'Plain text',
    actions: [], // Not used - we use getActions instead
    getActions: getRelevantActions,
};
