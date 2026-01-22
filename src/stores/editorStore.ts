import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import type { EditorView } from '@codemirror/view';
import type { TextStats, PanelType } from '../types';

export type SettingsTab = 'settings' | 'hotkeys' | 'license';

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
  // Settings panel navigation state
  initialSettingsTab: SettingsTab | null;
  shouldCheckUpdates: boolean;
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
  toggleWindow: () => Promise<void>;
  // Navigate to settings with specific tab or update check
  openSettingsTab: (tab: SettingsTab, checkUpdates?: boolean) => void;
  clearSettingsNavigation: () => void;
}

// Helper to safely get current editor content from editorView or fall back to store
const getEditorContent = (state: EditorState): string => {
  const { editorView, content } = state;
  if (editorView) {
    try {
      // Try to get content from the editor (source of truth)
      const editorContent = editorView.state.doc.toString();
      // Also sync to store if different
      if (editorContent !== content) {
        // Don't use set() here to avoid infinite loops, just return the editor content
      }
      return editorContent;
    } catch {
      // EditorView might be destroyed or invalid
      console.warn('Failed to read from editorView, using store content');
    }
  }
  return content;
};

export const useEditorStore = create<EditorState>((set, get) => ({
  content: '',
  language: 'plaintext',
  stats: { character_count: 0, word_count: 0, line_count: 0, paragraph_count: 0 },
  activePanel: 'actions',
  isVisible: false,
  editorView: null,
  images: [],
  nextImageId: 1,
  initialSettingsTab: null,
  shouldCheckUpdates: false,

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
    } catch {
      // Calculate locally if backend fails
      const character_count = content.length;
      const word_count = content.split(/\s+/).filter(Boolean).length;
      const line_count = content.split('\n').length;
      const paragraph_count = content.split(/\n\n+/).filter(Boolean).length;
      set({ stats: { character_count, word_count, line_count, paragraph_count } });
    }
  },

  pasteAndClose: async () => {
    const storeState = get();
    const { images } = storeState;
    // Get content from editor (source of truth) or fall back to store
    const content = getEditorContent(storeState);

    if (content.trim() || images.length > 0) {
      try {
        // If we have attachments, use native clipboard to write both text and images
        if (images.length > 0) {
          // Build text content: user's text + filenames of attachments
          // Remove trailing newlines to avoid extra blank lines
          let textContent = content.replace(/\n+$/, '');
          if (images.length > 0) {
            const filenames = images.map(a => a.name).join('\n');
            if (textContent.trim()) {
              textContent = textContent + '\n\n' + filenames;
            } else {
              textContent = filenames;
            }
          }

          // Build HTML content if there's text (for rich text apps)
          let fullHtml: string | null = null;
          if (textContent.trim()) {
            fullHtml = `<!DOCTYPE html><html><body>${textContent.replace(/\n/g, '<br>')}</body></html>`;
          }

          // Prepare attachment data for native clipboard (all file types)
          const clipboardImages = images
            .map(attachment => ({
              // Extract base64 data without the data URL prefix
              data: attachment.data.split(',')[1] || attachment.data,
              mime_type: attachment.mimeType || 'application/octet-stream',
              name: attachment.name,
            }));

          try {
            // Use native clipboard command to write text, HTML, and images
            await invoke('write_native_clipboard', {
              text: textContent,
              html: fullHtml,
              images: clipboardImages,
            });
          } catch (nativeError) {
            console.error('Native clipboard failed, falling back to writeText:', nativeError);
            // Fallback: at least copy the plain text if there is any
            if (textContent.trim()) {
              await writeText(textContent);
            }
          }
        } else {
          // No attachments - just write plain text
          // Remove trailing newlines to avoid extra blank lines
          await writeText(content.replace(/\n+$/, ''));
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
        // Still try to hide window on error
        try {
          await get().hideWindow();
        } catch {
          // Ignore
        }
      }
    }
    get().hideWindow();
    set({ content: '', images: [], nextImageId: 1, activePanel: 'actions' });
  },

  closeWithoutPaste: async () => {
    await get().hideWindow();
    // Keep the content and panel state - don't reset anything
  },

  clearContent: () => {
    set({ content: '', images: [], nextImageId: 1 });
    get().updateStats();
  },

  transformText: async (transform: string) => {
    const state = get();
    const { editorView } = state;

    if (editorView) {
      const selection = editorView.state.selection.main;
      const cursorPos = selection.head; // Save cursor position

      if (!selection.empty) {
        // Transform only the selected text
        const selectedText = editorView.state.sliceDoc(selection.from, selection.to);
        try {
          const transformed = await invoke<string>('transform_text_cmd', { text: selectedText, transform });
          // Keep cursor at same position, adjusted for length change
          const lengthDiff = transformed.length - selectedText.length;
          const newCursorPos = cursorPos <= selection.from ? cursorPos :
                              cursorPos + lengthDiff;

          editorView.dispatch({
            changes: {
              from: selection.from,
              to: selection.to,
              insert: transformed,
            },
            selection: { anchor: newCursorPos },
          });
          get().updateStats();
        } catch (error) {
          console.error('Failed to transform text:', error);
        }
        return;
      }

      // No selection - transform entire content but preserve cursor position
      const content = editorView.state.doc.toString();
      try {
        const transformed = await invoke<string>('transform_text_cmd', { text: content, transform });
        // Keep cursor at same position, clamped to new content length
        const newCursorPos = Math.min(cursorPos, transformed.length);
        editorView.dispatch({
          changes: {
            from: 0,
            to: content.length,
            insert: transformed,
          },
          selection: { anchor: newCursorPos },
        });
        get().updateStats();
      } catch (error) {
        console.error('Failed to transform text:', error);
      }
      return;
    }

    // Fallback: no editor view, use store content
    const content = getEditorContent(state);
    try {
      const transformed = await invoke<string>('transform_text_cmd', { text: content, transform });
      set({ content: transformed });
      get().updateStats();
    } catch (error) {
      console.error('Failed to transform text:', error);
    }
  },

  applyBulletList: () => {
    const storeState = get();
    const { editorView } = storeState;

    // Regex patterns for list detection
    const bulletPattern = /^(\s*)[•\-\*]\s/;
    const numberPattern = /^(\s*)\d+\.\s/;

    // Get content from editor (source of truth) or fall back to store
    const content = getEditorContent(storeState);

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
        if (line.trim() === '') {
          return line;
        }
        // Already a bullet - skip
        if (bulletPattern.test(line)) {
          return line;
        }
        // Is a numbered list - convert to bullet
        if (numberPattern.test(line)) {
          return line.replace(numberPattern, '$1• ');
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
      if (bulletPattern.test(lineText)) {
        continue;
      }

      // Convert numbered list to bullet
      const numberMatch = lineText.match(numberPattern);
      if (numberMatch) {
        const indent = numberMatch[1] || '';
        const matchLength = numberMatch[0].length;
        changes.push({
          from: line.from,
          to: line.from + matchLength,
          insert: `${indent}• `,
        });
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
    const storeState = get();
    const { editorView } = storeState;

    // Regex patterns for list detection
    const bulletPattern = /^(\s*)[•\-\*]\s/;
    const numberPattern = /^(\s*)\d+\.\s/;

    // Get content from editor (source of truth) or fall back to store
    const content = getEditorContent(storeState);

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
        if (numberPattern.test(line)) {
          return line;
        }
        // Convert bullet to number
        if (bulletPattern.test(line)) {
          return line.replace(bulletPattern, `$1${num++}. `);
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
      if (numberPattern.test(lineText)) {
        num++;
        continue;
      }

      // Convert bullet list to numbered
      const bulletMatch = lineText.match(bulletPattern);
      if (bulletMatch) {
        const indent = bulletMatch[1] || '';
        const matchLength = bulletMatch[0].length;
        changes.push({
          from: line.from,
          to: line.from + matchLength,
          insert: `${indent}${num++}. `,
        });
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

  toggleWindow: async () => {
    const { isVisible } = get();
    if (isVisible) {
      // If visible, hide it (like Spotlight/Raycast behavior)
      try {
        await invoke('hide_window');
        set({ isVisible: false });
      } catch (error) {
        console.error('Failed to hide window:', error);
      }
    } else {
      // If hidden, show it
      try {
        await invoke('show_window');
        set({ isVisible: true });
      } catch (error) {
        console.error('Failed to show window:', error);
      }
    }
  },

  openSettingsTab: (tab: SettingsTab, checkUpdates = false) => {
    set({
      activePanel: 'settings',
      initialSettingsTab: tab,
      shouldCheckUpdates: checkUpdates,
    });
  },

  clearSettingsNavigation: () => {
    set({
      initialSettingsTab: null,
      shouldCheckUpdates: false,
    });
  },
}));
