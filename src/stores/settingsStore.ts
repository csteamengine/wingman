import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings } from '../types';

interface SettingsState {
  settings: AppSettings | null;
  loading: boolean;
  error: string | null;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const DEFAULT_LANGUAGE_HOTKEYS = [
  'markdown',    // Cmd+0
  'plaintext',   // Cmd+1
  'javascript',  // Cmd+2
  'typescript',  // Cmd+3
  'python',      // Cmd+4
  'json',        // Cmd+5
  'html',        // Cmd+6
  'css',         // Cmd+7
  'sql',         // Cmd+8
  'bash',        // Cmd+9
];

const defaultSettings: AppSettings = {
  hotkey: navigator.platform.includes('Mac') ? 'Command+Shift+Space' : 'Control+Shift+Space',
  theme: 'dark',
  font_family: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
  font_size: 14,
  opacity: 0.95,
  tab_size: 4,
  line_wrap: true,
  line_numbers: false,
  show_status_bar: true,
  max_history_entries: 100,
  auto_save_drafts: true,
  launch_at_login: false,
  default_language: 'markdown',
  window_position: { x: 100, y: 100, width: 650, height: 450 },
  sticky_mode: false,
  show_diff_preview: false,
  primary_action: 'clipboard',
  export_action: 'save_file',
  show_dev_tier_selector: true,
  colorblind_mode: false,
  auto_detect_language: true,
  last_quick_actions_tab: 'clipboard',
  language_hotkeys: DEFAULT_LANGUAGE_HOTKEYS,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings, // Start with defaults immediately
  loading: false,
  error: null,

  loadSettings: async () => {
    // Don't set loading to true - we already have defaults
    try {
      const settings = await invoke<AppSettings>('get_settings');
      set({ settings, loading: false, error: null });
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Keep using defaults, just log the error
      set({ error: String(error) });
    }
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    const current = get().settings || defaultSettings;
    const updated = { ...current, ...newSettings };

    set({ settings: updated });

    try {
      await invoke('update_settings', { settings: updated });

      // If sticky mode changed, update the panel behavior (macOS only)
      if ('sticky_mode' in newSettings && navigator.platform.includes('Mac')) {
        try {
          await invoke('update_panel_behavior', { stickyMode: updated.sticky_mode });
        } catch (error) {
          console.error('Failed to update panel behavior:', error);
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      set({ error: String(error) });
    }
  },

  resetToDefaults: async () => {
    set({ settings: defaultSettings });
    try {
      await invoke('update_settings', { settings: defaultSettings });

      // Reset panel behavior to default (macOS only)
      if (navigator.platform.includes('Mac')) {
        try {
          await invoke('update_panel_behavior', { stickyMode: defaultSettings.sticky_mode });
        } catch (error) {
          console.error('Failed to update panel behavior:', error);
        }
      }
    } catch (error) {
      console.error('Failed to reset settings:', error);
      set({ error: String(error) });
    }
  },
}));
