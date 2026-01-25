import { useEffect, useRef } from 'react';
import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
import { useSettingsStore } from '../stores/settingsStore';
import { useEditorStore } from '../stores/editorStore';
import { useLicenseStore } from '../stores/licenseStore';

export function useGlobalHotkey() {
  const { settings } = useSettingsStore();
  const { toggleWindow } = useEditorStore();

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

        // Register the hotkey - toggles window visibility (like Spotlight/Raycast)
        // If visible, hides; if hidden, shows
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
  const { pasteAndClose, closeWithoutPaste, setActivePanel, activePanel, transformText, isQuickActionsOpen, toggleQuickActions, saveToFile } = useEditorStore();
  const { isProFeatureEnabled } = useLicenseStore();
  const { settings } = useSettingsStore();
  const lastEscapeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;

      // Escape - handle based on sticky mode and active panel
      if (e.key === 'Escape') {
        e.preventDefault();

        // If on settings/history/snippets/chains: single Escape always closes and returns to editor
        if (activePanel !== 'editor') {
          setActivePanel('editor');
          return;
        }

        // If on editor panel:
        if (settings?.sticky_mode) {
          // Sticky mode: require double-tap Escape to close window (within 300ms)
          const now = Date.now();
          if (now - lastEscapeRef.current < 300) {
            // Double-tap detected - close window
            closeWithoutPaste();
            lastEscapeRef.current = 0;
          } else {
            // First tap - record time
            lastEscapeRef.current = now;
          }
        } else {
          // Normal mode: single Escape closes window
          closeWithoutPaste();
        }
        return;
      }

      // Cmd/Ctrl + Enter - primary action (clipboard or save file)
      if (isMod && e.key === 'Enter') {
        e.preventDefault();
        if (settings?.primary_action === 'save_file') {
          saveToFile();
        } else {
          pasteAndClose();
        }
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
        if (isQuickActionsOpen) {
          // If QA is open, check if search is focused
          const searchInput = document.getElementById('quick-actions-search');
          if (document.activeElement === searchInput) {
            // Search is focused - close the menu
            toggleQuickActions();
          } else {
            // Search is not focused - focus it instead of closing
            searchInput?.focus();
          }
        } else {
          // QA is closed - open it
          toggleQuickActions();
        }
        return;
      }

      // Cmd/Ctrl + N - clear editor
      if (isMod && e.key === 'n') {
        e.preventDefault();
        useEditorStore.getState().clearContent();
        return;
      }

      // Text transformations and other shift shortcuts
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
          case 't':
            e.preventDefault();
            setActivePanel(activePanel === 'customTransformations' ? 'editor' : 'customTransformations');
            break;
          case 'c':
            e.preventDefault();
            setActivePanel(activePanel === 'chains' ? 'editor' : 'chains');
            break;
          case 'f':
            e.preventDefault();
            useEditorStore.getState().toggleFocusMode();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pasteAndClose, closeWithoutPaste, setActivePanel, activePanel, transformText, isProFeatureEnabled, settings?.sticky_mode, settings?.primary_action, isQuickActionsOpen, toggleQuickActions, saveToFile]);
}
