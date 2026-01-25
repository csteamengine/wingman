import {javascript} from '@codemirror/lang-javascript';
import {python} from '@codemirror/lang-python';
import {rust} from '@codemirror/lang-rust';
import {html} from '@codemirror/lang-html';
import {css} from '@codemirror/lang-css';
import {json} from '@codemirror/lang-json';
import {markdown} from '@codemirror/lang-markdown';
import {sql} from '@codemirror/lang-sql';
import {yaml} from '@codemirror/lang-yaml';
import {xml} from '@codemirror/lang-xml';
import {java} from '@codemirror/lang-java';
import {go} from '@codemirror/lang-go';
import {php} from '@codemirror/lang-php';
import {cpp} from '@codemirror/lang-cpp';
import {StreamLanguage} from '@codemirror/language';
import {shell} from '@codemirror/legacy-modes/mode/shell';
import {ruby} from '@codemirror/legacy-modes/mode/ruby';
import {swift} from '@codemirror/legacy-modes/mode/swift';
import {csharp, kotlin} from '@codemirror/legacy-modes/mode/clike';
import {languages as codeLanguages} from '@codemirror/language-data';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const languages: Record<string, () => any> = {
    javascript: javascript,
    typescript: () => javascript({typescript: true}),
    react: () => javascript({jsx: true, typescript: true}), // Support both JSX and TSX
    // Keep jsx/tsx for backward compatibility but hidden from UI
    jsx: () => javascript({jsx: true}),
    tsx: () => javascript({jsx: true, typescript: true}),
    python: python,
    rust: rust,
    html: html,
    css: css,
    json: json,
    markdown: () => markdown({codeLanguages}),
    // Primary languages (free)
    sql: sql,
    yaml: yaml,
    xml: xml,
    bash: () => StreamLanguage.define(shell),
    java: java,
    go: go,
    php: php,
    c: cpp,
    cpp: cpp,
    // Secondary languages (PRO)
    ruby: () => StreamLanguage.define(ruby),
    swift: () => StreamLanguage.define(swift),
    kotlin: () => StreamLanguage.define(kotlin),
    csharp: () => StreamLanguage.define(csharp),
};

export interface LanguageOption {
    value: string;
    label: string;
    isPro?: boolean;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
    // Text formats
    {value: 'plaintext', label: 'Plain Text'},
    {value: 'markdown', label: 'Markdown'},
    // Web languages
    {value: 'javascript', label: 'JavaScript'},
    {value: 'typescript', label: 'TypeScript'},
    {value: 'react', label: 'React'},
    {value: 'html', label: 'HTML'},
    {value: 'css', label: 'CSS'},
    {value: 'json', label: 'JSON'},
    // Primary languages (free)
    {value: 'sql', label: 'SQL'},
    {value: 'yaml', label: 'YAML'},
    {value: 'xml', label: 'XML'},
    {value: 'bash', label: 'Bash/Shell'},
    {value: 'python', label: 'Python'},
    {value: 'java', label: 'Java'},
    {value: 'go', label: 'Go'},
    {value: 'php', label: 'PHP'},
    {value: 'c', label: 'C'},
    {value: 'cpp', label: 'C++'},
    {value: 'rust', label: 'Rust'},
    // Secondary languages (PRO)
    {value: 'ruby', label: 'Ruby', isPro: true},
    {value: 'swift', label: 'Swift', isPro: true},
    {value: 'kotlin', label: 'Kotlin', isPro: true},
    {value: 'csharp', label: 'C#', isPro: true},
];
