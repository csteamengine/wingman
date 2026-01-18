import { useEffect, useCallback } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';
import { useLicenseStore } from '../stores/licenseStore';

export function useGlobalHotkey() {
  const { settings } = useSettingsStore();
  const { showWindow, isVisible, hideWindow } = useEditorStore();

  const toggleWindow = useCallback(async () => {
    if (isVisible) {
      await hideWindow();
    } else {
      await showWindow();
    }
  }, [isVisible, showWindow, hideWindow]);

  useEffect(() => {
    if (!settings?.hotkey) return;

    const shortcut = settings.hotkey;
    let registered = false;

    const setupHotkey = async () => {
      try {
        // Check if already registered
        const alreadyRegistered = await isRegistered(shortcut);
        if (alreadyRegistered) {
          await unregister(shortcut);
        }

        // Register the hotkey
        await register(shortcut, (event) => {
          if (event.state === 'Pressed') {
            toggleWindow();
          }
        });
        registered = true;
        console.log(`Hotkey registered: ${shortcut}`);
      } catch (error) {
        console.error('Failed to register hotkey:', error);
      }
    };

    setupHotkey();

    return () => {
      if (registered) {
        unregister(shortcut).catch(console.error);
      }
    };
  }, [settings?.hotkey, toggleWindow]);
}

export function useKeyboardShortcuts() {
  const { pasteAndClose, closeWithoutPaste, setActivePanel, activePanel, transformText } = useEditorStore();
  const { isProFeatureEnabled } = useLicenseStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Escape - close window (from editor or actions), or go back to actions from other panels
      if (e.key === 'Escape') {
        e.preventDefault();
        if (activePanel === 'editor' || activePanel === 'actions') {
          closeWithoutPaste();
        } else {
          // From settings/history/snippets, go back to actions (default panel)
          setActivePanel('actions');
        }
        return;
      }

      // Cmd/Ctrl + Enter - paste and close
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        pasteAndClose();
        return;
      }

      // Cmd/Ctrl + , - open settings
      if (isMod && e.key === ',') {
        e.preventDefault();
        setActivePanel(activePanel === 'settings' ? 'editor' : 'settings');
        return;
      }

      // Cmd/Ctrl + H - toggle history (Pro feature)
      if (isMod && e.key === 'h') {
        e.preventDefault();
        // Still toggle to the panel - the panel itself will show upgrade prompt if not Pro
        setActivePanel(activePanel === 'history' ? 'editor' : 'history');
        return;
      }

      // Cmd/Ctrl + K - toggle snippets (Pro feature)
      if (isMod && e.key === 'k') {
        e.preventDefault();
        // Still toggle to the panel - the panel itself will show upgrade prompt if not Pro
        setActivePanel(activePanel === 'snippets' ? 'editor' : 'snippets');
        return;
      }

      // Cmd/Ctrl + Shift + A - quick actions
      if (isMod && e.shiftKey && e.key === 'a') {
        e.preventDefault();
        if (activePanel === 'actions') {
          // If QA is open, check if search is focused
          const searchInput = document.getElementById('quick-actions-search');
          if (document.activeElement === searchInput) {
            // Search is focused - close the menu
            setActivePanel('editor');
          } else {
            // Search is not focused - focus it instead of closing
            searchInput?.focus();
          }
        } else {
          // QA is closed - open it
          setActivePanel('actions');
        }
        return;
      }

      // Cmd/Ctrl + N - clear editor
      if (isMod && e.key === 'n') {
        e.preventDefault();
        useEditorStore.getState().clearContent();
        return;
      }

      // Text transformations
      if (isMod && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'u':
            e.preventDefault();
            transformText('uppercase');
            break;
          case 'l':
            e.preventDefault();
            transformText('lowercase');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pasteAndClose, closeWithoutPaste, setActivePanel, activePanel, transformText, isProFeatureEnabled]);
}
