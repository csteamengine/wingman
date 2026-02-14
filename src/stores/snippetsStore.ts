import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GitHubConfig, Snippet, SnippetsData, WingmanGist } from '../types';

interface SnippetsState {
  snippets: Snippet[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  loadSnippets: () => Promise<void>;
  addSnippet: (name: string, content: string, tags?: string[]) => Promise<Snippet | null>;
  addSnippetLinkedToGist: (
    name: string,
    content: string,
    gistId: string,
    gistUrl: string,
    gistFilename?: string | null,
    tags?: string[],
    githubSource?: string
  ) => Promise<Snippet | null>;
  updateSnippet: (id: string, name: string, content: string, tags: string[]) => Promise<void>;
  deleteSnippet: (id: string) => Promise<void>;
  createGistFromSnippet: (id: string) => Promise<boolean>;
  syncSnippetToGitHub: (id: string) => Promise<boolean>;
  importWingmanGists: () => Promise<number>;
  disconnectSnippetFromGitHub: (id: string) => Promise<boolean>;
  setSearchQuery: (query: string) => void;
  getFilteredSnippets: () => Snippet[];
  exportSnippets: () => SnippetsData;
  importSnippets: (data: SnippetsData) => Promise<void>;
}

const sanitizeFilename = (name: string): string => {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${base || 'wingman_snippet'}.txt`;
};

const nowIso = (): string => new Date().toISOString();

export const useSnippetsStore = create<SnippetsState>((set, get) => ({
  snippets: [],
  loading: false,
  error: null,
  searchQuery: '',

  loadSnippets: async () => {
    set({ loading: true, error: null });
    try {
      const data = await invoke<SnippetsData>('get_snippets');
      set({ snippets: data.snippets, loading: false });
    } catch (error) {
      console.error('Failed to load snippets:', error);
      set({ loading: false, error: String(error) });
    }
  },

  addSnippet: async (name: string, content: string, tags: string[] = []) => {
    try {
      const snippet = await invoke<Snippet>('add_snippet', { name, content, tags });
      set((state) => ({
        snippets: [...state.snippets, snippet],
      }));
      return snippet;
    } catch (error) {
      console.error('Failed to add snippet:', error);
      set({ error: String(error) });
      return null;
    }
  },

  addSnippetLinkedToGist: async (
    name: string,
    content: string,
    gistId: string,
    gistUrl: string,
    gistFilename?: string | null,
    tags: string[] = [],
    githubSource = 'wingman'
  ) => {
    const snippet = await get().addSnippet(name, content, tags);
    if (!snippet) return null;

    try {
      await invoke('set_snippet_github_info', {
        id: snippet.id,
        gistId,
        gistUrl,
        gistFilename: gistFilename ?? null,
        githubSource,
      });
      const syncedAt = nowIso();
      const linkedSnippet: Snippet = {
        ...snippet,
        github_gist_id: gistId,
        github_gist_url: gistUrl,
        github_gist_filename: gistFilename ?? null,
        github_synced_at: syncedAt,
        github_source: githubSource,
        updated_at: syncedAt,
      };
      set((state) => ({
        snippets: state.snippets.map((s) => (s.id === snippet.id ? linkedSnippet : s)),
      }));
      return linkedSnippet;
    } catch (error) {
      console.error('Failed to link snippet to gist:', error);
      set({ error: String(error) });
      return snippet;
    }
  },

  updateSnippet: async (id: string, name: string, content: string, tags: string[]) => {
    try {
      await invoke('update_snippet', { id, name, content, tags });
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id ? { ...s, name, content, tags, updated_at: nowIso() } : s
        ),
      }));
    } catch (error) {
      console.error('Failed to update snippet:', error);
      set({ error: String(error) });
    }
  },

  deleteSnippet: async (id: string) => {
    const snippet = get().snippets.find((s) => s.id === id);
    if (!snippet) return;

    try {
      if (snippet.github_gist_id) {
        await invoke('delete_github_gist', { gistId: snippet.github_gist_id });
      }
      await invoke('delete_snippet', { id });
      set((state) => ({
        snippets: state.snippets.filter((s) => s.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete snippet:', error);
      set({ error: String(error) });
    }
  },

  createGistFromSnippet: async (id: string) => {
    const snippet = get().snippets.find((s) => s.id === id);
    if (!snippet) return false;

    try {
      const config = await invoke<GitHubConfig>('get_github_config');
      const filename = snippet.github_gist_filename || sanitizeFilename(snippet.name);
      const result = await invoke<{ gist_id: string; html_url: string }>('create_github_gist', {
        content: snippet.content,
        filename,
        description: `Wingman snippet: ${snippet.name}`,
        isPublic: config.default_public,
      });

      await invoke('set_snippet_github_info', {
        id: snippet.id,
        gistId: result.gist_id,
        gistUrl: result.html_url,
        gistFilename: filename,
        githubSource: 'wingman',
      });

      const syncedAt = nowIso();
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id
            ? {
                ...s,
                github_gist_id: result.gist_id,
                github_gist_url: result.html_url,
                github_gist_filename: filename,
                github_synced_at: syncedAt,
                github_source: 'wingman',
                updated_at: syncedAt,
              }
            : s
        ),
      }));
      return true;
    } catch (error) {
      console.error('Failed to create gist from snippet:', error);
      set({ error: String(error) });
      return false;
    }
  },

  syncSnippetToGitHub: async (id: string) => {
    const snippet = get().snippets.find((s) => s.id === id);
    if (!snippet) return false;

    if (!snippet.github_gist_id) {
      return get().createGistFromSnippet(id);
    }

    try {
      const filename = snippet.github_gist_filename || sanitizeFilename(snippet.name);
      const result = await invoke<{ html_url: string }>('update_github_gist', {
        gistId: snippet.github_gist_id,
        content: snippet.content,
        filename,
        description: `Wingman snippet: ${snippet.name}`,
      });

      await invoke('set_snippet_github_info', {
        id: snippet.id,
        gistId: snippet.github_gist_id,
        gistUrl: result.html_url,
        gistFilename: filename,
        githubSource: snippet.github_source || 'wingman',
      });

      const syncedAt = nowIso();
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id
            ? {
                ...s,
                github_gist_url: result.html_url,
                github_gist_filename: filename,
                github_synced_at: syncedAt,
                updated_at: syncedAt,
              }
            : s
        ),
      }));
      return true;
    } catch (error) {
      console.error('Failed to sync snippet to GitHub:', error);
      set({ error: String(error) });
      return false;
    }
  },

  importWingmanGists: async () => {
    try {
      const gists = await invoke<WingmanGist[]>('list_wingman_gists');
      if (!gists.length) return 0;

      const existing = get().snippets;
      let importedCount = 0;
      const nextSnippets = [...existing];

      for (const gist of gists) {
        const existingByGist = nextSnippets.find((s) => s.github_gist_id === gist.gist_id);
        const syncedAt = nowIso();
        if (existingByGist) {
          Object.assign(existingByGist, {
            content: gist.content,
            github_gist_url: gist.html_url,
            github_gist_filename: gist.filename,
            github_synced_at: syncedAt,
            github_source: existingByGist.github_source || 'wingman',
            updated_at: syncedAt,
          });
          continue;
        }

        const added = await invoke<Snippet>('add_snippet', {
          name: gist.filename.replace(/\.[^.]+$/, ''),
          content: gist.content,
          tags: ['github', 'wingman'],
        });

        await invoke('set_snippet_github_info', {
          id: added.id,
          gistId: gist.gist_id,
          gistUrl: gist.html_url,
          gistFilename: gist.filename,
          githubSource: 'wingman',
        });

        nextSnippets.push({
          ...added,
          github_gist_id: gist.gist_id,
          github_gist_url: gist.html_url,
          github_gist_filename: gist.filename,
          github_synced_at: syncedAt,
          github_source: 'wingman',
          updated_at: syncedAt,
        });
        importedCount += 1;
      }

      set({ snippets: nextSnippets });
      return importedCount;
    } catch (error) {
      console.error('Failed to import Wingman gists:', error);
      set({ error: String(error) });
      return 0;
    }
  },

  disconnectSnippetFromGitHub: async (id: string) => {
    const snippet = get().snippets.find((s) => s.id === id);
    if (!snippet || !snippet.github_gist_id) return false;

    try {
      await invoke('delete_github_gist', { gistId: snippet.github_gist_id });
      await invoke('clear_snippet_github_info', { id });
      set((state) => ({
        snippets: state.snippets.map((s) =>
          s.id === id
            ? {
                ...s,
                github_gist_id: null,
                github_gist_url: null,
                github_gist_filename: null,
                github_synced_at: null,
                github_source: null,
                updated_at: nowIso(),
              }
            : s
        ),
      }));
      return true;
    } catch (error) {
      console.error('Failed to disconnect snippet from GitHub:', error);
      set({ error: String(error) });
      return false;
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  getFilteredSnippets: () => {
    const { snippets, searchQuery } = get();
    if (!searchQuery.trim()) return snippets;

    const query = searchQuery.toLowerCase();
    return snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.content.toLowerCase().includes(query) ||
        s.tags.some((t) => t.toLowerCase().includes(query))
    );
  },

  exportSnippets: () => {
    return { snippets: get().snippets };
  },

  importSnippets: async (data: SnippetsData) => {
    try {
      await invoke('save_snippets_data', { data });
      set({ snippets: data.snippets });
    } catch (error) {
      console.error('Failed to import snippets:', error);
      set({ error: String(error) });
    }
  },
}));
