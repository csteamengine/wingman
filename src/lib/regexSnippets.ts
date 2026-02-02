export interface RegexSnippet {
  name: string;
  pattern: string;
  description: string;
  flags?: string;
}

export const REGEX_SNIPPETS: RegexSnippet[] = [
  {
    name: 'Email',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    description: 'Matches email addresses',
    flags: 'gi',
  },
  {
    name: 'URL',
    pattern: 'https?://[\\w.-]+(?:/[\\w./-]*)?(?:\\?[\\w&=.-]*)?',
    description: 'Matches HTTP/HTTPS URLs',
    flags: 'gi',
  },
  {
    name: 'Phone (US)',
    pattern: '\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}',
    description: 'Matches US phone numbers',
    flags: 'g',
  },
  {
    name: 'IPv4 Address',
    pattern: '\\b(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d{2}|[1-9]?\\d)){3}\\b',
    description: 'Matches IPv4 addresses',
    flags: 'g',
  },
  {
    name: 'Date (ISO)',
    pattern: '\\d{4}-\\d{2}-\\d{2}',
    description: 'Matches ISO format dates (YYYY-MM-DD)',
    flags: 'g',
  },
  {
    name: 'Date (MM/DD/YYYY)',
    pattern: '\\d{1,2}/\\d{1,2}/\\d{4}',
    description: 'Matches US format dates',
    flags: 'g',
  },
  {
    name: 'Time (24h)',
    pattern: '\\b([01]?\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?\\b',
    description: 'Matches 24-hour time format',
    flags: 'g',
  },
  {
    name: 'Hex Color',
    pattern: '#(?:[0-9A-Fa-f]{3}){1,2}\\b',
    description: 'Matches hex color codes',
    flags: 'gi',
  },
  {
    name: 'UUID',
    pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    description: 'Matches UUIDs',
    flags: 'gi',
  },
  {
    name: 'HTML Tag',
    pattern: '<([a-z][a-z0-9]*)\\b[^>]*>.*?</\\1>|<[a-z][a-z0-9]*\\b[^>]*/?>',
    description: 'Matches HTML tags',
    flags: 'gis',
  },
  {
    name: 'Credit Card',
    pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b',
    description: 'Matches credit card numbers',
    flags: 'g',
  },
  {
    name: 'Markdown Link',
    pattern: '\\[([^\\]]+)\\]\\(([^)]+)\\)',
    description: 'Matches Markdown links [text](url)',
    flags: 'g',
  },
  {
    name: 'Quoted String',
    pattern: '"[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|\'[^\'\\\\]*(?:\\\\.[^\'\\\\]*)*\'',
    description: 'Matches single or double quoted strings',
    flags: 'g',
  },
  {
    name: 'Word Boundary',
    pattern: '\\b\\w+\\b',
    description: 'Matches whole words',
    flags: 'g',
  },
  {
    name: 'Whitespace',
    pattern: '\\s+',
    description: 'Matches whitespace sequences',
    flags: 'g',
  },
  {
    name: 'Number',
    pattern: '-?\\d+(?:\\.\\d+)?',
    description: 'Matches integers and decimals',
    flags: 'g',
  },
];
