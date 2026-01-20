import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type {
  SubscriptionStatus,
  UsageStats,
  AIResponse,
  ObsidianConfig,
  ObsidianResult,
  AIConfig,
  PremiumFeature,
  AIPreset,
  AIPresetsConfig,
} from '../types';
import { DEFAULT_AI_PRESETS } from '../data/aiPresets';

// Token limit for Premium tier
const MONTHLY_TOKEN_LIMIT = 1_000_000;

interface PremiumState {
  // Subscription status
  subscriptionStatus: SubscriptionStatus | null;
  usageStats: UsageStats | null;
  obsidianConfig: ObsidianConfig | null;
  aiConfig: AIConfig | null;
  aiPresets: AIPreset[];

  // Loading states
  loading: boolean;
  aiLoading: boolean;
  error: string | null;

  // Obsidian toast state
  lastObsidianResult: ObsidianResult | null;

  // Derived state helpers
  isPremium: boolean;
  isSubscriptionActive: boolean;
  tokenUsagePercent: number;
  isNearTokenLimit: boolean;
  isAtTokenLimit: boolean;

  // Actions
  loadSubscriptionStatus: (licenseKey: string) => Promise<void>;
  loadUsageStats: (licenseKey: string) => Promise<void>;
  loadObsidianConfig: () => Promise<void>;
  saveObsidianConfig: (config: ObsidianConfig) => Promise<boolean>;
  validateObsidianVault: (vaultPath: string) => Promise<boolean>;
  loadAIConfig: () => Promise<void>;
  saveAIConfig: (config: AIConfig) => Promise<boolean>;
  loadAIPresets: () => Promise<void>;
  saveAIPresets: (presets: AIPreset[]) => Promise<boolean>;
  togglePresetEnabled: (presetId: string) => Promise<void>;
  getEnabledPresets: () => AIPreset[];
  callAIFeature: (licenseKey: string, prompt: string, feature: string) => Promise<AIResponse | null>;
  callAIWithPreset: (licenseKey: string, prompt: string, preset: AIPreset) => Promise<AIResponse | null>;
  addToObsidian: (content: string) => Promise<ObsidianResult | null>;
  openObsidianNote: (openUri: string) => Promise<void>;
  clearObsidianResult: () => void;
  isPremiumFeatureEnabled: (feature: PremiumFeature) => boolean;
  reset: () => void;
}

const defaultState = {
  subscriptionStatus: null,
  usageStats: null,
  obsidianConfig: null,
  aiConfig: null,
  aiPresets: DEFAULT_AI_PRESETS,
  loading: false,
  aiLoading: false,
  error: null,
  lastObsidianResult: null,
  isPremium: false,
  isSubscriptionActive: false,
  tokenUsagePercent: 0,
  isNearTokenLimit: false,
  isAtTokenLimit: false,
};

export const usePremiumStore = create<PremiumState>((set, get) => ({
  ...defaultState,

  loadSubscriptionStatus: async (licenseKey: string) => {
    if (!licenseKey) {
      set({ ...defaultState });
      return;
    }

    set({ loading: true, error: null });
    try {
      const status = await invoke<SubscriptionStatus>('validate_premium_license_cmd', {
        licenseKey,
      });

      const tokensUsed = status.tokens_used || 0;
      const tokensRemaining = status.tokens_remaining || 0;
      const tokenUsagePercent = Math.round((tokensUsed / MONTHLY_TOKEN_LIMIT) * 100);

      set({
        subscriptionStatus: status,
        isPremium: status.tier === 'premium',
        isSubscriptionActive: status.is_active,
        tokenUsagePercent,
        isNearTokenLimit: tokenUsagePercent >= 80,
        isAtTokenLimit: tokensRemaining <= 0,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load subscription status:', error);
      set({
        ...defaultState,
        loading: false,
        error: String(error),
      });
    }
  },

  loadUsageStats: async (licenseKey: string) => {
    if (!licenseKey) return;

    try {
      const stats = await invoke<UsageStats>('get_ai_usage_cmd', { licenseKey });

      const tokenUsagePercent = Math.round((stats.tokens_used / MONTHLY_TOKEN_LIMIT) * 100);

      set({
        usageStats: stats,
        tokenUsagePercent,
        isNearTokenLimit: tokenUsagePercent >= 80,
        isAtTokenLimit: stats.tokens_remaining <= 0,
      });
    } catch (error) {
      console.error('Failed to load usage stats:', error);
    }
  },

  loadObsidianConfig: async () => {
    try {
      const config = await invoke<ObsidianConfig>('get_obsidian_config');
      set({ obsidianConfig: config });
    } catch (error) {
      console.error('Failed to load Obsidian config:', error);
      // Set default config on error
      set({
        obsidianConfig: {
          vault_path: '',
          default_location: 'daily_note',
          specific_note_path: null,
          new_note_folder: null,
          template: null,
        },
      });
    }
  },

  saveObsidianConfig: async (config: ObsidianConfig) => {
    try {
      await invoke('configure_obsidian', { config });
      set({ obsidianConfig: config, error: null });
      return true;
    } catch (error) {
      console.error('Failed to save Obsidian config:', error);
      set({ error: String(error) });
      return false;
    }
  },

  loadAIConfig: async () => {
    try {
      const config = await invoke<AIConfig>('get_ai_config');
      set({ aiConfig: config });
    } catch (error) {
      console.error('Failed to load AI config:', error);
      // Set default config on error
      set({
        aiConfig: {
          system_instructions: 'You are an expert at refining text for AI prompts. Take the user\'s stream of consciousness or rough notes and transform them into clear, well-structured prompts optimized for Claude Code or other AI assistants. Focus on clarity, specificity, and actionable instructions.',
        },
      });
    }
  },

  saveAIConfig: async (config: AIConfig) => {
    try {
      await invoke('configure_ai', { config });
      set({ aiConfig: config, error: null });
      return true;
    } catch (error) {
      console.error('Failed to save AI config:', error);
      set({ error: String(error) });
      return false;
    }
  },

  loadAIPresets: async () => {
    try {
      const config = await invoke<AIPresetsConfig>('get_ai_presets');
      // Merge saved presets with defaults (to handle new presets added in updates)
      const savedPresets = config.presets || [];
      const mergedPresets = DEFAULT_AI_PRESETS.map(defaultPreset => {
        const savedPreset = savedPresets.find(p => p.id === defaultPreset.id);
        if (savedPreset) {
          // Use saved enabled state but keep other defaults updated
          return { ...defaultPreset, enabled: savedPreset.enabled };
        }
        return defaultPreset;
      });
      set({ aiPresets: mergedPresets });
    } catch (error) {
      console.error('Failed to load AI presets:', error);
      // Fall back to defaults on error
      set({ aiPresets: DEFAULT_AI_PRESETS });
    }
  },

  saveAIPresets: async (presets: AIPreset[]) => {
    try {
      await invoke('save_ai_presets_cmd', { config: { presets } });
      set({ aiPresets: presets, error: null });
      return true;
    } catch (error) {
      console.error('Failed to save AI presets:', error);
      set({ error: String(error) });
      return false;
    }
  },

  togglePresetEnabled: async (presetId: string) => {
    const { aiPresets, saveAIPresets } = get();
    const updatedPresets = aiPresets.map(preset =>
      preset.id === presetId ? { ...preset, enabled: !preset.enabled } : preset
    );
    await saveAIPresets(updatedPresets);
  },

  getEnabledPresets: () => {
    return get().aiPresets.filter(preset => preset.enabled);
  },

  callAIWithPreset: async (licenseKey: string, prompt: string, preset: AIPreset) => {
    if (!licenseKey || !prompt.trim()) {
      set({ error: 'License key and prompt are required' });
      return null;
    }

    set({ aiLoading: true, error: null });

    try {
      const response = await invoke<AIResponse>('call_ai_feature_cmd', {
        licenseKey,
        prompt,
        feature: 'prompt_optimizer',
        systemInstructions: preset.systemPrompt,
      });

      // Update token usage after successful call
      const currentStatus = get().subscriptionStatus;
      if (currentStatus) {
        const newTokensUsed = MONTHLY_TOKEN_LIMIT - response.tokens_remaining;
        const tokenUsagePercent = Math.round((newTokensUsed / MONTHLY_TOKEN_LIMIT) * 100);

        set({
          subscriptionStatus: {
            ...currentStatus,
            tokens_used: newTokensUsed,
            tokens_remaining: response.tokens_remaining,
          },
          tokenUsagePercent,
          isNearTokenLimit: tokenUsagePercent >= 80,
          isAtTokenLimit: response.tokens_remaining <= 0,
          aiLoading: false,
        });
      } else {
        set({ aiLoading: false });
      }

      return response;
    } catch (error) {
      console.error('AI feature call failed:', error);
      set({ aiLoading: false, error: String(error) });
      return null;
    }
  },

  validateObsidianVault: async (vaultPath: string) => {
    try {
      const isValid = await invoke<boolean>('validate_obsidian_vault_cmd', { vaultPath });
      return isValid;
    } catch (error) {
      console.error('Obsidian vault validation failed:', error);
      set({ error: String(error) });
      return false;
    }
  },

  callAIFeature: async (licenseKey: string, prompt: string, feature: string) => {
    if (!licenseKey || !prompt.trim()) {
      set({ error: 'License key and prompt are required' });
      return null;
    }

    set({ aiLoading: true, error: null });

    try {
      // Ensure AI config is loaded before making the call
      let { aiConfig } = get();
      if (!aiConfig) {
        // Load config from disk if not already loaded
        try {
          const config = await invoke<AIConfig>('get_ai_config');
          set({ aiConfig: config });
          aiConfig = config;
        } catch (e) {
          console.warn('Failed to load AI config, using default:', e);
        }
      }
      const systemInstructions = aiConfig?.system_instructions;

      const response = await invoke<AIResponse>('call_ai_feature_cmd', {
        licenseKey,
        prompt,
        feature,
        systemInstructions,
      });

      // Update token usage after successful call
      const currentStatus = get().subscriptionStatus;
      if (currentStatus) {
        const newTokensUsed = MONTHLY_TOKEN_LIMIT - response.tokens_remaining;
        const tokenUsagePercent = Math.round((newTokensUsed / MONTHLY_TOKEN_LIMIT) * 100);

        set({
          subscriptionStatus: {
            ...currentStatus,
            tokens_used: newTokensUsed,
            tokens_remaining: response.tokens_remaining,
          },
          tokenUsagePercent,
          isNearTokenLimit: tokenUsagePercent >= 80,
          isAtTokenLimit: response.tokens_remaining <= 0,
          aiLoading: false,
        });
      } else {
        set({ aiLoading: false });
      }

      return response;
    } catch (error) {
      console.error('AI feature call failed:', error);
      set({ aiLoading: false, error: String(error) });
      return null;
    }
  },

  addToObsidian: async (content: string) => {
    if (!content.trim()) {
      set({ error: 'Content cannot be empty' });
      return null;
    }

    try {
      const result = await invoke<ObsidianResult>('add_to_obsidian', { content });
      set({ lastObsidianResult: result, error: null });
      return result;
    } catch (error) {
      console.error('Failed to add to Obsidian:', error);
      set({ error: String(error), lastObsidianResult: null });
      return null;
    }
  },

  openObsidianNote: async (openUri: string) => {
    try {
      await invoke('open_url', { url: openUri });
    } catch (error) {
      console.error('Failed to open Obsidian note:', error);
    }
  },

  clearObsidianResult: () => {
    set({ lastObsidianResult: null });
  },

  isPremiumFeatureEnabled: (feature: PremiumFeature) => {
    const { isPremium, isSubscriptionActive, isAtTokenLimit } = get();

    // Must be Premium tier with active subscription
    if (!isPremium || !isSubscriptionActive) {
      return false;
    }

    // For AI features, also check token limit
    if (feature === 'prompt_optimizer' || feature === 'ai_features') {
      return !isAtTokenLimit;
    }

    // Obsidian integration is available as long as subscription is active
    return true;
  },

  reset: () => {
    set({ ...defaultState });
  },
}));

// Helper hook for formatting token usage
export function formatTokenUsage(tokensUsed: number, _tokensRemaining: number): string {
  const total = MONTHLY_TOKEN_LIMIT;
  const usedFormatted = tokensUsed.toLocaleString();
  const totalFormatted = total.toLocaleString();
  const percent = Math.round((tokensUsed / total) * 100);

  return `${usedFormatted} / ${totalFormatted} (${percent}% used)`;
}

// Helper to get reset date message
export function getResetDateMessage(resetsAt: string): string {
  return `Resets on ${resetsAt}`;
}
