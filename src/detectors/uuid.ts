import type {Detector} from './types';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export const uuidDetector: Detector = {
    id: 'uuid',
    priority: 3,
    detect: (text: string) => UUID_RE.test(text),
    toastMessage: 'UUID detected',
    actions: [
        {
            id: 'normalize-uuid',
            label: 'Lowercase',
            execute: (text: string) =>
                text.replace(new RegExp(UUID_RE.source, 'gi'), m => m.toLowerCase()),
        },
        {
            id: 'uppercase-uuid',
            label: 'Uppercase',
            execute: (text: string) =>
                text.replace(new RegExp(UUID_RE.source, 'gi'), m => m.toUpperCase()),
        },
        {
            id: 'strip-hyphens',
            label: 'Strip Hyphens',
            execute: (text: string) =>
                text.replace(new RegExp(UUID_RE.source, 'gi'), m => m.replace(/-/g, '')),
        },
    ],
};
