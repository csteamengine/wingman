import type {Detector} from './types';

const SQL_RE = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE)\b/i;

function formatSql(text: string): string {
    const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
        'INNER JOIN', 'OUTER JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
        'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE',
        'ALTER TABLE', 'DROP TABLE', 'UNION', 'UNION ALL'];

    let result = text.trim();
    // Uppercase keywords
    for (const kw of keywords) {
        const re = new RegExp(`\\b${kw}\\b`, 'gi');
        result = result.replace(re, kw);
    }
    // Add newlines before major keywords
    const majorKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
        'INNER JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'UNION', 'VALUES', 'SET'];
    for (const kw of majorKeywords) {
        const re = new RegExp(`\\s+${kw}\\b`, 'g');
        result = result.replace(re, `\n${kw}`);
    }
    // Indent non-major lines
    const lines = result.split('\n');
    return lines.map((line, i) => {
        if (i === 0) return line;
        const trimmed = line.trim();
        const isMajor = majorKeywords.some(kw => trimmed.startsWith(kw));
        return isMajor ? trimmed : `  ${trimmed}`;
    }).join('\n');
}

export const sqlDetector: Detector = {
    id: 'sql',
    priority: 7,
    detect: (text: string) => SQL_RE.test(text),
    toastMessage: 'SQL query detected',
    suggestedLanguage: 'sql',
    actions: [
        {
            id: 'format-sql',
            label: 'Format',
            execute: formatSql,
        },
        {
            id: 'minify-sql',
            label: 'Minify',
            execute: (text: string) => text.replace(/\s+/g, ' ').trim(),
        },
        {
            id: 'uppercase-keywords',
            label: 'Uppercase Keywords',
            execute: (text: string) => {
                const keywords = ['select', 'from', 'where', 'and', 'or', 'join', 'on',
                    'group by', 'order by', 'having', 'limit', 'insert into', 'values',
                    'update', 'set', 'delete from', 'create table', 'alter table', 'drop table',
                    'left join', 'right join', 'inner join', 'outer join', 'union', 'as',
                    'in', 'not', 'null', 'is', 'between', 'like', 'exists', 'distinct', 'case',
                    'when', 'then', 'else', 'end', 'asc', 'desc'];
                let result = text;
                for (const kw of keywords) {
                    const re = new RegExp(`\\b${kw}\\b`, 'gi');
                    result = result.replace(re, kw.toUpperCase());
                }
                return result;
            },
        },
    ],
};
