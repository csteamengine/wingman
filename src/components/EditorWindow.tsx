import { useEffect, useRef, useCallback, useState } from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { rust } from '@codemirror/lang-rust';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useEditorStore } from '../stores/editorStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useLicenseStore } from '../stores/licenseStore';

const languages: Record<string, () => ReturnType<typeof javascript>> = {
  javascript: javascript,
  typescript: () => javascript({ typescript: true }),
  jsx: () => javascript({ jsx: true }),
  tsx: () => javascript({ jsx: true, typescript: true }),
  python: python,
  rust: rust,
  html: html,
  css: css,
  json: json,
  markdown: markdown,
};

const LANGUAGE_OPTIONS = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
];

export function EditorWindow() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const { content, setContent, language, setLanguage, stats, isVisible, pasteAndClose } = useEditorStore();
  const { settings } = useSettingsStore();
  const { isProFeatureEnabled } = useLicenseStore();

  const hasStatsDisplay = isProFeatureEnabled('stats_display');
  const hasSyntaxHighlighting = isProFeatureEnabled('syntax_highlighting');
  const hasLanguageSelection = isProFeatureEnabled('language_selection');

  // Focus editor when window becomes visible
  useEffect(() => {
    if (isVisible && viewRef.current) {
      // Small delay to ensure window is fully shown
      setTimeout(() => {
        viewRef.current?.focus();
      }, 50);
    }
  }, [isVisible]);

  const getLanguageExtension = useCallback(() => {
    const langFn = languages[language];
    return langFn ? [langFn()] : [];
  }, [language]);

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      placeholder('Start typing...'),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const newContent = update.state.doc.toString();
          setContent(newContent);
        }
      }),
      ...getLanguageExtension(),
    ];

    // Add dark theme for dark-ish themes (CodeMirror's oneDark works well for these)
    const darkThemes = ['dark', 'high-contrast', 'solarized-dark', 'dracula', 'nord'];
    if (!settings?.theme || darkThemes.includes(settings.theme)) {
      extensions.push(oneDark);
    }

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Focus the editor
    view.focus();

    return () => {
      view.destroy();
    };
  }, [language, settings?.theme]);

  // Update editor content when it changes externally
  useEffect(() => {
    if (viewRef.current) {
      const currentContent = viewRef.current.state.doc.toString();
      if (currentContent !== content) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
        });
      }
    }
  }, [content]);

  return (
    <div className="flex flex-col h-full">
      <div
        ref={editorRef}
        className="flex-1 overflow-hidden"
        style={{
          fontFamily: settings?.font_family || 'monospace',
          fontSize: `${settings?.font_size || 14}px`,
        }}
      />
      {settings?.show_status_bar !== false && (
        <div className="border-t border-[var(--editor-border)] rounded-b-[10px]">
          {/* Info row */}
          <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--editor-muted)]">
            <div className="flex items-center gap-3">
              {hasStatsDisplay ? (
                <>
                  <span>{stats.character_count} chars</span>
                  <span className="opacity-30">·</span>
                  <span>{stats.word_count} words</span>
                  <span className="opacity-30">·</span>
                  <span>{stats.line_count} lines</span>
                </>
              ) : (
                <span className="opacity-60">Pro: Stats</span>
              )}
            </div>
            {/* Language Selector */}
            <div className="relative">
              {hasLanguageSelection && hasSyntaxHighlighting ? (
                <>
                  <button
                    onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                    className="text-xs px-2 py-1 rounded-md hover:bg-[var(--editor-hover)] transition-colors"
                  >
                    {LANGUAGE_OPTIONS.find(l => l.value === language)?.label || 'Plain Text'}
                    <span className="ml-1 opacity-40">▾</span>
                  </button>
                  {showLanguageDropdown && (
                    <div className="absolute bottom-full mb-1 right-0 bg-[var(--editor-bg)] border border-[var(--editor-border)] rounded-md shadow-lg z-50 min-w-[140px] max-h-[200px] overflow-y-auto py-1">
                      {LANGUAGE_OPTIONS.map((lang) => (
                        <button
                          key={lang.value}
                          onClick={() => {
                            setLanguage(lang.value);
                            setShowLanguageDropdown(false);
                          }}
                          className={`w-full text-left text-xs px-3 py-1.5 hover:bg-[var(--editor-hover)] ${
                            language === lang.value ? 'text-[var(--editor-accent)]' : ''
                          }`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <span className="opacity-60 text-[10px] px-1.5 py-0.5 rounded bg-[var(--editor-accent)]/20 text-[var(--editor-accent)]">PRO</span>
              )}
            </div>
          </div>

          {/* Action button row */}
          <div className="px-3 pb-3">
            <button
              onClick={pasteAndClose}
              disabled={!content.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-[var(--editor-surface)] border border-[var(--editor-border)] text-sm text-[var(--editor-text)] hover:bg-[var(--editor-hover)] disabled:opacity-40 transition-colors"
            >
              <span>Copy to Clipboard</span>
              <span className="kbd">⌘↵</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
