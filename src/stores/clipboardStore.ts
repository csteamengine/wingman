import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import type { ClipboardItem } from '../types';

const MAX_CLIPBOARD_ITEMS = 50;

interface ClipboardState {
  items: ClipboardItem[];
  isMonitoring: boolean;
  lastContent: string | null;
  addItem: (content: string) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  startMonitoring: () => void;
  stopMonitoring: () => void;
}

// Generate a unique ID
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Create a preview from content (first 100 chars, single line)
const createPreview = (content: string): string => {
  const singleLine = content.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  return singleLine.length > 100 ? singleLine.substring(0, 100) + '...' : singleLine;
};

let monitoringInterval: ReturnType<typeof setInterval> | null = null;

export const useClipboardStore = create<ClipboardState>()(
  persist(
    (set, get) => ({
      items: [],
      isMonitoring: false,
      lastContent: null,

      addItem: (content: string) => {
        if (!content.trim()) return;

        const { items } = get();

        // Check for duplicates - remove existing item with same content
        const existingIndex = items.findIndex((item) => item.content === content);
        let newItems = [...items];

        if (existingIndex !== -1) {
          // Remove the existing duplicate
          newItems.splice(existingIndex, 1);
        }

        // Create new item and add to front
        const newItem: ClipboardItem = {
          id: generateId(),
          content,
          timestamp: Date.now(),
          preview: createPreview(content),
        };

        newItems = [newItem, ...newItems];

        // Keep only the last MAX_CLIPBOARD_ITEMS items
        if (newItems.length > MAX_CLIPBOARD_ITEMS) {
          newItems = newItems.slice(0, MAX_CLIPBOARD_ITEMS);
        }

        set({ items: newItems, lastContent: content });
      },

      removeItem: (id: string) => {
        const { items } = get();
        set({ items: items.filter((item) => item.id !== id) });
      },

      clearAll: () => {
        set({ items: [], lastContent: null });
      },

      startMonitoring: () => {
        const { isMonitoring } = get();
        if (isMonitoring) return;

        set({ isMonitoring: true });

        // Poll clipboard every 500ms
        monitoringInterval = setInterval(async () => {
          try {
            const text = await readText();
            if (text && text !== get().lastContent) {
              get().addItem(text);
            }
          } catch (error) {
            // Clipboard might be empty or contain non-text data
            console.debug('Clipboard read failed:', error);
          }
        }, 500);
      },

      stopMonitoring: () => {
        if (monitoringInterval) {
          clearInterval(monitoringInterval);
          monitoringInterval = null;
        }
        set({ isMonitoring: false });
      },
    }),
    {
      name: 'wingman-clipboard-history',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        lastContent: state.lastContent,
      }),
    }
  )
);
