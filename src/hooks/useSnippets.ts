import { useEffect, useCallback } from 'react';
import { useSnippetsStore } from '../stores/snippetsStore';
import { useEditorStore } from '../stores/editorStore';
import type { Snippet } from '../types';

export function useSnippets() {
  const {
    snippets,
    loading,
    searchQuery,
    loadSnippets,
    addSnippet,
    updateSnippet,
    deleteSnippet,
    createGistFromSnippet,
    syncSnippetToGitHub,
    importWingmanGists,
    disconnectSnippetFromGitHub,
    addSnippetLinkedToGist,
    setSearchQuery,
    getFilteredSnippets,
  } = useSnippetsStore();
  const { content, setContent, setActivePanel, startSnippetEditSession } = useEditorStore();

  useEffect(() => {
    loadSnippets();
  }, [loadSnippets]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
    },
    [setSearchQuery]
  );

  const handleInsert = useCallback(
    (snippet: Snippet) => {
      setContent(content + snippet.content);
      setActivePanel('editor');
    },
    [content, setContent, setActivePanel]
  );

  const handleSaveCurrentAsSnippet = useCallback(
    async (name: string, snippetContent?: string, tags: string[] = []) => {
      const contentToSave = snippetContent ?? content;
      if (!contentToSave.trim()) return null;
      return await addSnippet(name, contentToSave, tags);
    },
    [content, addSnippet]
  );

  const handleUpdate = useCallback(
    async (id: string, name: string, snippetContent: string, tags: string[]) => {
      await updateSnippet(id, name, snippetContent, tags);
    },
    [updateSnippet]
  );

  const handleDelete = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      await deleteSnippet(id);
    },
    [deleteSnippet]
  );

  const handleEditInEditor = useCallback(
    (snippet: Snippet) => {
      startSnippetEditSession(snippet);
      setActivePanel('editor');
    },
    [setActivePanel, startSnippetEditSession]
  );

  return {
    snippets: getFilteredSnippets(),
    allSnippets: snippets,
    loading,
    searchQuery,
    handleSearch,
    handleInsert,
    handleEditInEditor,
    handleSaveCurrentAsSnippet,
    handleUpdate,
    handleDelete,
    createGistFromSnippet,
    syncSnippetToGitHub,
    importWingmanGists,
    disconnectSnippetFromGitHub,
    addSnippetLinkedToGist,
  };
}
