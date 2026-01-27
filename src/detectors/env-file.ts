import type {Detector} from './types';
import {maskSecrets} from '../utils/maskSecrets';

const ENV_LINE_RE = /^[A-Z_][A-Z0-9_]*=.+/m;

export const envFileDetector: Detector = {
    id: 'env-file',
    priority: 4,
    detect: (text: string) => {
        const lines = text.trim().split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
        const envLines = lines.filter(l => ENV_LINE_RE.test(l));
        return envLines.length >= 2 && envLines.length / lines.length > 0.5;
    },
    toastMessage: '.env file detected',
    actions: [
        {
            id: 'sort-env-keys',
            label: 'Sort Keys',
            execute: (text: string) => {
                const lines = text.trim().split('\n');
                const comments: string[] = [];
                const entries: string[] = [];
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
        },
        {
            id: 'mask-env-secrets',
            label: 'Mask Values',
            execute: (text: string) => maskSecrets(text),
        },
        {
            id: 'env-to-json',
            label: 'To JSON',
            execute: (text: string) => {
                const obj: Record<string, string> = {};
                for (const line of text.trim().split('\n')) {
                    const trimmed = line.trim();
                    if (!trimmed || trimmed.startsWith('#')) continue;
                    const eqIdx = trimmed.indexOf('=');
                    if (eqIdx > 0) {
                        const key = trimmed.slice(0, eqIdx);
                        let value = trimmed.slice(eqIdx + 1);
                        // Strip surrounding quotes
                        if ((value.startsWith('"') && value.endsWith('"')) ||
                            (value.startsWith("'") && value.endsWith("'"))) {
                            value = value.slice(1, -1);
                        }
                        obj[key] = value;
                    }
                }
                return JSON.stringify(obj, null, 2);
            },
        },
    ],
};
