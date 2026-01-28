import * as prettier from 'prettier';
import { format as formatSQL } from 'sql-formatter';

// Map language names to Prettier parsers
const languageToParser: Record<string, string> = {
  javascript: 'babel',
  typescript: 'typescript',
  react: 'babel',
  html: 'html',
  css: 'css',
  json: 'json',
  markdown: 'markdown',
  yaml: 'yaml',
  xml: 'html', // Prettier uses HTML parser for XML-like content
};

// Languages that need special handling or external tools
const externalFormatterLanguages = [
  'python',
  'go',
  'rust',
  'java',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'csharp',
  'bash',
  'c',
  'cpp',
];

export async function formatCode(text: string, language: string): Promise<string> {
  // Handle SQL separately with sql-formatter
  if (language === 'sql') {
    try {
      return formatSQL(text, { language: 'sql' });
    } catch {
      return text;
    }
  }

  // Check if this language needs external formatter
  if (externalFormatterLanguages.includes(language)) {
    // Fall back to Tauri command for languages needing native tools
    const { invoke } = await import('@tauri-apps/api/core');
    try {
      return await invoke<string>('format_code', { text, language });
    } catch (error) {
      // If native formatter fails, return original text
      console.warn(`Native formatter failed for ${language}:`, error);
      return text;
    }
  }

  // Use Prettier for supported languages
  const parser = languageToParser[language];
  if (!parser) {
    return text;
  }

  // Detect TypeScript in React files
  let actualParser = parser;
  if (language === 'react') {
    const isTypeScript = detectTypeScript(text);
    actualParser = isTypeScript ? 'typescript' : 'babel';
  }

  try {
    const formatted = await prettier.format(text, {
      parser: actualParser,
      printWidth: 100,
      tabWidth: 2,
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
    });
    return formatted;
  } catch (error) {
    console.warn(`Prettier formatting failed for ${language}:`, error);
    return text;
  }
}

export async function minifyCode(text: string, language: string): Promise<string> {
  // Handle JSON minification natively
  if (language === 'json') {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed);
    } catch {
      return text;
    }
  }

  // Handle CSS minification
  if (language === 'css') {
    return minifyCSS(text);
  }

  // Handle HTML minification
  if (language === 'html') {
    return minifyHTML(text);
  }

  // Handle XML minification
  if (language === 'xml') {
    return minifyXML(text);
  }

  // Handle JavaScript/TypeScript/React minification
  if (['javascript', 'typescript', 'react'].includes(language)) {
    return minifyJS(text, language);
  }

  return text;
}

function detectTypeScript(text: string): boolean {
  return text.includes(': ') && (
    text.includes('interface ') ||
    text.includes('type ') ||
    text.includes('enum ') ||
    text.includes('<FC<') ||
    text.includes('React.FC<') ||
    text.includes('React.Component<') ||
    text.includes('FunctionComponent<') ||
    text.includes(': FC<')
  );
}

function removeJSComments(text: string): string {
  const chars = text.split('');
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = ' ';

  while (i < chars.length) {
    const ch = chars[i];

    // Handle escape sequences in strings
    if (inString && ch === '\\' && i + 1 < chars.length) {
      result += ch + chars[i + 1];
      i += 2;
      continue;
    }

    // Handle strings and template literals
    if ((ch === '"' || ch === "'" || ch === '`') && !inString) {
      inString = true;
      stringChar = ch;
      result += ch;
      i++;
      continue;
    } else if (inString && ch === stringChar) {
      inString = false;
      result += ch;
      i++;
      continue;
    }

    if (inString) {
      result += ch;
      i++;
      continue;
    }

    // Handle single-line comments
    if (ch === '/' && i + 1 < chars.length && chars[i + 1] === '/') {
      i += 2;
      while (i < chars.length && chars[i] !== '\n') {
        i++;
      }
      if (i < chars.length && chars[i] === '\n') {
        result += '\n';
        i++;
      }
      continue;
    }

    // Handle multi-line comments
    if (ch === '/' && i + 1 < chars.length && chars[i + 1] === '*') {
      i += 2;
      while (i < chars.length - 1) {
        if (chars[i] === '*' && chars[i + 1] === '/') {
          i += 2;
          break;
        }
        i++;
      }
      result += ' ';
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

async function minifyJS(text: string, language: string): Promise<string> {
  const withoutComments = removeJSComments(text);
  const parser = language === 'typescript' || (language === 'react' && detectTypeScript(text))
    ? 'typescript'
    : 'babel';

  try {
    const formatted = await prettier.format(withoutComments, {
      parser,
      printWidth: 99999,
    });

    // Collapse whitespace while preserving strings
    let result = '';
    let inString = false;
    let stringChar = ' ';
    let lastWasSpace = false;

    for (const ch of formatted) {
      if ((ch === '"' || ch === "'" || ch === '`')) {
        if (!inString) {
          inString = true;
          stringChar = ch;
        } else if (ch === stringChar) {
          inString = false;
        }
        result += ch;
        lastWasSpace = false;
        continue;
      }

      if (inString) {
        result += ch;
        lastWasSpace = false;
        continue;
      }

      if (/\s/.test(ch)) {
        if (!lastWasSpace) {
          result += ' ';
          lastWasSpace = true;
        }
      } else {
        result += ch;
        lastWasSpace = false;
      }
    }

    return result.trim();
  } catch {
    return text;
  }
}

function minifyCSS(text: string): string {
  // Remove comments
  let result = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // Collapse whitespace
  result = result.replace(/\s+/g, ' ');
  // Remove spaces around special characters
  result = result.replace(/\s*([{}:;,>+~])\s*/g, '$1');
  return result.trim();
}

function minifyHTML(text: string): string {
  // Remove comments
  let result = text.replace(/<!--[\s\S]*?-->/g, '');
  // Collapse whitespace between tags
  result = result.replace(/>\s+</g, '><');
  // Collapse other whitespace
  result = result.replace(/\s+/g, ' ');
  return result.trim();
}

function minifyXML(text: string): string {
  // Remove comments
  let result = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove whitespace between tags
  result = result.replace(/>\s+</g, '><');
  return result.trim();
}
