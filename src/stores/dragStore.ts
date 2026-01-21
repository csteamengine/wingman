import { create } from 'zustand';

interface DragState {
  draggedContent: string | null;
  isDraggingClipboardItem: boolean;
  cursorPosition: { x: number; y: number } | null;
  editorInsertPosition: number | null;
  startDrag: (content: string) => void;
  endDrag: () => void;
  updateCursorPosition: (x: number, y: number, editorPos: number | null) => void;
  clearCursor: () => void;
}

export const useDragStore = create<DragState>((set) => ({
  draggedContent: null,
  isDraggingClipboardItem: false,
  cursorPosition: null,
  editorInsertPosition: null,
  startDrag: (content) => {
    set({
      draggedContent: content,
      isDraggingClipboardItem: true,
      cursorPosition: null,
      editorInsertPosition: null,
    });
  },
  endDrag: () => {
    set({
      draggedContent: null,
      isDraggingClipboardItem: false,
      cursorPosition: null,
      editorInsertPosition: null,
    });
  },
  updateCursorPosition: (x, y, editorPos) => {
    set({
      cursorPosition: { x, y },
      editorInsertPosition: editorPos,
    });
  },
  clearCursor: () => {
    set({
      cursorPosition: null,
      editorInsertPosition: null,
    });
  },
}));
