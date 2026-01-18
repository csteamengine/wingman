import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import type { EditorView } from '@codemirror/view';
import type { TextStats, PanelType } from '../types';

export interface EditorImage {
  id: number;
  data: string; // base64 data URL
  name: string;
  width?: number;
  height?: number;
}

interface EditorState {
  content: string;
  language: string;
  stats: TextStats;
  activePanel: PanelType;
  isVisible: boolean;
  editorView: EditorView | null;
  images: EditorImage[];
  nextImageId: number;
  setContent: (content: string) => void;
  setLanguage: (language: string) => void;
  setActivePanel: (panel: PanelType) => void;
  setEditorView: (view: EditorView | null) => void;
  addImage: (file: File) => Promise<number>;
  removeImage: (id: number) => void;
  setImages: (images: EditorImage[]) => void;
  clearImages: () => void;
  updateStats: () => Promise<void>;
  pasteAndClose: () => Promise<void>;
  closeWithoutPaste: () => Promise<void>;
  clearContent: () => void;
  transformText: (transform: string) => Promise<void>;
  applyBulletList: () => void;
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  content: '',
  language: 'plaintext',
  stats: { character_count: 0, word_count: 0, line_count: 0, paragraph_count: 0 },
  activePanel: 'actions',
  isVisible: false,
  editorView: null,
  images: [],
  nextImageId: 1,

  setContent: (content: string) => {
    set({ content });
    get().updateStats();
  },

  setLanguage: (language: string) => {
    set({ language });
  },

  setActivePanel: (panel: PanelType) => {
    set({ activePanel: panel });
  },

  setEditorView: (view: EditorView | null) => {
    set({ editorView: view });
  },

  addImage: async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const { nextImageId, images } = get();
          const newImage: EditorImage = {
            id: nextImageId,
            data,
            name: file.name,
            width: img.width,
            height: img.height,
          };
          set({
            images: [...images, newImage],
            nextImageId: nextImageId + 1,
          });
          resolve(nextImageId);
        };
        img.src = data;
      };
      reader.readAsDataURL(file);
    });
  },

  removeImage: (id: number) => {
    const { images } = get();
    set({ images: images.filter((img) => img.id !== id) });
  },

  setImages: (images: EditorImage[]) => {
    // Calculate next ID from the highest existing ID
    const maxId = images.reduce((max, img) => Math.max(max, img.id), 0);
    set({ images, nextImageId: maxId + 1 });
  },

  clearImages: () => {
    set({ images: [], nextImageId: 1 });
  },

  updateStats: async () => {
    const { content } = get();
    try {
      const stats = await invoke<TextStats>('get_text_stats', { text: content });
      set({ stats });
    } catch (error) {
      // Calculate locally if backend fails
      const character_count = content.length;
      const word_count = content.split(/\s+/).filter(Boolean).length;
      const line_count = content.split('\n').length;
      const paragraph_count = content.split(/\n\n+/).filter(Boolean).length;
      set({ stats: { character_count, word_count, line_count, paragraph_count } });
    }
  },

  pasteAndClose: async () => {
    const { content, images } = get();
    if (content.trim() || images.length > 0) {
      try {
        // If we have images, write HTML to clipboard so images are included
        if (images.length > 0) {
          // Replace [image #N] placeholders with actual img tags for HTML clipboard
          let htmlContent = content;
          images.forEach((img) => {
            const placeholder = `[image #${img.id}]`;
            const imgTag = `<img src="${img.data}" alt="${img.name}" style="max-width: 100%;">`;
            htmlContent = htmlContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imgTag);
          });

          // Wrap in basic HTML structure
          const fullHtml = `<!DOCTYPE html><html><body>${htmlContent.replace(/\n/g, '<br>')}</body></html>`;

          // Use web Clipboard API for HTML
          const blob = new Blob([fullHtml], { type: 'text/html' });
          const textBlob = new Blob([content], { type: 'text/plain' });
          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': blob,
              'text/plain': textBlob,
            }),
          ]);
        } else {
          // No images - just write plain text
          await writeText(content);
        }

        // Save to history (including images)
        await invoke('add_history_entry', {
          content,
          language: get().language,
          tags: null,
          images: images.length > 0 ? JSON.stringify(images) : null,
        });

        // Hide window and auto-paste to previous app
        await invoke('hide_and_paste');
        set({ content: '', images: [], nextImageId: 1, activePanel: 'actions', isVisible: false });
        return;
      } catch (error) {
        console.error('Failed to paste:', error);
      }
    }
    get().hideWindow();
    set({ content: '', images: [], nextImageId: 1, activePanel: 'actions' });
  },

  closeWithoutPaste: async () => {
    await get().hideWindow();
    // Keep the content - only reset panel, don't clear text
    set({ activePanel: 'editor' });
  },

  clearContent: () => {
    set({ content: '', images: [], nextImageId: 1 });
    get().updateStats();
  },

  transformText: async (transform: string) => {
    const { content } = get();
    try {
      const transformed = await invoke<string>('transform_text_cmd', { text: content, transform });
      set({ content: transformed });
      get().updateStats();
    } catch (error) {
      console.error('Failed to transform text:', error);
    }
  },

  applyBulletList: () => {
    const { editorView, content } = get();

    // If no content, start a new bullet list
    if (!content.trim()) {
      set({ content: '• ' });
      get().updateStats();
      // Move cursor to end
      if (editorView) {
        setTimeout(() => {
          editorView.dispatch({
            selection: { anchor: 2 },
          });
          editorView.focus();
        }, 0);
      }
      return;
    }

    if (!editorView) {
      // Fallback: apply bullets to all lines
      const lines = content.split('\n');
      const bulleted = lines.map(line => {
        if (line.trim() === '' || line.trimStart().startsWith('• ')) {
          return line;
        }
        return '• ' + line;
      }).join('\n');
      set({ content: bulleted });
      get().updateStats();
      return;
    }

    const state = editorView.state;
    const selection = state.selection.main;

    // Get line range for selection or current line
    const fromLine = state.doc.lineAt(selection.from);
    const toLine = state.doc.lineAt(selection.to);
    const isSingleLine = fromLine.number === toLine.number;

    // Process each line in the range
    const changes: { from: number; to: number; insert: string }[] = [];
    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = state.doc.line(lineNum);
      const lineText = line.text;

      // Skip already bulleted lines
      if (lineText.trimStart().startsWith('• ')) {
        continue;
      }

      // For single line (current line): add bullet even if empty
      // For multi-line selection: skip empty lines (blank separators)
      if (!isSingleLine && lineText.trim() === '') {
        continue;
      }

      // Add bullet at the start of the line
      changes.push({
        from: line.from,
        to: line.from,
        insert: '• ',
      });
    }

    if (changes.length > 0) {
      editorView.dispatch({ changes });
      // Move cursor to end of the line if it was empty
      if (isSingleLine && fromLine.text.trim() === '') {
        editorView.dispatch({
          selection: { anchor: fromLine.from + 2 },
        });
      }
    }
    editorView.focus();
  },

  showWindow: async () => {
    try {
      // Use Rust command to show window (this also stores the previous app)
      await invoke('show_window');
      set({ isVisible: true });
    } catch (error) {
      console.error('Failed to show window:', error);
    }
  },

  hideWindow: async () => {
    try {
      // Use the Rust command to properly hide the NSPanel on macOS
      await invoke('hide_window');
      set({ isVisible: false });
    } catch (error) {
      console.error('Failed to hide window:', error);
    }
  },
}));
