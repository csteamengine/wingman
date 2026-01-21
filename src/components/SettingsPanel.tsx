import {useState, useEffect} from 'react';
import {open} from '@tauri-apps/plugin-shell';
import {invoke} from '@tauri-apps/api/core';
import {useSettings} from '../hooks/useSettings';
import {useEditorStore} from '../stores/editorStore';
import {useLicenseStore} from '../stores/licenseStore';
import {LicenseActivation} from './LicenseActivation';
import {ObsidianConfig} from './ObsidianConfig';
import {ProBadge} from './ProFeatureGate';
import type {ThemeType} from '../types';

const THEMES: { value: ThemeType; label: string; isPro: boolean }[] = [
    {value: 'dark', label: 'Dark', isPro: false},
    {value: 'light', label: 'Light', isPro: false},
    {value: 'high-contrast', label: 'High Contrast', isPro: false},
    {value: 'solarized-dark', label: 'Solarized Dark', isPro: true},
    {value: 'solarized-light', label: 'Solarized Light', isPro: true},
    {value: 'dracula', label: 'Dracula', isPro: true},
    {value: 'nord', label: 'Nord', isPro: true},
];

const FONT_FAMILIES = [
    'JetBrains Mono, monospace',
    'Fira Code, monospace',
    'SF Mono, monospace',
    'Monaco, monospace',
    'Menlo, monospace',
    'Consolas, monospace',
    'Courier New, monospace',
];

interface UpdateInfo {
    current_version: string;
    latest_version: string;
    has_update: boolean;
    release_url: string;
    release_notes: string | null;
    download_url: string | null;
}

type TabType = 'settings' | 'hotkeys' | 'license';

export function SettingsPanel() {
    const {settings, handleUpdate, handleReset} = useSettings();
    const {setActivePanel, initialSettingsTab, shouldCheckUpdates, clearSettingsNavigation} = useEditorStore();
    const {isProFeatureEnabled} = useLicenseStore();
    const [activeTab, setActiveTab] = useState<TabType>('settings');
    const [hotkeyInput, setHotkeyInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [appVersion, setAppVersion] = useState<string>('');
    const [obsidianExpanded, setObsidianExpanded] = useState(false);

    const hasCustomThemes = isProFeatureEnabled('custom_themes');
    const hasFontCustomization = isProFeatureEnabled('font_customization');
    const hasOpacityControl = isProFeatureEnabled('opacity_control');
    const hasStickyMode = isProFeatureEnabled('sticky_mode');
    const hasStatsDisplay = isProFeatureEnabled('stats_display');
    const hasObsidianAccess = isProFeatureEnabled('obsidian_integration');

    // Get app version on mount
    useEffect(() => {
        invoke<string>('get_app_version').then(setAppVersion).catch(console.error);
    }, []);

    // Handle navigation from tray menu (open specific tab or check updates)
    useEffect(() => {
        if (initialSettingsTab) {
            setActiveTab(initialSettingsTab);
        }
        if (shouldCheckUpdates) {
            // Always go to license tab when checking updates, and trigger the check
            setActiveTab('license');
            // Use setTimeout to ensure state update happens first
            setTimeout(() => checkForUpdates(), 0);
        }
        // Clear the navigation flags after handling
        if (initialSettingsTab || shouldCheckUpdates) {
            clearSettingsNavigation();
        }
    }, [initialSettingsTab, shouldCheckUpdates, clearSettingsNavigation]);

    const checkForUpdates = async () => {
        setIsCheckingUpdate(true);
        setUpdateError(null);
        try {
            const info = await invoke<UpdateInfo>('check_for_app_updates');
            setUpdateInfo(info);
        } catch (err) {
            setUpdateError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsCheckingUpdate(false);
        }
    };

    const openDownloadUrl = async () => {
        const url = updateInfo?.download_url || updateInfo?.release_url;
        if (url) {
            await open(url);
        }
    };

    useEffect(() => {
        if (settings) {
            setHotkeyInput(settings.hotkey);
        }
    }, [settings]);

    // Record hotkey when user presses keys
    useEffect(() => {
        if (!isRecording) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const parts: string[] = [];

            // Modifiers (use Command for macOS, Control for others)
            if (e.metaKey) parts.push('Command');
            if (e.ctrlKey) parts.push('Control');
            if (e.altKey) parts.push('Alt');
            if (e.shiftKey) parts.push('Shift');

            // Main key (exclude modifier-only presses)
            const key = e.key;
            if (!['Meta', 'Control', 'Alt', 'Shift'].includes(key)) {
                // Convert key to proper format
                let keyName = key.toUpperCase();
                if (key === ' ') keyName = 'Space';
                else if (key.length === 1) keyName = key.toUpperCase();
                parts.push(keyName);

                // Only set if we have at least one modifier + a key
                if (parts.length >= 2) {
                    const hotkey = parts.join('+');
                    setHotkeyInput(hotkey);
                    setIsRecording(false);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isRecording]);

    if (!settings) return <div className="p-4">Loading...</div>;

    const saveHotkey = () => {
        if (hotkeyInput && hotkeyInput !== settings.hotkey) {
            handleUpdate({hotkey: hotkeyInput});
        }
    };

    return (
        <div className="flex flex-col h-full animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
                <h2 className="text-sm font-medium text-[var(--editor-text)]">Settings</h2>
                <button
                    onClick={() => setActivePanel('editor')}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--editor-hover)] text-[var(--editor-muted)] hover:text-[var(--editor-text)] transition-colors"
                    aria-label="Close settings"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8"/>
                    </svg>
                </button>
            </div>

            {/* Centered Tab Navigation */}
            <div className="border-b border-[var(--editor-border)] px-4 pt-3">
                <div className="flex items-center justify-center gap-1">
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                            activeTab === 'settings'
                                ? 'text-[var(--editor-text)] bg-[var(--editor-surface)]'
                                : 'text-[var(--editor-muted)] hover:text-[var(--editor-text)] hover:bg-[var(--editor-hover)]'
                        }`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('hotkeys')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                            activeTab === 'hotkeys'
                                ? 'text-[var(--editor-text)] bg-[var(--editor-surface)]'
                                : 'text-[var(--editor-muted)] hover:text-[var(--editor-text)] hover:bg-[var(--editor-hover)]'
                        }`}
                    >
                        Hotkeys
                    </button>
                    <button
                        onClick={() => setActiveTab('license')}
                        className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                            activeTab === 'license'
                                ? 'text-[var(--editor-text)] bg-[var(--editor-surface)]'
                                : 'text-[var(--editor-muted)] hover:text-[var(--editor-text)] hover:bg-[var(--editor-hover)]'
                        }`}
                    >
                        License & Updates
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-4">
                {/* Settings Tab */}
                {activeTab === 'settings' && (
                    <div className="space-y-5">
                        {/* Theme Selection - Grid */}
                        <div>
                            <label className="block text-sm font-medium mb-3">Theme</label>
                            <div className="grid grid-cols-2 gap-2">
                                {THEMES.map((theme) => {
                                    const isDisabled = theme.isPro && !hasCustomThemes;
                                    const isSelected = settings.theme === theme.value;
                                    return (
                                        <button
                                            key={theme.value}
                                            onClick={() => !isDisabled && handleUpdate({theme: theme.value})}
                                            disabled={isDisabled}
                                            className={`px-3 py-2.5 text-sm rounded-md border transition-colors text-left ${
                                                isSelected
                                                    ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/10 text-[var(--editor-text)]'
                                                    : isDisabled
                                                    ? 'border-[var(--editor-border)] bg-[var(--editor-surface)]/50 text-[var(--editor-muted)] opacity-50 cursor-not-allowed'
                                                    : 'border-[var(--editor-border)] bg-[var(--editor-surface)] text-[var(--editor-text)] hover:border-[var(--editor-accent)]/50'
                                            }`}
                                        >
                                            {theme.label}
                                            {theme.isPro && !hasCustomThemes && (
                                                <span className="ml-1.5 text-xs text-[var(--editor-accent)]">PRO</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Font Family - Pro */}
                        <div>
                            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                Font Family
                                {!hasFontCustomization && <ProBadge />}
                            </label>
                            <select
                                value={settings.font_family}
                                onChange={(e) => handleUpdate({font_family: e.target.value})}
                                disabled={!hasFontCustomization}
                                className={`w-full px-3 py-2 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-md text-[var(--editor-text)] focus:outline-none focus:border-[var(--editor-accent)] ${
                                    !hasFontCustomization ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                            >
                                {FONT_FAMILIES.map((font) => (
                                    <option key={font} value={font}>
                                        {font.split(',')[0]}
                                    </option>
                                ))}
                                {!FONT_FAMILIES.includes(settings.font_family) && (
                                    <option value={settings.font_family}>
                                        {settings.font_family.split(',')[0]} (Custom)
                                    </option>
                                )}
                            </select>
                        </div>

                        {/* Font Size and Opacity - Side by Side - Pro */}
                        <div className="grid grid-cols-2 gap-4">
                            {/* Font Size - Pro */}
                            <div>
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    Font Size
                                    {!hasFontCustomization && <ProBadge />}
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="10"
                                        max="24"
                                        value={settings.font_size}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val >= 10 && val <= 24) {
                                                handleUpdate({font_size: val});
                                            }
                                        }}
                                        disabled={!hasFontCustomization}
                                        className={`w-full px-3 py-2 pr-8 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-md text-[var(--editor-text)] focus:outline-none focus:border-[var(--editor-accent)] ${
                                            !hasFontCustomization ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--editor-muted)]">px</span>
                                </div>
                            </div>

                            {/* Opacity - Pro */}
                            <div>
                                <label className="block text-sm font-medium mb-2 flex items-center gap-2">
                                    Opacity: {Math.round(settings.opacity * 100)}%
                                    {!hasOpacityControl && <ProBadge />}
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="1"
                                    step="0.05"
                                    value={settings.opacity}
                                    onChange={(e) => handleUpdate({opacity: parseFloat(e.target.value)})}
                                    disabled={!hasOpacityControl}
                                    className={`w-full ${!hasOpacityControl ? 'opacity-50 cursor-not-allowed' : ''}`}
                                />
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="space-y-3">
                            {/* Stats Bar - Pro */}
                            <div className={`flex items-center justify-between py-2 ${!hasStatsDisplay ? 'opacity-60' : ''}`}>
                                <div className="flex-1">
                                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--editor-text)]">
                                        Show Stats Bar
                                        {!hasStatsDisplay && <ProBadge />}
                                    </label>
                                    <p className="text-xs text-[var(--editor-muted)] mt-0.5">Display character, word, and line counts</p>
                                </div>
                                <button
                                    onClick={() => hasStatsDisplay && handleUpdate({show_status_bar: !settings.show_status_bar})}
                                    disabled={!hasStatsDisplay}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                        settings.show_status_bar ? 'bg-[var(--editor-accent)]' : 'bg-[var(--editor-border)]'
                                    } ${!hasStatsDisplay ? 'cursor-not-allowed' : ''}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                            settings.show_status_bar ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Sticky Mode - Pro */}
                            <div className={`flex items-center justify-between py-2 ${!hasStickyMode ? 'opacity-60' : ''}`}>
                                <div className="flex-1">
                                    <label className="flex items-center gap-2 text-sm font-medium text-[var(--editor-text)]">
                                        Sticky Window Mode
                                        {!hasStickyMode && <ProBadge />}
                                    </label>
                                    <p className="text-xs text-[var(--editor-muted)] mt-0.5">
                                        Prevent auto-hide on focus loss{settings.sticky_mode ? ' • Double-tap Esc to close' : ''}
                                    </p>
                                </div>
                                <button
                                    onClick={() => hasStickyMode && handleUpdate({sticky_mode: !settings.sticky_mode})}
                                    disabled={!hasStickyMode}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                        settings.sticky_mode ? 'bg-[var(--editor-accent)]' : 'bg-[var(--editor-border)]'
                                    } ${!hasStickyMode ? 'cursor-not-allowed' : ''}`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                            settings.sticky_mode ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Launch at Login */}
                            <div className="flex items-center justify-between py-2">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-[var(--editor-text)]">Launch at Login</label>
                                    <p className="text-xs text-[var(--editor-muted)] mt-0.5">Start Wingman when you log in</p>
                                </div>
                                <button
                                    onClick={() => handleUpdate({launch_at_login: !settings.launch_at_login})}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                                        settings.launch_at_login ? 'bg-[var(--editor-accent)]' : 'bg-[var(--editor-border)]'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                                            settings.launch_at_login ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* Obsidian Integration - Pro feature - Collapsible */}
                        {hasObsidianAccess && (
                            <div className="pt-3 border-t border-[var(--editor-border)]">
                                <button
                                    onClick={() => setObsidianExpanded(!obsidianExpanded)}
                                    className="w-full flex items-center justify-between py-2 text-sm font-medium text-[var(--editor-text)] hover:text-[var(--editor-accent)] transition-colors"
                                >
                                    <span>Obsidian Integration</span>
                                    <svg
                                        className={`w-4 h-4 transition-transform ${obsidianExpanded ? 'rotate-180' : ''}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                {obsidianExpanded && (
                                    <div className="mt-3">
                                        <ObsidianConfig />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Reset Button */}
                        <div className="pt-4 border-t border-[var(--editor-border)]">
                            <button
                                onClick={handleReset}
                                className="px-3 py-2 text-sm text-red-400 hover:text-red-300 border border-red-400/30 rounded-md hover:bg-red-500/10 transition-colors"
                            >
                                Reset to Defaults
                            </button>
                        </div>
                    </div>
                )}

                {/* Hotkeys Tab */}
                {activeTab === 'hotkeys' && (
                    <div className="space-y-6">
                        {/* Global Hotkey */}
                        <div>
                            <label className="block text-sm font-medium mb-2">Global Hotkey</label>
                            <p className="text-xs text-[var(--editor-muted)] mb-3">
                                Press this keyboard shortcut anywhere to summon Wingman
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={hotkeyInput}
                                    readOnly
                                    placeholder="Click Record to set hotkey"
                                    className="flex-1 px-3 py-2 text-sm bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-md text-[var(--editor-text)] placeholder:text-[var(--editor-muted)]"
                                />
                                <button
                                    onClick={() => setIsRecording(!isRecording)}
                                    className={`px-4 py-2 text-sm rounded-md transition-colors ${
                                        isRecording
                                            ? 'bg-[var(--editor-accent)] text-white'
                                            : 'bg-[var(--editor-surface)] text-[var(--editor-text)] hover:bg-[var(--editor-hover)]'
                                    }`}
                                >
                                    {isRecording ? 'Recording...' : 'Record'}
                                </button>
                                <button
                                    onClick={saveHotkey}
                                    disabled={hotkeyInput === settings.hotkey}
                                    className="px-4 py-2 text-sm bg-[var(--editor-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                                >
                                    Save
                                </button>
                            </div>
                            {isRecording && (
                                <p className="text-xs text-[var(--editor-accent)] mt-2">
                                    Press any key combination...
                                </p>
                            )}
                        </div>

                        {/* Built-in Shortcuts */}
                        <div>
                            <h3 className="text-sm font-medium mb-3">Built-in Shortcuts</h3>
                            <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">Paste and Close</span>
                                    <span className="kbd">⌘↵</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">Close Window</span>
                                    <span className="kbd">Esc</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">Open Settings</span>
                                    <span className="kbd">⌘,</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">Quick Actions</span>
                                    <span className="kbd">⌘⇧A</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">History</span>
                                    <span className="kbd">⌘H</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">Snippets</span>
                                    <span className="kbd">⌘K</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">Clear Editor</span>
                                    <span className="kbd">⌘N</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">Find/Replace</span>
                                    <span className="kbd">⌘F</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">UPPERCASE</span>
                                    <span className="kbd">⌘⇧U</span>
                                </div>
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md">
                                    <span className="text-[var(--editor-text)]">lowercase</span>
                                    <span className="kbd">⌘⇧L</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* License & Updates Tab */}
                {activeTab === 'license' && (
                    <div className="space-y-6">
                        {/* License Activation */}
                        <div>
                            <h3 className="text-sm font-medium mb-3">License Activation</h3>
                            <LicenseActivation />
                        </div>

                        {/* Updates */}
                        <div className="pt-6 border-t border-[var(--editor-border)]">
                            <h3 className="text-sm font-medium mb-3">Updates</h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between py-2 px-3 bg-[var(--editor-surface)] rounded-md text-sm">
                                    <span className="text-[var(--editor-muted)]">Current Version</span>
                                    <span className="text-[var(--editor-text)] font-medium">{appVersion || 'Loading...'}</span>
                                </div>

                                <button
                                    onClick={checkForUpdates}
                                    disabled={isCheckingUpdate}
                                    className="w-full px-4 py-2 text-sm bg-[var(--editor-accent)] text-white rounded-md hover:opacity-90 disabled:opacity-60 transition-opacity"
                                >
                                    {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                                </button>

                                {updateError && (
                                    <div className="px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
                                        {updateError}
                                    </div>
                                )}

                                {updateInfo && (
                                    <div className={`px-3 py-3 text-sm rounded-md border ${
                                        updateInfo.has_update
                                            ? 'bg-green-500/10 border-green-500/20 text-green-400'
                                            : 'bg-[var(--editor-surface)] border-[var(--editor-border)] text-[var(--editor-text)]'
                                    }`}>
                                        {updateInfo.has_update ? (
                                            <div className="space-y-2">
                                                <p className="font-medium">Update Available: v{updateInfo.latest_version}</p>
                                                {updateInfo.release_notes && (
                                                    <p className="text-xs opacity-80">{updateInfo.release_notes}</p>
                                                )}
                                                <button
                                                    onClick={openDownloadUrl}
                                                    className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                                >
                                                    Download Update
                                                </button>
                                            </div>
                                        ) : (
                                            <p>You're up to date!</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
