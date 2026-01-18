import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import type { EditorView } from '@codemirror/view';
import type { TextStats, PanelType } from '../types';

export type AttachmentType = 'image' | 'text' | 'file';

export interface EditorAttachment {
  id: number;
  data: string; // base64 data URL
  name: string;
  type: AttachmentType;
  mimeType: string;
  size: number;
  width?: number; // Only for images
  height?: number; // Only for images
}

// Keep EditorImage as alias for backwards compatibility with history
export type EditorImage = EditorAttachment;

interface EditorState {
  content: string;
  language: string;
  stats: TextStats;
  activePanel: PanelType;
  isVisible: boolean;
  editorView: EditorView | null;
  images: EditorAttachment[]; // Keep as 'images' for compatibility
  nextImageId: number;
  setContent: (content: string) => void;
  setLanguage: (language: string) => void;
  setActivePanel: (panel: PanelType) => void;
  setEditorView: (view: EditorView | null) => void;
  addFile: (file: File) => Promise<number>;
  addImage: (file: File) => Promise<number>; // Alias for addFile
  removeImage: (id: number) => void;
  setImages: (images: EditorAttachment[]) => void;
  clearImages: () => void;
  updateStats: () => Promise<void>;
  pasteAndClose: () => Promise<void>;
  closeWithoutPaste: () => Promise<void>;
  clearContent: () => void;
  transformText: (transform: string) => Promise<void>;
  applyBulletList: () => void;
  applyNumberedList: () => void;
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

  addFile: async (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result as string;
        const { nextImageId, images } = get();

        // Determine attachment type
        let attachmentType: AttachmentType = 'file';
        if (file.type.startsWith('image/')) {
          attachmentType = 'image';
        } else if (file.type.startsWith('text/') || file.name.match(/\.(txt|md|json|xml|html|css|js|ts|py|rs|go|java|c|cpp|h|hpp)$/i)) {
          attachmentType = 'text';
        }

        const baseAttachment: EditorAttachment = {
          id: nextImageId,
          data,
          name: file.name,
          type: attachmentType,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        };

        // If it's an image, get dimensions
        if (attachmentType === 'image') {
          const img = new Image();
          img.onload = () => {
            const attachment: EditorAttachment = {
              ...baseAttachment,
              width: img.width,
              height: img.height,
            };
            set({
              images: [...images, attachment],
              nextImageId: nextImageId + 1,
            });
            resolve(nextImageId);
          };
          img.onerror = () => {
            // Still add even if we can't get dimensions
            set({
              images: [...images, baseAttachment],
              nextImageId: nextImageId + 1,
            });
            resolve(nextImageId);
          };
          img.src = data;
        } else {
          // Non-image file
          set({
            images: [...images, baseAttachment],
            nextImageId: nextImageId + 1,
          });
          resolve(nextImageId);
        }
      };
      reader.readAsDataURL(file);
    });
  },

  // Alias for backwards compatibility
  addImage: async (file: File): Promise<number> => {
    return get().addFile(file);
  },

  removeImage: (id: number) => {
    const { images } = get();
    set({ images: images.filter((img) => img.id !== id) });
  },

  setImages: (images: EditorAttachment[]) => {
    // Calculate next ID from the highest existing ID
    const maxId = images.reduce((max, img) => Math.max(max, img.id), 0);
    // Ensure backwards compatibility - add missing fields to old history entries
    const normalizedImages = images.map(img => ({
      ...img,
      type: img.type || (img.width ? 'image' : 'file') as AttachmentType,
      mimeType: img.mimeType || 'application/octet-stream',
      size: img.size || 0,
    }));
    set({ images: normalizedImages, nextImageId: maxId + 1 });
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
        // If we have attachments, write to clipboard with proper format
        if (images.length > 0) {
          // Separate images from other files
          const imageAttachments = images.filter(a => a.type === 'image');
          const otherAttachments = images.filter(a => a.type !== 'image');

          // Build clipboard items
          const clipboardData: Record<string, Blob> = {};

          // Always include plain text
          clipboardData['text/plain'] = new Blob([content], { type: 'text/plain' });

          // Build HTML content with embedded images
          let htmlContent = content;
          images.forEach((attachment) => {
            const imagePlaceholder = `[image #${attachment.id}]`;
            const filePlaceholder = `[file #${attachment.id}]`;
            if (attachment.type === 'image') {
              const imgTag = `<img src="${attachment.data}" alt="${attachment.name}" style="max-width: 100%;">`;
              htmlContent = htmlContent.replace(new RegExp(imagePlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), imgTag);
            } else {
              // For non-image files, replace with filename
              htmlContent = htmlContent.replace(new RegExp(filePlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), `[${attachment.name}]`);
            }
          });

          // Add HTML version
          const fullHtml = `<!DOCTYPE html><html><body>${htmlContent.replace(/\n/g, '<br>')}</body></html>`;
          clipboardData['text/html'] = new Blob([fullHtml], { type: 'text/html' });

          // If there's exactly one image and minimal text, also add raw image data
          // This allows pasting into image editors and native macOS apps
          if (imageAttachments.length === 1 && otherAttachments.length === 0) {
            const img = imageAttachments[0];
            // Convert base64 data URL to blob
            const base64Data = img.data.split(',')[1];
            const mimeType = img.mimeType || 'image/png';
            const byteString = atob(base64Data);
            const arrayBuffer = new ArrayBuffer(byteString.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            for (let i = 0; i < byteString.length; i++) {
              uint8Array[i] = byteString.charCodeAt(i);
            }
            clipboardData[mimeType] = new Blob([arrayBuffer], { type: mimeType });
          }

          await navigator.clipboard.write([new ClipboardItem(clipboardData)]);
        } else {
          // No attachments - just write plain text
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

  applyNumberedList: () => {
    const { editorView, content } = get();

    // If no content, start a new numbered list
    if (!content.trim()) {
      set({ content: '1. ' });
      get().updateStats();
      // Move cursor to end
      if (editorView) {
        setTimeout(() => {
          editorView.dispatch({
            selection: { anchor: 3 },
          });
          editorView.focus();
        }, 0);
      }
      return;
    }

    if (!editorView) {
      // Fallback: apply numbers to all lines
      const lines = content.split('\n');
      let num = 1;
      const numbered = lines.map(line => {
        if (line.trim() === '') {
          return line;
        }
        // Skip already numbered lines
        if (/^\s*\d+\.\s/.test(line)) {
          return line;
        }
        return `${num++}. ${line}`;
      }).join('\n');
      set({ content: numbered });
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
    let num = 1;
    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = state.doc.line(lineNum);
      const lineText = line.text;

      // Skip already numbered lines
      if (/^\s*\d+\.\s/.test(lineText)) {
        num++;
        continue;
      }

      // For single line (current line): add number even if empty
      // For multi-line selection: skip empty lines (blank separators)
      if (!isSingleLine && lineText.trim() === '') {
        continue;
      }

      // Add number at the start of the line
      changes.push({
        from: line.from,
        to: line.from,
        insert: `${num++}. `,
      });
    }

    if (changes.length > 0) {
      editorView.dispatch({ changes });
      // Move cursor to end of the line if it was empty
      if (isSingleLine && fromLine.text.trim() === '') {
        editorView.dispatch({
          selection: { anchor: fromLine.from + 3 },
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
