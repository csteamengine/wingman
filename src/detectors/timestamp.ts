import type {Detector} from './types';

const EPOCH_RE = /\b(\d{10}|\d{13})\b/;
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function epochToDate(s: string): Date {
    const n = parseInt(s, 10);
    return new Date(s.length === 13 ? n : n * 1000);
}

function relativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const absDiff = Math.abs(diffMs);
    const prefix = diffMs < 0 ? 'in ' : '';
    const suffix = diffMs >= 0 ? ' ago' : '';

    if (absDiff < 60000) return `${prefix}${Math.round(absDiff / 1000)}s${suffix}`;
    if (absDiff < 3600000) return `${prefix}${Math.round(absDiff / 60000)}m${suffix}`;
    if (absDiff < 86400000) return `${prefix}${Math.round(absDiff / 3600000)}h${suffix}`;
    return `${prefix}${Math.round(absDiff / 86400000)}d${suffix}`;
}

export const timestampDetector: Detector = {
    id: 'timestamp',
    priority: 15,
    detect: (text: string) => {
        if (ISO_RE.test(text)) return true;
        const match = text.match(EPOCH_RE);
        if (!match) return false;
        const date = epochToDate(match[1]);
        const year = date.getFullYear();
        return year >= 2000 && year <= 2100;
    },
    toastMessage: 'Timestamp detected',
    actions: [
        {
            id: 'to-local',
            label: 'To Local',
            execute: (text: string) => {
                let result = text.replace(
                    new RegExp(EPOCH_RE.source, 'g'),
                    (match) => {
                        const date = epochToDate(match);
                        const year = date.getFullYear();
                        if (year < 2000 || year > 2100) return match;
                        return date.toLocaleString();
                    }
                );
                result = result.replace(
                    new RegExp(ISO_RE.source, 'g'),
                    (match) => {
                        try {
                            return new Date(match).toLocaleString();
                        } catch {
                            return match;
                        }
                    }
                );
                return result;
            },
        },
        {
            id: 'to-utc',
            label: 'To UTC',
            execute: (text: string) => {
                let result = text.replace(
                    new RegExp(EPOCH_RE.source, 'g'),
                    (match) => {
                        const date = epochToDate(match);
                        const year = date.getFullYear();
                        if (year < 2000 || year > 2100) return match;
                        return date.toISOString();
                    }
                );
                result = result.replace(
                    new RegExp(ISO_RE.source, 'g'),
                    (match) => {
                        try {
                            return new Date(match).toISOString();
                        } catch {
                            return match;
                        }
                    }
                );
                return result;
            },
        },
        {
            id: 'relative-time',
            label: 'Relative',
            execute: (text: string) => {
                let result = text.replace(
                    new RegExp(EPOCH_RE.source, 'g'),
                    (match) => {
                        const date = epochToDate(match);
                        const year = date.getFullYear();
                        if (year < 2000 || year > 2100) return match;
                        return `${match} (${relativeTime(date)})`;
                    }
                );
                result = result.replace(
                    new RegExp(ISO_RE.source, 'g'),
                    (match) => {
                        try {
                            return `${match} (${relativeTime(new Date(match))})`;
                        } catch {
                            return match;
                        }
                    }
                );
                return result;
            },
        },
    ],
};
