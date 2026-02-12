import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { CustomTransformation, CustomTransformationsData } from '../types';
import { executeUserTransformation } from '../lib/secureTransformExecution';

interface TransformationResult {
  success: boolean;
  result?: string;
  error?: string;
}

interface CustomTransformationsState {
  transformations: CustomTransformation[];
  loading: boolean;
  error: string | null;

  // Actions
  loadTransformations: () => Promise<void>;
  saveTransformations: () => Promise<void>;
  addTransformation: (transformation: Omit<CustomTransformation, 'id' | 'created_at' | 'updated_at'>) => void;
  updateTransformation: (id: string, updates: Partial<CustomTransformation>) => void;
  deleteTransformation: (id: string) => void;
  toggleTransformation: (id: string) => void;
  executeTransformation: (id: string, text: string) => Promise<TransformationResult>;
  getEnabledTransformations: () => CustomTransformation[];
}

export const useCustomTransformationsStore = create<CustomTransformationsState>((set, get) => ({
  transformations: [],
  loading: false,
  error: null,

  loadTransformations: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invoke<CustomTransformationsData>('get_custom_transformations');
      set({
        transformations: data.transformations || [],
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load custom transformations:', error);
      set({
        transformations: [],
        loading: false,
        error: String(error),
      });
    }
  },

  saveTransformations: async () => {
    const { transformations } = get();
    try {
      await invoke('save_custom_transformations_cmd', {
        data: { transformations },
      });
    } catch (error) {
      console.error('Failed to save custom transformations:', error);
      set({ error: String(error) });
    }
  },

  addTransformation: (transformation) => {
    const now = new Date().toISOString();
    const newTransformation: CustomTransformation = {
      ...transformation,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };

    set((state) => ({
      transformations: [...state.transformations, newTransformation],
    }));

    // Save after adding
    get().saveTransformations();
  },

  updateTransformation: (id, updates) => {
    set((state) => ({
      transformations: state.transformations.map((t) =>
        t.id === id
          ? { ...t, ...updates, updated_at: new Date().toISOString() }
          : t
      ),
    }));

    // Save after updating
    get().saveTransformations();
  },

  deleteTransformation: (id) => {
    set((state) => ({
      transformations: state.transformations.filter((t) => t.id !== id),
    }));

    // Save after deleting
    get().saveTransformations();
  },

  toggleTransformation: (id) => {
    set((state) => ({
      transformations: state.transformations.map((t) =>
        t.id === id ? { ...t, enabled: !t.enabled, updated_at: new Date().toISOString() } : t
      ),
    }));

    // Save after toggling
    get().saveTransformations();
  },

  executeTransformation: async (id, text) => {
    const transformation = get().transformations.find((t) => t.id === id);
    if (!transformation) {
      return {
        success: false,
        error: 'Transformation not found',
      };
    }

    if (!transformation.enabled) {
      return {
        success: false,
        error: 'Transformation is disabled',
      };
    }

    return executeUserTransformation(transformation.code, text);
  },

  getEnabledTransformations: () => {
    return get().transformations.filter((t) => t.enabled);
  },
}));
