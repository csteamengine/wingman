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
  DevModeTierSwitcher,
} from './components';
import { useGlobalHotkey, useKeyboardShortcuts, useSettings, useLicense } from './hooks';
import { useEditorStore } from './stores/editorStore';

function App() {
  const { settings } = useSettings();
  const { activePanel, setActivePanel } = useEditorStore();

  // Initialize license check
  useLicense();

  // Initialize global hotkey
  useGlobalHotkey();

  // Initialize keyboard shortcuts
  useKeyboardShortcuts();

  // Get openSettingsTab for tray menu navigation
  const { openSettingsTab } = useEditorStore();

  // Listen for open-settings event from tray
  useEffect(() => {
    const unlisten = listen('open-settings', () => {
      setActivePanel('settings');
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [setActivePanel]);

  // Listen for open-hotkeys event from tray
  useEffect(() => {
    const unlisten = listen('open-hotkeys', () => {
      openSettingsTab('hotkeys');
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [openSettingsTab]);

  // Listen for check-updates event from tray
  useEffect(() => {
    const unlisten = listen('check-updates', () => {
      openSettingsTab('license', true);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [openSettingsTab]);

  // Listen for panel-hidden event from Rust (when panel loses focus on macOS)
  useEffect(() => {
    const unlisten = listen('panel-hidden', () => {
      useEditorStore.setState({ isVisible: false });
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);


  // Apply theme class to root element
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(
      'theme-light',
      'theme-dark',
      'theme-high-contrast',
      'theme-solarized-dark',
      'theme-solarized-light',
      'theme-dracula',
      'theme-nord'
    );
    if (settings?.theme && settings.theme !== 'dark') {
      root.classList.add(`theme-${settings.theme}`);
    }
  }, [settings?.theme]);

  // Apply opacity to window
  useEffect(() => {
    if (settings?.opacity !== undefined) {
      document.body.style.opacity = String(settings.opacity);
    }
  }, [settings?.opacity]);

  // Handle window drag - uses native Tauri drag
  const handleTitleBarDrag = useCallback(async (e: React.MouseEvent) => {
    // Only drag if clicking directly on the drag region, not on children
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.window-drag-region')) {
      const win = getCurrentWindow();
      await win.startDragging();
    }
  }, []);

  // Handle resize from corners/edges
  const handleResize = useCallback(async (direction: 'se' | 'sw' | 'ne' | 'nw' | 'n' | 's' | 'e' | 'w') => {
    const win = getCurrentWindow();
    const directionMap: Record<string, string> = {
      'n': 'North', 'ne': 'NorthEast', 'e': 'East', 'se': 'SouthEast',
      's': 'South', 'sw': 'SouthWest', 'w': 'West', 'nw': 'NorthWest'
    };
    await (win as any).startResizeDragging(directionMap[direction]);
  }, []);

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
        className="h-11 flex items-center justify-between px-3 cursor-move select-none rounded-t-[10px]"
        onMouseDown={handleTitleBarDrag}
      >
        {/* Settings cog button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setActivePanel(activePanel === 'settings' ? 'editor' : 'settings');
          }}
          className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--editor-hover)] transition-colors ${
            activePanel === 'settings' ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-muted)] hover:text-[var(--editor-text)]'
          }`}
          title="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* Center dots */}
        <div className="flex items-center gap-1.5 pointer-events-none opacity-40">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--editor-muted)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--editor-muted)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--editor-muted)]" />
        </div>

        {/* Right side: Dev tier switcher + Quick Actions */}
        <div className="flex items-center gap-2">
          {/* Dev mode tier switcher (only visible in dev mode) */}
          <DevModeTierSwitcher />

          {/* Clipboard toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel(activePanel === 'actions' ? 'editor' : 'actions');
            }}
            className={`h-8 px-2 flex items-center gap-1.5 rounded-md hover:bg-[var(--editor-hover)] transition-colors ${
              activePanel === 'actions' ? 'text-[var(--editor-accent)]' : 'text-[var(--editor-muted)] hover:text-[var(--editor-text)]'
            }`}
            title="Toggle Clipboard & Quick Actions"
          >
            {/* Clipboard icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            <span className="text-xs font-medium">Clipboard</span>
          </button>
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
