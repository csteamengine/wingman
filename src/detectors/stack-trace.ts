import type {Detector} from './types';

const STACK_PATTERNS = [
    /^\s+at\s+/m,
    /Traceback \(most recent call last\)/,
    /^\w+Error:/m,
    /^\w+Exception:/m,
    /Exception in thread/,
    /panic:/,
    /goroutine \d+/,
];

export const stackTraceDetector: Detector = {
    id: 'stack-trace',
    priority: 11,
    detect: (text: string) => {
        const matches = STACK_PATTERNS.filter(p => p.test(text));
        return matches.length >= 1 && text.split('\n').length >= 3;
    },
    toastMessage: 'Stack trace detected',
    actions: [
        {
            id: 'extract-error',
            label: 'Extract Error',
            execute: (text: string) => {
                const lines = text.split('\n');
                const errorLines = lines.filter(l =>
                    /(?:Error|Exception|panic|FATAL|FAILED)[:]/i.test(l)
                );
                return errorLines.length > 0 ? errorLines.join('\n') : text;
            },
        },
        {
            id: 'collapse-frames',
            label: 'Collapse Frames',
            execute: (text: string) => {
                const lines = text.split('\n');
                const result: string[] = [];
                let frameCount = 0;
                for (const line of lines) {
                    if (/^\s+at\s+/.test(line) || /^\s+File\s+"/.test(line)) {
                        frameCount++;
                        if (frameCount <= 3) {
                            result.push(line);
                        } else if (frameCount === 4) {
                            result.push(`    ... (more frames collapsed)`);
                        }
                    } else {
                        frameCount = 0;
                        result.push(line);
                    }
                }
                return result.join('\n');
            },
        },
        {
            id: 'github-issue',
            label: 'Issue Template',
            execute: (text: string) => {
                const lines = text.split('\n');
                const errorLine = lines.find(l =>
                    /(?:Error|Exception|panic|FATAL)[:]/i.test(l)
                ) || lines[0];
                return `## Bug Report\n\n**Error:**\n${errorLine}\n\n**Stack Trace:**\n\`\`\`\n${text}\n\`\`\`\n\n**Steps to Reproduce:**\n1. \n\n**Expected Behavior:**\n\n`;
            },
        },
    ],
};
