import type {Detector} from './types';

const BASE64_RE = /^[A-Za-z0-9+/]{20,}={0,2}$/m;

function tryDecode(text: string): string | null {
    const match = text.match(BASE64_RE);
    if (!match) return null;
    try {
        return atob(match[0]);
    } catch {
        return null;
    }
}

export const base64Detector: Detector = {
    id: 'base64',
    priority: 8,
    detect: (text: string) => {
        if (!BASE64_RE.test(text)) return false;
        return tryDecode(text) !== null;
    },
    toastMessage: 'Base64 content detected',
    actions: [
        {
            id: 'decode-base64',
            label: 'Decode',
            execute: (text: string) => {
                return text.replace(
                    new RegExp(BASE64_RE.source, 'gm'),
                    (match) => {
                        try {
                            return atob(match);
                        } catch {
                            return match;
                        }
                    }
                );
            },
        },
        {
            id: 'encode-base64',
            label: 'Encode',
            execute: (text: string) => btoa(text),
        },
        {
            id: 'decode-pretty-json',
            label: 'Decode + Format JSON',
            execute: (text: string) => {
                return text.replace(
                    new RegExp(BASE64_RE.source, 'gm'),
                    (match) => {
                        try {
                            const decoded = atob(match);
                            const parsed = JSON.parse(decoded);
                            return JSON.stringify(parsed, null, 2);
                        } catch {
                            try {
                                return atob(match);
                            } catch {
                                return match;
                            }
                        }
                    }
                );
            },
        },
    ],
};
