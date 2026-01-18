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
  const [isDragging, setIsDragging] = useState(false);
  const { content, setContent, language, setLanguage, stats, isVisible, pasteAndClose, setEditorView, images, addImage, removeImage } = useEditorStore();
  const { settings } = useSettingsStore();
  const { isProFeatureEnabled } = useLicenseStore();

  const hasImageSupport = isProFeatureEnabled('image_attachments');

  // Auto-bullet keymap: Enter adds bullet on bullet lines, Shift+Enter is normal newline
  const bulletKeymap = keymap.of([
    {
      key: 'Enter',
      run: (view) => {
        const state = view.state;
        const line = state.doc.lineAt(state.selection.main.head);
        const lineText = line.text;

        // Check if current line starts with a bullet
        if (lineText.trimStart().startsWith('• ')) {
          // If line is just "• " (empty bullet), remove it instead of adding new bullet
          if (lineText.trim() === '•') {
            view.dispatch({
              changes: { from: line.from, to: line.to, insert: '' },
            });
            return true;
          }

          // Insert newline + bullet
          view.dispatch({
            changes: {
              from: state.selection.main.head,
              insert: '\n• ',
            },
            selection: { anchor: state.selection.main.head + 3 },
          });
          return true;
        }

        // Not a bullet line, let default Enter behavior handle it
        return false;
      },
    },
  ]);

  const hasStatsDisplay = isProFeatureEnabled('stats_display');
  const hasSyntaxHighlighting = isProFeatureEnabled('syntax_highlighting');
  const hasLanguageSelection = isProFeatureEnabled('language_selection');

  // Handle drag-and-drop for images (PRO feature)
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasImageSupport && e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, [hasImageSupport]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasImageSupport && e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      setIsDragging(true);
    }
  }, [hasImageSupport]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the main container
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    console.log('Drop event received', { hasImageSupport, files: e.dataTransfer.files.length });

    if (!hasImageSupport) {
      console.log('Image support not enabled (PRO feature)');
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    console.log('Image files:', imageFiles.map(f => f.name));

    for (const file of imageFiles) {
      const imageId = await addImage(file);
      console.log('Added image with ID:', imageId);
      // Insert placeholder at cursor position
      if (viewRef.current) {
        const pos = viewRef.current.state.selection.main.head;
        const placeholder = `[image #${imageId}]`;
        viewRef.current.dispatch({
          changes: { from: pos, insert: placeholder },
          selection: { anchor: pos + placeholder.length },
        });
      }
    }
  }, [hasImageSupport, addImage]);

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
      // Bullet keymap first so it takes precedence for Enter key
      bulletKeymap,
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
    setEditorView(view);

    // Focus the editor
    view.focus();

    return () => {
      view.destroy();
      setEditorView(null);
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
    <div
      className="flex flex-col h-full relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--editor-bg)]/90 border-2 border-dashed border-[var(--editor-accent)] rounded-lg">
          <div className="text-center">
            <svg className="w-12 h-12 mx-auto mb-2 text-[var(--editor-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-[var(--editor-text)]">Drop image to attach</p>
          </div>
        </div>
      )}

      <div
        ref={editorRef}
        className="flex-1 overflow-hidden"
        style={{
          fontFamily: settings?.font_family || 'monospace',
          fontSize: `${settings?.font_size || 14}px`,
        }}
      />

      {/* Image thumbnails */}
      {images.length > 0 && (
        <div className="border-t border-[var(--editor-border)] px-3 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--editor-muted)]">Images:</span>
            {images.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={img.data}
                  alt={img.name}
                  className="h-10 w-auto rounded border border-[var(--editor-border)] object-cover"
                  title={`[image #${img.id}] - ${img.name}`}
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                  title="Remove image"
                >
                  ×
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 truncate">
                  #{img.id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
