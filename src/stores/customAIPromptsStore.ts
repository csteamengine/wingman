import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { CustomAIPrompt, CustomAIPromptsData } from '../types';

interface CustomAIPromptsState {
  prompts: CustomAIPrompt[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  loadPrompts: () => Promise<void>;
  addPrompt: (name: string, description: string, systemPrompt: string) => Promise<CustomAIPrompt | null>;
  updatePrompt: (id: string, name: string, description: string, systemPrompt: string, enabled: boolean) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  togglePromptEnabled: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  getFilteredPrompts: () => CustomAIPrompt[];
  getEnabledPrompts: () => CustomAIPrompt[];
  exportPrompts: () => CustomAIPromptsData;
  importPrompts: (data: CustomAIPromptsData) => Promise<void>;
}

export const useCustomAIPromptsStore = create<CustomAIPromptsState>((set, get) => ({
  prompts: [],
  loading: false,
  error: null,
  searchQuery: '',

  loadPrompts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invoke<CustomAIPromptsData>('get_custom_ai_prompts');
      set({ prompts: data.prompts, loading: false });
    } catch (error) {
      console.error('Failed to load custom AI prompts:', error);
      set({ loading: false, error: String(error) });
    }
  },

  addPrompt: async (name: string, description: string, systemPrompt: string) => {
    try {
      const prompt = await invoke<CustomAIPrompt>('add_custom_ai_prompt', {
        name,
        description,
        systemPrompt
      });
      set((state) => ({
        prompts: [...state.prompts, prompt],
      }));
      return prompt;
    } catch (error) {
      console.error('Failed to add custom AI prompt:', error);
      set({ error: String(error) });
      return null;
    }
  },

  updatePrompt: async (id: string, name: string, description: string, systemPrompt: string, enabled: boolean) => {
    try {
      await invoke('update_custom_ai_prompt', { id, name, description, systemPrompt, enabled });
      set((state) => ({
        prompts: state.prompts.map((p) =>
          p.id === id
            ? { ...p, name, description, system_prompt: systemPrompt, enabled, updated_at: new Date().toISOString() }
            : p
        ),
      }));
    } catch (error) {
      console.error('Failed to update custom AI prompt:', error);
      set({ error: String(error) });
    }
  },

  deletePrompt: async (id: string) => {
    try {
      await invoke('delete_custom_ai_prompt', { id });
      set((state) => ({
        prompts: state.prompts.filter((p) => p.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete custom AI prompt:', error);
      set({ error: String(error) });
    }
  },

  togglePromptEnabled: async (id: string) => {
    try {
      await invoke('toggle_custom_ai_prompt_enabled', { id });
      set((state) => ({
        prompts: state.prompts.map((p) =>
          p.id === id ? { ...p, enabled: !p.enabled } : p
        ),
      }));
    } catch (error) {
      console.error('Failed to toggle custom AI prompt:', error);
      set({ error: String(error) });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  getFilteredPrompts: () => {
    const { prompts, searchQuery } = get();
    if (!searchQuery.trim()) return prompts;

    const query = searchQuery.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.system_prompt.toLowerCase().includes(query)
    );
  },

  getEnabledPrompts: () => {
    return get().prompts.filter((p) => p.enabled);
  },

  exportPrompts: () => {
    return { prompts: get().prompts };
  },

  importPrompts: async (data: CustomAIPromptsData) => {
    try {
      await invoke('save_custom_ai_prompts_data', { data });
      set({ prompts: data.prompts });
    } catch (error) {
      console.error('Failed to import custom AI prompts:', error);
      set({ error: String(error) });
    }
  },
}));
