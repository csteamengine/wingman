import type {Detector} from './types';

const UNIX_PATH_RE = /(?:^|\s)(\/(?:[\w.-]+\/)+[\w.-]+)/m;
const WIN_PATH_RE = /(?:^|\s)([A-Z]:\\(?:[\w.-]+\\)+[\w.-]+)/mi;

export const filePathDetector: Detector = {
    id: 'file-path',
    priority: 11,
    detect: (text: string) => UNIX_PATH_RE.test(text) || WIN_PATH_RE.test(text),
    toastMessage: 'File paths detected',
    actions: [
        {
            id: 'to-unix-slashes',
            label: 'Unix Slashes',
            execute: (text: string) => text.replace(/\\/g, '/'),
        },
        {
            id: 'to-windows-slashes',
            label: 'Windows Slashes',
            execute: (text: string) => text.replace(/\//g, '\\'),
        },
        {
            id: 'extract-filenames',
            label: 'Extract Filenames',
            execute: (text: string) => {
                const paths: string[] = [];
                let match: RegExpExecArray | null;
                const unixRe = new RegExp(UNIX_PATH_RE.source, 'gm');
                while ((match = unixRe.exec(text)) !== null) {
                    const parts = match[1].split('/');
                    paths.push(parts[parts.length - 1]);
                }
                const winRe = new RegExp(WIN_PATH_RE.source, 'gmi');
                while ((match = winRe.exec(text)) !== null) {
                    const parts = match[1].split('\\');
                    paths.push(parts[parts.length - 1]);
                }
                return paths.length > 0 ? paths.join('\n') : text;
            },
        },
    ],
};
