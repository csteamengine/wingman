import { useEffect, useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import {
  Settings,
  Clock,
  Code2,
  Braces,
  Link2,
  Maximize2,
  Minimize2,
  Zap,
  Sparkles,
  Regex,
} from 'lucide-react';
import {
  EditorWindow,
  SettingsPanel,
  HistoryPanel,
  SnippetsPanel,
  QuickActionsPanel,
  TransformationChainsPanel,
  CustomTransformationsPanel,
  CustomAIPromptsPanel,
  RegexPlaygroundPanel,
  LicenseStatusBanner,
  DevModeTierSwitcher,
} from './components';
import { useGlobalHotkey, useKeyboardShortcuts, useSettings, useLicense } from './hooks';
import { useEditorStore } from './stores/editorStore';
import { usePremiumStore } from './stores/premiumStore';

function App() {
  const { settings } = useSettings();
  const { activePanel, setActivePanel, isFocusMode, toggleFocusMode, isQuickActionsOpen, toggleQuickActions } = useEditorStore();
  const { isPremiumFeatureEnabled } = usePremiumStore();

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

  // Apply theme mode - controls vibrancy material, UI styling, and theme-specific colors
  useEffect(() => {
    const lightThemes = ['light', 'solarized-light'];
    const allThemes = ['dark', 'light', 'high-contrast', 'solarized-dark', 'solarized-light', 'dracula', 'nord'];
    const currentTheme = settings?.theme || 'dark';
    const isLightTheme = lightThemes.includes(currentTheme);
    const root = document.documentElement;

    // Remove all theme classes first
    allThemes.forEach(t => root.classList.remove(`theme-${t}`));
    root.classList.remove('theme-light');

    // Apply base light theme class for light themes (for shared light styling)
    if (isLightTheme) {
      root.classList.add('theme-light');
    }

    // Apply specific theme class for theme-specific colors
    root.classList.add(`theme-${currentTheme}`);

    // Update native macOS vibrancy material
    invoke('set_vibrancy_mode', { isDark: !isLightTheme }).catch((err) => {
      console.warn('Failed to update vibrancy mode:', err);
    });
  }, [settings?.theme]);

  // Apply opacity to window - on Linux, this controls background transparency
  // macOS/Windows use native vibrancy instead
  useEffect(() => {
    if (settings?.opacity !== undefined) {
      const isLinux = navigator.platform.includes('Linux');
      if (isLinux) {
        // On Linux, apply background color with opacity directly to the container
        const container = document.querySelector('.editor-container') as HTMLElement;
        if (container) {
          // Get the current theme's base color
          const isDark = !settings?.theme?.includes('light');
          const baseColor = isDark ? '30, 30, 30' : '250, 250, 250';
          container.style.backgroundColor = `rgba(${baseColor}, ${settings.opacity})`;
        }
      }
      // Also set CSS variable for any other uses
      document.documentElement.style.setProperty('--bg-alpha', String(settings.opacity));
    }
  }, [settings?.opacity, settings?.theme]);

  // Native macOS vibrancy is applied at startup in Rust (see lib.rs setup)
  // No frontend call needed - NSVisualEffectView persists through show/hide cycles

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
    await win.startResizeDragging(directionMap[direction] as Parameters<typeof win.startResizeDragging>[0]);
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
        {/* Left side: Settings + History + Snippets + Chains */}
        <div className="flex items-center gap-1">
          {/* Settings cog button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel(activePanel === 'settings' ? 'editor' : 'settings');
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              activePanel === 'settings' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="Settings (Cmd+,)"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* History button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel(activePanel === 'history' ? 'editor' : 'history');
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              activePanel === 'history' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="History (Cmd+H)"
          >
            <Clock className="w-4 h-4" />
          </button>

          {/* Snippets button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel(activePanel === 'snippets' ? 'editor' : 'snippets');
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              activePanel === 'snippets' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="Snippets (Cmd+K)"
          >
            <Code2 className="w-4 h-4" />
          </button>

          {/* Custom Transformations button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel(activePanel === 'customTransformations' ? 'editor' : 'customTransformations');
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              activePanel === 'customTransformations' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="Custom Transformations (Cmd+Shift+T)"
          >
            <Braces className="w-4 h-4" />
          </button>

          {/* Chains button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel(activePanel === 'chains' ? 'editor' : 'chains');
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              activePanel === 'chains' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="Transformation Chains (Cmd+Shift+C)"
          >
            <Link2 className="w-4 h-4" />
          </button>

          {/* Regex Playground button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActivePanel(activePanel === 'regexPlayground' ? 'editor' : 'regexPlayground');
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              activePanel === 'regexPlayground' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="Regex Playground"
          >
            <Regex className="w-4 h-4" />
          </button>

          {/* Custom AI Prompts button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActivePanel(activePanel === 'customAIPrompts' ? 'editor' : 'customAIPrompts');
              }}
              tabIndex={-1}
              className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
                activePanel === 'customAIPrompts' ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
              }`}
              title={isPremiumFeatureEnabled('custom_ai_prompts') ? "Custom AI Prompts" : "Custom AI Prompts (Premium)"}
            >
              <Sparkles className="w-4 h-4" />
            </button>
            {!isPremiumFeatureEnabled('custom_ai_prompts') && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full border border-[var(--ui-surface)]" />
            )}
          </div>
        </div>

        {/* Center dots */}
        <div className="flex items-center gap-1.5 pointer-events-none opacity-40">
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--ui-text-muted)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--ui-text-muted)]" />
          <div className="w-2.5 h-2.5 rounded-full bg-[var(--ui-text-muted)]" />
        </div>

        {/* Right side: Dev tier switcher + Focus + Quick Actions */}
        <div className="flex items-center gap-1">
          {/* Dev mode tier switcher (only visible in dev mode) */}
          <DevModeTierSwitcher />

          {/* Focus mode button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFocusMode();
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              isFocusMode ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="Focus Mode (Cmd+Shift+F)"
          >
            {isFocusMode ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* Quick Actions toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleQuickActions();
            }}
            tabIndex={-1}
            className={`w-8 h-8 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] transition-colors outline-none ${
              isQuickActionsOpen ? 'text-[var(--ui-accent)]' : 'text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
            }`}
            title="Clipboard & Quick Actions"
          >
            <Zap className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* License status banner (shows when in grace period or expired) */}
      <LicenseStatusBanner />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor panel - shown when activePanel is 'editor' */}
        <div
          className={`flex-1 ${activePanel !== 'editor' ? 'hidden' : ''}`}
        >
          <EditorWindow />
        </div>

        {/* Full-width panels (hide editor when shown) */}
        {activePanel === 'settings' && (
          <div className="flex-1">
            <SettingsPanel />
          </div>
        )}

        {activePanel === 'history' && (
          <div className="flex-1">
            <HistoryPanel />
          </div>
        )}

        {activePanel === 'snippets' && (
          <div className="flex-1">
            <SnippetsPanel />
          </div>
        )}

        {activePanel === 'customTransformations' && (
          <div className="flex-1">
            <CustomTransformationsPanel />
          </div>
        )}

        {activePanel === 'chains' && (
          <div className="flex-1">
            <TransformationChainsPanel />
          </div>
        )}

        {activePanel === 'customAIPrompts' && (
          <div className="flex-1">
            <CustomAIPromptsPanel />
          </div>
        )}

        {activePanel === 'regexPlayground' && (
          <div className="flex-1">
            <RegexPlaygroundPanel />
          </div>
        )}

        {/* Quick Actions panel - only shows when editor is active */}
        {isQuickActionsOpen && activePanel === 'editor' && (
          <div className="w-80 border-l border-[var(--ui-border)] flex-shrink-0">
            <QuickActionsPanel />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
