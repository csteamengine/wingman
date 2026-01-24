import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { TransformationChain, ChainStep, TransformationChainsData } from '../types';
import { useCustomTransformationsStore } from './customTransformationsStore';

interface TransformationChainsState {
  chains: TransformationChain[];
  loading: boolean;
  error: string | null;

  // Actions
  loadChains: () => Promise<void>;
  saveChains: () => Promise<void>;
  addChain: (chain: Omit<TransformationChain, 'id' | 'created_at' | 'updated_at'>) => void;
  updateChain: (id: string, updates: Partial<TransformationChain>) => void;
  deleteChain: (id: string) => void;
  toggleChain: (id: string) => void;
  executeChain: (id: string, text: string) => Promise<{ success: boolean; result?: string; error?: string }>;
  getEnabledChains: () => TransformationChain[];

  // Step management
  addStep: (chainId: string, step: Omit<ChainStep, 'id'>) => void;
  removeStep: (chainId: string, stepId: string) => void;
  reorderSteps: (chainId: string, stepIds: string[]) => void;
}

// Built-in transform IDs
const BUILTIN_TRANSFORMS = [
  'uppercase',
  'lowercase',
  'titlecase',
  'sentencecase',
  'trim',
  'sort',
  'deduplicate',
  'reverse',
];

export const useTransformationChainsStore = create<TransformationChainsState>((set, get) => ({
  chains: [],
  loading: false,
  error: null,

  loadChains: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invoke<TransformationChainsData>('get_transformation_chains');
      set({
        chains: data.chains || [],
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load transformation chains:', error);
      set({
        chains: [],
        loading: false,
        error: String(error),
      });
    }
  },

  saveChains: async () => {
    const { chains } = get();
    try {
      await invoke('save_transformation_chains_cmd', {
        data: { chains },
      });
    } catch (error) {
      console.error('Failed to save transformation chains:', error);
      set({ error: String(error) });
    }
  },

  addChain: (chain) => {
    const now = new Date().toISOString();
    const newChain: TransformationChain = {
      ...chain,
      id: crypto.randomUUID(),
      created_at: now,
      updated_at: now,
    };

    set((state) => ({
      chains: [...state.chains, newChain],
    }));

    get().saveChains();
  },

  updateChain: (id, updates) => {
    set((state) => ({
      chains: state.chains.map((c) =>
        c.id === id
          ? { ...c, ...updates, updated_at: new Date().toISOString() }
          : c
      ),
    }));

    get().saveChains();
  },

  deleteChain: (id) => {
    set((state) => ({
      chains: state.chains.filter((c) => c.id !== id),
    }));

    get().saveChains();
  },

  toggleChain: (id) => {
    set((state) => ({
      chains: state.chains.map((c) =>
        c.id === id ? { ...c, enabled: !c.enabled, updated_at: new Date().toISOString() } : c
      ),
    }));

    get().saveChains();
  },

  executeChain: async (id, text) => {
    const chain = get().chains.find((c) => c.id === id);
    if (!chain) {
      return { success: false, error: 'Chain not found' };
    }

    if (!chain.enabled) {
      return { success: false, error: 'Chain is disabled' };
    }

    if (chain.steps.length === 0) {
      return { success: false, error: 'Chain has no steps' };
    }

    let currentText = text;

    for (const step of chain.steps) {
      try {
        if (step.type === 'builtin') {
          // Execute built-in transformation
          if (!BUILTIN_TRANSFORMS.includes(step.transformId)) {
            return { success: false, error: `Unknown built-in transform: ${step.transformId}` };
          }
          currentText = await invoke<string>('transform_text_cmd', {
            text: currentText,
            transform: step.transformId,
          });
        } else if (step.type === 'custom') {
          // Execute custom transformation
          const customStore = useCustomTransformationsStore.getState();
          const result = customStore.executeTransformation(step.transformId, currentText);
          if (!result.success) {
            return { success: false, error: `Step "${step.name}" failed: ${result.error}` };
          }
          currentText = result.result!;
        }
      } catch (error) {
        return { success: false, error: `Step "${step.name}" failed: ${String(error)}` };
      }
    }

    return { success: true, result: currentText };
  },

  getEnabledChains: () => {
    return get().chains.filter((c) => c.enabled);
  },

  addStep: (chainId, step) => {
    const newStep: ChainStep = {
      ...step,
      id: crypto.randomUUID(),
    };

    set((state) => ({
      chains: state.chains.map((c) =>
        c.id === chainId
          ? { ...c, steps: [...c.steps, newStep], updated_at: new Date().toISOString() }
          : c
      ),
    }));

    get().saveChains();
  },

  removeStep: (chainId, stepId) => {
    set((state) => ({
      chains: state.chains.map((c) =>
        c.id === chainId
          ? { ...c, steps: c.steps.filter((s) => s.id !== stepId), updated_at: new Date().toISOString() }
          : c
      ),
    }));

    get().saveChains();
  },

  reorderSteps: (chainId, stepIds) => {
    set((state) => ({
      chains: state.chains.map((c) => {
        if (c.id !== chainId) return c;
        // Reorder steps based on the new order of IDs
        const stepMap = new Map(c.steps.map((s) => [s.id, s]));
        const reorderedSteps = stepIds
          .map((id) => stepMap.get(id))
          .filter((s): s is ChainStep => s !== undefined);
        return { ...c, steps: reorderedSteps, updated_at: new Date().toISOString() };
      }),
    }));

    get().saveChains();
  },
}));
