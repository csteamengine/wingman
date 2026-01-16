import { useEffect, useRef, useCallback } from 'react';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
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

export function EditorWindow() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { content, setContent, language, stats, isVisible } = useEditorStore();
  const { settings } = useSettingsStore();
  const { isProFeatureEnabled } = useLicenseStore();

  // Check pro features
  const hasSyntaxHighlighting = isProFeatureEnabled('syntax_highlighting');
  const hasStatsDisplay = isProFeatureEnabled('stats_display');

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
    // Only provide syntax highlighting for Pro users
    if (!hasSyntaxHighlighting) return [];
    const langFn = languages[language];
    return langFn ? [langFn()] : [];
  }, [language, hasSyntaxHighlighting]);

  useEffect(() => {
    if (!editorRef.current) return;

    const extensions = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
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
  }, [language, settings?.theme, hasSyntaxHighlighting]);

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
        <div className="status-bar">
          <div className="flex items-center gap-4">
            {hasStatsDisplay ? (
              <>
                <span>{stats.character_count} characters</span>
                <span>{stats.word_count} words</span>
                <span>{stats.line_count} lines</span>
              </>
            ) : (
              <span className="text-[var(--editor-muted)] text-xs">Pro: Stats display</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="kbd">⌘⏎</span>
            <span>Copy</span>
            <span className="kbd">ESC</span>
            <span>Close</span>
          </div>
        </div>
      )}
    </div>
  );
}
