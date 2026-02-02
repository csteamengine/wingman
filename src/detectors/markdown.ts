import type {Detector} from './types';

// Markdown detection patterns
const MARKDOWN_PATTERNS = [
    /^#{1,6}\s+\S/m,           // Headers: # Heading
    /^\s*[-*+]\s+\S/m,         // Unordered lists
    /^\s*\d+\.\s+\S/m,         // Ordered lists
    /\[.+?\]\(.+?\)/,          // Links: [text](url)
    /!\[.*?\]\(.+?\)/,         // Images: ![alt](url)
    /```[\s\S]*?```/,          // Fenced code blocks
    /^\s*>\s+\S/m,             // Blockquotes
    /\*\*[^*]+\*\*/,           // Bold: **text**
    /\*[^*]+\*/,               // Italic: *text*
    /__[^_]+__/,               // Bold: __text__
    /_[^_]+_/,                 // Italic: _text_
    /`[^`]+`/,                 // Inline code: `code`
    /^\s*[-*_]{3,}\s*$/m,      // Horizontal rules
    /^\s*\|.+\|/m,             // Tables
];

function isMarkdown(text: string): boolean {
    // Need at least 2 markdown patterns to be confident
    const matches = MARKDOWN_PATTERNS.filter(p => p.test(text));
    return matches.length >= 2;
}

function markdownToHtml(text: string): string {
    let html = text;

    // Escape HTML entities first
    html = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks (do this first to prevent other transformations inside code)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links and images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Blockquotes
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

    // Horizontal rules
    html = html.replace(/^\s*[-*_]{3,}\s*$/gm, '<hr>');

    // Unordered lists (simple single-level)
    html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');

    // Ordered lists (simple single-level)
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

    // Paragraphs (lines not already wrapped)
    const lines = html.split('\n');
    html = lines
        .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (trimmed.startsWith('<')) return line;
            return `<p>${line}</p>`;
        })
        .join('\n');

    return html;
}

function extractLinks(text: string): string {
    const links: string[] = [];

    // Extract markdown links
    const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(text)) !== null) {
        links.push(`${match[1]}: ${match[2]}`);
    }

    // Extract plain URLs
    const urlRe = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    while ((match = urlRe.exec(text)) !== null) {
        // Don't duplicate URLs already captured as markdown links
        if (!links.some(l => l.includes(match![0]))) {
            links.push(match[0]);
        }
    }

    if (links.length === 0) return 'No links found';
    return links.join('\n');
}

function stripFormatting(text: string): string {
    let result = text;

    // Remove code blocks
    result = result.replace(/```[\s\S]*?```/g, (match) => {
        // Extract just the code content
        const lines = match.split('\n');
        return lines.slice(1, -1).join('\n');
    });

    // Remove headers markers
    result = result.replace(/^#{1,6}\s+/gm, '');

    // Remove bold/italic markers
    result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
    result = result.replace(/__([^_]+)__/g, '$1');
    result = result.replace(/\*([^*]+)\*/g, '$1');
    result = result.replace(/_([^_]+)_/g, '$1');

    // Remove inline code markers
    result = result.replace(/`([^`]+)`/g, '$1');

    // Convert links to just text
    result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove image syntax
    result = result.replace(/!\[[^\]]*\]\([^)]+\)/g, '');

    // Remove blockquote markers
    result = result.replace(/^>\s+/gm, '');

    // Remove list markers
    result = result.replace(/^[-*+]\s+/gm, '');
    result = result.replace(/^\d+\.\s+/gm, '');

    // Remove horizontal rules
    result = result.replace(/^\s*[-*_]{3,}\s*$/gm, '');

    return result.trim();
}

function extractHeadings(text: string): string {
    const headings: string[] = [];
    const headerRe = /^(#{1,6})\s+(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = headerRe.exec(text)) !== null) {
        const level = match[1].length;
        const indent = '  '.repeat(level - 1);
        headings.push(`${indent}- ${match[2]}`);
    }

    if (headings.length === 0) return 'No headings found';
    return headings.join('\n');
}

export const markdownDetector: Detector = {
    id: 'markdown',
    priority: 16,
    detect: isMarkdown,
    toastMessage: 'Markdown detected',
    suggestedLanguage: 'markdown',
    actions: [
        {
            id: 'md-to-html',
            label: 'To HTML',
            execute: markdownToHtml,
        },
        {
            id: 'extract-links',
            label: 'Extract Links',
            execute: extractLinks,
        },
        {
            id: 'strip-formatting',
            label: 'Strip Formatting',
            execute: stripFormatting,
        },
        {
            id: 'extract-headings',
            label: 'TOC',
            execute: extractHeadings,
        },
    ],
};
