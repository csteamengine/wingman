import type {Detector} from './types';

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`[\]]+/;

function extractUrl(text: string): string | null {
    const match = text.match(URL_RE);
    return match ? match[0] : null;
}

function isValidUrl(text: string): boolean {
    const url = extractUrl(text);
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export const urlDetector: Detector = {
    id: 'url',
    priority: 6,
    detect: (text: string) => URL_RE.test(text) && isValidUrl(text),
    toastMessage: 'URL detected',
    getToastMessage: (text: string) => {
        const url = extractUrl(text);
        if (!url) return 'URL detected';
        try {
            const parsed = new URL(url);
            return `URL detected (${parsed.hostname})`;
        } catch {
            return 'URL detected';
        }
    },
    actions: [
        {
            id: 'parse-url',
            label: 'Parse',
            execute: (text: string) => {
                const urlStr = extractUrl(text);
                if (!urlStr) return text;

                try {
                    const url = new URL(urlStr);
                    const lines: string[] = [];

                    lines.push(`Protocol: ${url.protocol.replace(':', '')}`);
                    lines.push(`Host: ${url.hostname}`);
                    if (url.port) lines.push(`Port: ${url.port}`);
                    if (url.pathname && url.pathname !== '/') lines.push(`Path: ${url.pathname}`);
                    if (url.search) {
                        lines.push('Query Parameters:');
                        url.searchParams.forEach((value, key) => {
                            lines.push(`  - ${key}: ${decodeURIComponent(value)}`);
                        });
                    }
                    if (url.hash) lines.push(`Fragment: ${url.hash.slice(1)}`);
                    lines.push(`Full URL: ${url.href}`);

                    return lines.join('\n');
                } catch {
                    return text;
                }
            },
        },
        {
            id: 'decode-url',
            label: 'Decode',
            execute: (text: string) => {
                try {
                    return decodeURIComponent(text);
                } catch {
                    return text;
                }
            },
        },
        {
            id: 'encode-url',
            label: 'Encode',
            execute: (text: string) => {
                // Only encode the parts that need encoding, preserve URL structure
                const url = extractUrl(text);
                if (!url) return encodeURIComponent(text);

                try {
                    const parsed = new URL(url);
                    // Re-encode query parameters
                    const params = new URLSearchParams();
                    parsed.searchParams.forEach((value, key) => {
                        params.set(key, value);
                    });
                    parsed.search = params.toString();
                    return text.replace(url, parsed.href);
                } catch {
                    return encodeURIComponent(text);
                }
            },
        },
        {
            id: 'to-markdown-link',
            label: 'To Markdown',
            execute: (text: string) => {
                const url = extractUrl(text);
                if (!url) return text;

                try {
                    const parsed = new URL(url);
                    // Use hostname as default link text
                    const linkText = parsed.hostname;
                    return text.replace(url, `[${linkText}](${url})`);
                } catch {
                    return `[link](${url})`;
                }
            },
        },
    ],
};
