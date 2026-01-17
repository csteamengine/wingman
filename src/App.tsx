import { useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import {
  EditorWindow,
  SettingsPanel,
  HistoryPanel,
  SnippetsPanel,
  QuickActionsPanel,
  LicenseStatusBanner,
} from './components';
import { useGlobalHotkey, useKeyboardShortcuts, useSettings, useLicense } from './hooks';
import { useEditorStore } from './stores/editorStore';

function App() {
  const { settings } = useSettings();
  const { activePanel, setActivePanel, closeWithoutPaste } = useEditorStore();

  // Initialize license check
  useLicense();

  // Initialize global hotkey
  useGlobalHotkey();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Listen for open-settings event from tray
  useEffect(() => {
    const unlisten = listen('open-settings', () => {
      setActivePanel('settings');
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [setActivePanel]);

  // Listen for panel-hidden event from Rust (when panel loses focus on macOS)
  // This syncs the frontend isVisible state with the actual panel visibility
  useEffect(() => {
    const unlisten = listen('panel-hidden', () => {
      useEditorStore.setState({ isVisible: false });
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // Close window when clicking outside (window loses focus)
  useEffect(() => {
    const window = getCurrentWindow();
    const unlisten = window.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        // Window lost focus - hide it but keep content
        closeWithoutPaste();
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [closeWithoutPaste]);


  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme classes
    root.classList.remove(
      'theme-light',
      'theme-dark',
      'theme-high-contrast',
      'theme-solarized-dark',
      'theme-solarized-light',
      'theme-dracula',
      'theme-nord'
    );
    // Add the current theme class (dark is default/no class needed)
    if (settings?.theme && settings.theme !== 'dark') {
      root.classList.add(`theme-${settings.theme}`);
    }
  }, [settings?.theme]);

  // Apply opacity to window
  useEffect(() => {
    if (settings?.opacity) {
      document.body.style.setProperty('--window-opacity', String(settings.opacity));
    }
  }, [settings?.opacity]);

  // Handle window drag
  const handleDragStart = useCallback(async (e: React.MouseEvent) => {
    // Only drag if clicking directly on the drag region, not on children
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.window-drag-region')) {
      const window = getCurrentWindow();
      await window.startDragging();
    }
  }, []);

  // Handle resize from corners/edges
  const handleResize = useCallback(async (direction: 'se' | 'sw' | 'ne' | 'nw' | 'n' | 's' | 'e' | 'w') => {
    const win = getCurrentWindow();
    // Tauri 2.x uses startResizeDragging with ResizeDirection enum values
    const directionMap: Record<string, string> = {
      'n': 'North', 'ne': 'NorthEast', 'e': 'East', 'se': 'SouthEast',
      's': 'South', 'sw': 'SouthWest', 'w': 'West', 'nw': 'NorthWest'
    };
    await (win as any).startResizeDragging(directionMap[direction]);
  }, []);

  // Don't block on loading - show the app immediately

  return (
    <div className="h-screen w-screen flex flex-col editor-container relative">
      {/* Resize handles */}
      <div
        className="absolute top-0 left-0 right-0 h-1 cursor-n-resize z-50"
        onMouseDown={() => handleResize('n')}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1 cursor-s-resize z-50"
        onMouseDown={() => handleResize('s')}
      />
      <div
        className="absolute top-0 bottom-0 left-0 w-1 cursor-w-resize z-50"
        onMouseDown={() => handleResize('w')}
      />
      <div
        className="absolute top-0 bottom-0 right-0 w-1 cursor-e-resize z-50"
        onMouseDown={() => handleResize('e')}
      />
      <div
        className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-50 rounded-tl-xl"
        onMouseDown={() => handleResize('nw')}
      />
      <div
        className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-50 rounded-tr-xl"
        onMouseDown={() => handleResize('ne')}
      />
      <div
        className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-50 rounded-bl-xl"
        onMouseDown={() => handleResize('sw')}
      />
      <div
        className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-50 rounded-br-xl"
        onMouseDown={() => handleResize('se')}
      />

      {/* Title bar / drag region */}
      <div
        className="h-11 flex items-center justify-center cursor-move select-none rounded-t-[10px]"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center gap-1.5 pointer-events-none opacity-40">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--editor-muted)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--editor-muted)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--editor-muted)]" />
        </div>
      </div>

      {/* License status banner (shows when in grace period or expired) */}
      <LicenseStatusBanner />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor panel */}
        <div
          className={`flex-1 ${
            activePanel !== 'editor' && activePanel !== 'actions' ? 'hidden' : ''
          }`}
        >
          <EditorWindow />
        </div>

        {/* Side panels */}
        {activePanel === 'settings' && (
          <div className="w-full">
            <SettingsPanel />
          </div>
        )}

        {activePanel === 'history' && (
          <div className="w-full">
            <HistoryPanel />
          </div>
        )}

        {activePanel === 'snippets' && (
          <div className="w-full">
            <SnippetsPanel />
          </div>
        )}

        {activePanel === 'actions' && (
          <div className="w-80 border-l border-[var(--editor-border)]">
            <QuickActionsPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
