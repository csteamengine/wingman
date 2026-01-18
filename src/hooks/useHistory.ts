import { useEffect, useCallback } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { useEditorStore, type EditorImage } from '../stores/editorStore';
import type { HistoryEntry } from '../types';

export function useHistory() {
  const { entries, loading, searchQuery, loadHistory, searchHistory, deleteEntry, setSearchQuery } =
    useHistoryStore();
  const { setContent, setActivePanel, setImages, clearImages } = useEditorStore();

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);
      searchHistory(query);
    },
    [setSearchQuery, searchHistory]
  );

  const handleSelect = useCallback(
    (entry: HistoryEntry) => {
      setContent(entry.content);
      // Load images if present
      if (entry.images) {
        try {
          const images: EditorImage[] = JSON.parse(entry.images);
          setImages(images);
        } catch {
          clearImages();
        }
      } else {
        clearImages();
      }
      setActivePanel('editor');
    },
    [setContent, setActivePanel, setImages, clearImages]
  );

  const handleDelete = useCallback(
    async (id: number, e?: React.MouseEvent) => {
      if (e) {
        e.stopPropagation();
      }
      await deleteEntry(id);
    },
    [deleteEntry]
  );

  return {
    entries,
    loading,
    searchQuery,
    handleSearch,
    handleSelect,
    handleDelete,
  };
}
