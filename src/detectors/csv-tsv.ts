import type {Detector} from './types';

function detectDelimiter(text: string): string | null {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (lines.length < 3) return null;

    for (const delim of [',', '\t', '|', ';']) {
        const counts = lines.slice(0, 5).map(l => l.split(delim).length);
        if (counts[0] > 1 && counts.every(c => c === counts[0])) {
            return delim;
        }
    }
    return null;
}

function parseCsv(text: string, delim: string): string[][] {
    return text.trim().split('\n').map(line => line.split(delim).map(c => c.trim()));
}

export const csvTsvDetector: Detector = {
    id: 'csv-tsv',
    priority: 9,
    detect: (text: string) => detectDelimiter(text) !== null,
    toastMessage: 'CSV/TSV data detected',
    actions: [
        {
            id: 'csv-to-json',
            label: 'To JSON',
            execute: (text: string) => {
                const delim = detectDelimiter(text);
                if (!delim) return text;
                const rows = parseCsv(text, delim);
                if (rows.length < 2) return text;
                const headers = rows[0];
                const data = rows.slice(1).map(row => {
                    const obj: Record<string, string> = {};
                    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
                    return obj;
                });
                return JSON.stringify(data, null, 2);
            },
        },
        {
            id: 'csv-pretty-table',
            label: 'Pretty Table',
            execute: (text: string) => {
                const delim = detectDelimiter(text);
                if (!delim) return text;
                const rows = parseCsv(text, delim);
                if (rows.length === 0) return text;
                const colWidths = rows[0].map((_, i) =>
                    Math.max(...rows.map(r => (r[i] || '').length))
                );
                return rows.map((row, ri) => {
                    const line = row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ');
                    if (ri === 0) {
                        const sep = colWidths.map(w => '-'.repeat(w)).join('-+-');
                        return `${line}\n${sep}`;
                    }
                    return line;
                }).join('\n');
            },
        },
        {
            id: 'csv-dedup',
            label: 'Dedup Rows',
            execute: (text: string) => {
                const lines = text.trim().split('\n');
                const seen = new Set<string>();
                const result: string[] = [];
                for (const line of lines) {
                    if (!seen.has(line)) {
                        seen.add(line);
                        result.push(line);
                    }
                }
                return result.join('\n');
            },
        },
    ],
};
