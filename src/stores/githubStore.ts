import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import type {
  GitHubConfig,
  GitHubAuthStatus,
  DeviceFlowStart,
  GistResult,
  WingmanGist,
} from '../types';

interface GitHubState {
  // Auth
  isAuthenticated: boolean;
  username: string | null;

  // Config
  config: GitHubConfig | null;

  // Loading/Error
  loading: boolean;
  authLoading: boolean;
  gistLoading: boolean;
  error: string | null;

  // Last gist result (for toast)
  lastGistResult: GistResult | null;

  // Actions
  loadAuthStatus: () => Promise<void>;
  startDeviceFlow: () => Promise<DeviceFlowStart | null>;
  pollDeviceFlow: (deviceCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  createGist: (content: string, language: string, description?: string) => Promise<GistResult | null>;
  listWingmanGists: () => Promise<WingmanGist[]>;
  updateGist: (gistId: string, content: string, filename?: string, description?: string) => Promise<GistResult | null>;
  deleteGist: (gistId: string) => Promise<boolean>;
  loadConfig: () => Promise<void>;
  saveConfig: (config: Partial<GitHubConfig>) => Promise<boolean>;
  clearGistResult: () => void;
  clearError: () => void;
  reset: () => void;
}

const defaultState = {
  isAuthenticated: false,
  username: null,
  config: null,
  loading: false,
  authLoading: false,
  gistLoading: false,
  error: null,
  lastGistResult: null,
};

// Map language to file extension
const getFileExtension = (language: string): string => {
  const extensionMap: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    jsx: 'jsx',
    tsx: 'tsx',
    react: 'tsx',
    python: 'py',
    java: 'java',
    go: 'go',
    rust: 'rs',
    c: 'c',
    cpp: 'cpp',
    csharp: 'cs',
    php: 'php',
    ruby: 'rb',
    swift: 'swift',
    kotlin: 'kt',
    html: 'html',
    css: 'css',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    sql: 'sql',
    bash: 'sh',
    markdown: 'md',
    plaintext: 'txt',
  };

  return extensionMap[language] || 'txt';
};

// Generate filename from timestamp and language
const generateFilename = (language: string): string => {
  const ext = getFileExtension(language);
  const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, 15);
  return `gist_${timestamp}.${ext}`;
};

export const useGitHubStore = create<GitHubState>((set, get) => ({
  ...defaultState,

  loadAuthStatus: async () => {
    set({ loading: true, error: null });
    try {
      const status = await invoke<GitHubAuthStatus>('check_github_auth_status');
      set({
        isAuthenticated: status.is_authenticated,
        username: status.username,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load GitHub auth status:', error);
      const errorMessage = String(error);

      // Provide user-friendly error messages
      let friendlyError = errorMessage;
      if (errorMessage.includes('connection') || errorMessage.includes('network')) {
        friendlyError = 'Unable to connect to GitHub. Please check your internet connection.';
      } else if (errorMessage.includes('timeout')) {
        friendlyError = 'Request timed out. Please try again.';
      } else if (errorMessage.includes('revoked')) {
        friendlyError = 'Your GitHub authorization has been revoked. Please re-authorize.';
      }

      set({
        loading: false,
        error: friendlyError,
      });
    }
  },

  startDeviceFlow: async () => {
    set({ authLoading: true, error: null });
    try {
      const flowStart = await invoke<DeviceFlowStart>('start_github_device_flow');
      set({ authLoading: false, error: null });
      return flowStart;
    } catch (error) {
      console.error('Failed to start GitHub device flow:', error);
      const errorMessage = String(error);

      let friendlyError = errorMessage;
      if (errorMessage.includes('Client ID not configured')) {
        friendlyError = 'GitHub integration not properly configured. Please contact support.';
      } else if (errorMessage.includes('connection') || errorMessage.includes('connect')) {
        friendlyError = 'Failed to connect to GitHub. Please check your internet connection.';
      } else if (errorMessage.includes('timeout')) {
        friendlyError = 'Request timed out. Please try again.';
      } else if (!errorMessage.includes('Failed')) {
        friendlyError = `Failed to start authorization: ${errorMessage}`;
      }

      set({
        authLoading: false,
        error: friendlyError,
      });
      return null;
    }
  },

  pollDeviceFlow: async (deviceCode: string) => {
    try {
      const result = await invoke<GitHubAuthStatus | null>('poll_github_device_flow', {
        deviceCode,
      });

      console.log('[GitHub] Poll result:', result);

      if (result) {
        // Authentication successful
        console.log('[GitHub] Authentication successful!', result);
        set({
          isAuthenticated: result.is_authenticated,
          username: result.username,
          authLoading: false,
          error: null,
        });
        return true;
      }

      // Still pending
      console.log('[GitHub] Still pending authorization...');
      return false;
    } catch (error) {
      console.error('[GitHub Store] Poll caught error:', error);
      const errorMessage = String(error);
      console.log('[GitHub Store] Error message string:', errorMessage);
      console.log('[GitHub Store] Contains slow_down?', errorMessage.includes('slow_down'));

      // Re-throw slow_down errors so the modal can adjust its polling interval
      if (errorMessage.includes('slow_down')) {
        console.log('[GitHub Store] Re-throwing slow_down error');
        throw error;
      }

      let friendlyError = errorMessage;
      if (errorMessage.includes('timeout') || errorMessage.includes('expired')) {
        friendlyError = 'Authorization timed out. Please try again.';
      } else if (errorMessage.includes('connection')) {
        friendlyError = 'Connection lost. Please check your internet connection.';
      } else if (!errorMessage.includes('Failed')) {
        friendlyError = `Authorization failed: ${errorMessage}`;
      }

      set({
        authLoading: false,
        error: friendlyError,
      });
      return false;
    }
  },

  logout: async () => {
    set({ loading: true, error: null });
    try {
      await invoke('logout_github');
      set({
        ...defaultState,
        loading: false,
        error: null, // Clear any errors on successful logout
      });
    } catch (error) {
      console.error('Failed to logout from GitHub:', error);
      const errorMessage = String(error);
      set({
        loading: false,
        error: `Failed to logout: ${errorMessage}`,
      });
    }
  },

  createGist: async (content: string, language: string, description?: string) => {
    const { config } = get();

    // Validate content before sending
    if (!content || !content.trim()) {
      const errorMsg = 'Cannot create gist: content is empty';
      set({ error: errorMsg, gistLoading: false });
      return null;
    }

    // Check content size (10MB limit)
    const contentSizeBytes = new Blob([content]).size;
    const maxSizeBytes = 10 * 1024 * 1024; // 10MB
    if (contentSizeBytes > maxSizeBytes) {
      const sizeMB = (contentSizeBytes / (1024 * 1024)).toFixed(2);
      const errorMsg = `Content is too large (${sizeMB} MB). Maximum size is 10 MB.`;
      set({ error: errorMsg, gistLoading: false });
      return null;
    }

    set({ gistLoading: true, error: null, lastGistResult: null });
    try {
      const filename = generateFilename(language);
      const gistDescription = description || `Wingman gist created on ${new Date().toLocaleString()}`;
      const isPublic = config?.default_public ?? false;

      console.log('[GitHub] Creating gist with config:', config);
      console.log('[GitHub] isPublic value:', isPublic);

      const result = await invoke<GistResult>('create_github_gist', {
        content,
        filename,
        description: gistDescription,
        isPublic,
      });

      set({
        gistLoading: false,
        error: null,
        lastGistResult: result,
      });

      // Auto-copy URL to clipboard if enabled
      if (config?.auto_copy_url && result.html_url) {
        try {
          await writeText(result.html_url);
        } catch (err) {
          console.warn('Failed to copy gist URL to clipboard:', err);
          // Don't fail the whole operation if clipboard fails
        }
      }

      return result;
    } catch (error) {
      console.error('Failed to create GitHub gist:', error);
      const errorMessage = String(error);

      // Provide user-friendly error messages
      let friendlyError = errorMessage;
      if (errorMessage.includes('Not authenticated')) {
        friendlyError = 'Not authenticated with GitHub. Please authorize in Settings.';
      } else if (errorMessage.includes('revoked')) {
        friendlyError = 'Your GitHub authorization has been revoked. Please re-authorize in Settings.';
      } else if (errorMessage.includes('rate limit')) {
        friendlyError = 'GitHub rate limit reached. Please try again in a few minutes.';
      } else if (errorMessage.includes('connection') || errorMessage.includes('network')) {
        friendlyError = 'Failed to connect to GitHub. Please check your internet connection.';
      } else if (errorMessage.includes('timeout')) {
        friendlyError = 'Request timed out. Please try again.';
      } else if (errorMessage.includes('too large')) {
        friendlyError = errorMessage; // Use the specific size error
      } else if (errorMessage.includes('Client ID not configured')) {
        friendlyError = 'GitHub integration not configured. Please contact support.';
      } else if (errorMessage.includes('forbidden') || errorMessage.includes('permissions')) {
        friendlyError = 'Permission denied. Your GitHub token may lack gist permissions.';
      } else if (!errorMessage.includes('Failed')) {
        // Wrap raw errors in a more user-friendly message
        friendlyError = `Failed to create gist: ${errorMessage}`;
      }

      set({
        gistLoading: false,
        error: friendlyError,
        lastGistResult: null,
      });
      return null;
    }
  },

  listWingmanGists: async () => {
    set({ loading: true, error: null });
    try {
      const gists = await invoke<WingmanGist[]>('list_wingman_gists');
      set({ loading: false, error: null });
      return gists;
    } catch (error) {
      const errorMessage = String(error);
      set({ loading: false, error: `Failed to load gists: ${errorMessage}` });
      return [];
    }
  },

  updateGist: async (gistId: string, content: string, filename?: string, description?: string) => {
    if (!content.trim()) {
      set({ error: 'Cannot sync gist: content is empty' });
      return null;
    }

    set({ gistLoading: true, error: null });
    try {
      const result = await invoke<GistResult>('update_github_gist', {
        gistId,
        content,
        filename: filename ?? null,
        description: description ?? null,
      });
      set({ gistLoading: false, error: null, lastGistResult: result });
      return result;
    } catch (error) {
      const errorMessage = String(error);
      set({ gistLoading: false, error: `Failed to sync gist: ${errorMessage}` });
      return null;
    }
  },

  deleteGist: async (gistId: string) => {
    set({ gistLoading: true, error: null });
    try {
      await invoke('delete_github_gist', { gistId });
      set({ gistLoading: false, error: null });
      return true;
    } catch (error) {
      const errorMessage = String(error);
      set({ gistLoading: false, error: `Failed to delete gist: ${errorMessage}` });
      return false;
    }
  },

  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const config = await invoke<GitHubConfig>('get_github_config');
      set({
        config,
        isAuthenticated: config.is_authenticated,
        username: config.username,
        loading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to load GitHub config:', error);
      set({
        loading: false,
        error: String(error),
      });
    }
  },

  saveConfig: async (partialConfig: Partial<GitHubConfig>) => {
    const { config } = get();
    if (!config) {
      set({ error: 'No config loaded' });
      return false;
    }

    set({ loading: true, error: null });
    try {
      const updatedConfig: GitHubConfig = {
        ...config,
        ...partialConfig,
      };

      console.log('[GitHub] Saving config:', updatedConfig);
      await invoke('save_github_config', { config: updatedConfig });

      set({
        config: updatedConfig,
        loading: false,
        error: null,
      });

      return true;
    } catch (error) {
      console.error('Failed to save GitHub config:', error);
      set({
        loading: false,
        error: String(error),
      });
      return false;
    }
  },

  clearGistResult: () => {
    set({ lastGistResult: null });
  },

  clearError: () => {
    set({ error: null });
  },

  reset: () => {
    set(defaultState);
  },
}));
