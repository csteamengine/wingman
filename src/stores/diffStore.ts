import { create } from 'zustand';
import { undo } from '@codemirror/commands';
import { useEditorStore } from './editorStore';

export interface PendingDiff {
  originalText: string;
  transformedText: string;
  transformationType: string;
  selectionRange: { from: number; to: number } | null;
  cursorPos: number;
  applyCallback: () => void;
}

export interface TransformationRecord {
  id: string;
  originalText: string;
  transformedText: string;
  transformationType: string;
  timestamp: number;
}

interface DiffState {
  // Pre-transformation
  pendingDiff: PendingDiff | null;
  showPreviewModal: boolean;

  // Post-transformation
  transformationHistory: TransformationRecord[];
  showReviewModal: boolean;
  showFloatingButton: boolean;
  floatingButtonDismissTimer: ReturnType<typeof setTimeout> | null;

  // Actions
  setPendingDiff: (diff: PendingDiff | null) => void;
  openPreviewModal: () => void;
  closePreviewModal: () => void;
  confirmTransformation: () => void;
  cancelTransformation: () => void;
  addTransformationRecord: (record: Omit<TransformationRecord, 'id' | 'timestamp'>) => void;
  undoLastTransformation: () => void;
  openReviewModal: () => void;
  closeReviewModal: () => void;
  dismissFloatingButton: () => void;
  clearTransformationHistory: () => void;
}

const MAX_HISTORY_ENTRIES = 10;
const AUTO_DISMISS_TIMEOUT = 8000;

export const useDiffStore = create<DiffState>((set, get) => ({
  // Pre-transformation state
  pendingDiff: null,
  showPreviewModal: false,

  // Post-transformation state
  transformationHistory: [],
  showReviewModal: false,
  showFloatingButton: false,
  floatingButtonDismissTimer: null,

  setPendingDiff: (diff) => {
    set({ pendingDiff: diff });
  },

  openPreviewModal: () => {
    set({ showPreviewModal: true });
  },

  closePreviewModal: () => {
    set({ showPreviewModal: false, pendingDiff: null });
  },

  confirmTransformation: () => {
    const { pendingDiff, floatingButtonDismissTimer } = get();
    if (!pendingDiff) return;

    // Clear any existing timer
    if (floatingButtonDismissTimer) {
      clearTimeout(floatingButtonDismissTimer);
    }

    // Apply the transformation
    pendingDiff.applyCallback();

    // Add to history
    const record: TransformationRecord = {
      id: crypto.randomUUID(),
      originalText: pendingDiff.originalText,
      transformedText: pendingDiff.transformedText,
      transformationType: pendingDiff.transformationType,
      timestamp: Date.now(),
    };

    const history = [record, ...get().transformationHistory].slice(0, MAX_HISTORY_ENTRIES);

    // Set up auto-dismiss timer
    const timer = setTimeout(() => {
      set({ showFloatingButton: false, floatingButtonDismissTimer: null });
    }, AUTO_DISMISS_TIMEOUT);

    set({
      showPreviewModal: false,
      pendingDiff: null,
      transformationHistory: history,
      showFloatingButton: true,
      floatingButtonDismissTimer: timer,
    });
  },

  cancelTransformation: () => {
    set({ showPreviewModal: false, pendingDiff: null });
  },

  addTransformationRecord: (record) => {
    const { floatingButtonDismissTimer } = get();

    // Clear any existing timer
    if (floatingButtonDismissTimer) {
      clearTimeout(floatingButtonDismissTimer);
    }

    const newRecord: TransformationRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    const history = [newRecord, ...get().transformationHistory].slice(0, MAX_HISTORY_ENTRIES);

    // Set up auto-dismiss timer
    const timer = setTimeout(() => {
      set({ showFloatingButton: false, floatingButtonDismissTimer: null });
    }, AUTO_DISMISS_TIMEOUT);

    set({
      transformationHistory: history,
      showFloatingButton: true,
      floatingButtonDismissTimer: timer,
    });
  },

  undoLastTransformation: () => {
    const editorView = useEditorStore.getState().editorView;
    if (editorView) {
      undo(editorView);
    }
    get().dismissFloatingButton();
  },

  openReviewModal: () => {
    set({ showReviewModal: true });
  },

  closeReviewModal: () => {
    set({ showReviewModal: false });
  },

  dismissFloatingButton: () => {
    const { floatingButtonDismissTimer } = get();
    if (floatingButtonDismissTimer) {
      clearTimeout(floatingButtonDismissTimer);
    }
    set({
      showFloatingButton: false,
      showReviewModal: false,
      floatingButtonDismissTimer: null,
    });
  },

  clearTransformationHistory: () => {
    set({ transformationHistory: [] });
  },
}));
