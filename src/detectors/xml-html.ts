import type {Detector} from './types';

// Matches XML/HTML tags - must have at least one properly closed tag
const XML_TAG_RE = /<([a-zA-Z][a-zA-Z0-9-]*)[^>]*>[\s\S]*?<\/\1>|<([a-zA-Z][a-zA-Z0-9-]*)[^>]*\/>/;
const HTML_DOCTYPE_RE = /<!DOCTYPE\s+html/i;

function isXmlOrHtml(text: string): boolean {
    const trimmed = text.trim();
    // Check for DOCTYPE
    if (HTML_DOCTYPE_RE.test(trimmed)) return true;
    // Check for XML declaration
    if (trimmed.startsWith('<?xml')) return true;
    // Check for at least one proper tag pair or self-closing tag
    return XML_TAG_RE.test(trimmed);
}

function detectMarkupType(text: string): 'html' | 'xml' {
    const trimmed = text.trim().toLowerCase();
    if (HTML_DOCTYPE_RE.test(text)) return 'html';
    if (trimmed.startsWith('<?xml')) return 'xml';
    // Check for common HTML tags
    const htmlTags = /<(?:html|head|body|div|span|p|a|img|script|style|link|meta|form|input|button)\b/i;
    if (htmlTags.test(text)) return 'html';
    return 'xml';
}

function formatXml(text: string, indentSize = 2): string {
    const trimmed = text.trim();
    let formatted = '';
    let indent = 0;
    const lines = trimmed
        .replace(/>\s*</g, '>\n<')
        .split('\n');

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // Decrease indent for closing tags
        if (trimmedLine.startsWith('</')) {
            indent = Math.max(0, indent - 1);
        }

        formatted += ' '.repeat(indent * indentSize) + trimmedLine + '\n';

        // Increase indent for opening tags (not self-closing or closing)
        if (
            trimmedLine.startsWith('<') &&
            !trimmedLine.startsWith('</') &&
            !trimmedLine.startsWith('<?') &&
            !trimmedLine.startsWith('<!') &&
            !trimmedLine.endsWith('/>') &&
            // Don't indent after tags that contain content on same line
            !/<[^>]+>[^<]+<\/[^>]+>/.test(trimmedLine)
        ) {
            indent++;
        }
    }

    return formatted.trim();
}

function minifyXml(text: string): string {
    return text
        .replace(/>\s+</g, '><')
        .replace(/\s+/g, ' ')
        .replace(/>\s+/g, '>')
        .replace(/\s+</g, '<')
        .trim();
}

function extractText(text: string): string {
    // Remove all tags and return just the text content
    return text
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function xmlToJson(text: string): string {
    // Simple XML to JSON conversion
    // This is a basic implementation - complex nested structures may need refinement
    const result: Record<string, unknown> = {};

    // Extract root element
    const rootMatch = text.match(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*>([\s\S]*)<\/\1>/);
    if (!rootMatch) {
        // Try to extract simple key-value pairs
        const tagPattern = /<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?>([^<]*)<\/\1>/g;
        let match: RegExpExecArray | null;
        while ((match = tagPattern.exec(text)) !== null) {
            const [, tagName, content] = match;
            result[tagName] = content.trim();
        }
        return JSON.stringify(result, null, 2);
    }

    function parseElement(xml: string): unknown {
        const obj: Record<string, unknown> = {};

        // Extract child elements
        const childPattern = /<([a-zA-Z][a-zA-Z0-9-]*)(?:\s[^>]*)?>([^<]*(?:<(?!\1)[^>]*>[^<]*<\/[^>]+>[^<]*)*)<\/\1>/g;
        let match: RegExpExecArray | null;
        const children: Array<{tag: string; content: string}> = [];

        while ((match = childPattern.exec(xml)) !== null) {
            children.push({tag: match[1], content: match[2]});
        }

        if (children.length === 0) {
            // No children, return text content
            const textContent = xml.replace(/<[^>]+>/g, '').trim();
            return textContent || null;
        }

        for (const child of children) {
            const hasNestedTags = /<[a-zA-Z]/.test(child.content);
            const value = hasNestedTags ? parseElement(child.content) : child.content.trim();

            if (obj[child.tag] !== undefined) {
                // Handle multiple elements with same name as array
                if (!Array.isArray(obj[child.tag])) {
                    obj[child.tag] = [obj[child.tag]];
                }
                (obj[child.tag] as unknown[]).push(value);
            } else {
                obj[child.tag] = value;
            }
        }

        return obj;
    }

    result[rootMatch[1]] = parseElement(rootMatch[2]);
    return JSON.stringify(result, null, 2);
}

export const xmlHtmlDetector: Detector = {
    id: 'xml-html',
    priority: 8,
    detect: isXmlOrHtml,
    toastMessage: 'XML/HTML detected',
    getToastMessage: (text: string) => {
        const type = detectMarkupType(text);
        return type === 'html' ? 'HTML detected' : 'XML detected';
    },
    getSuggestedLanguage: (text: string) => detectMarkupType(text),
    actions: [
        {
            id: 'format-xml',
            label: 'Format',
            execute: formatXml,
        },
        {
            id: 'minify-xml',
            label: 'Minify',
            execute: minifyXml,
        },
        {
            id: 'extract-text',
            label: 'Extract Text',
            execute: extractText,
        },
        {
            id: 'xml-to-json',
            label: 'To JSON',
            execute: xmlToJson,
        },
    ],
};
