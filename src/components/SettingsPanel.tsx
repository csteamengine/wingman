import {useState, useEffect} from 'react';
import {invoke} from '@tauri-apps/api/core';
import {open} from '@tauri-apps/plugin-shell';
import {useSettings} from '../hooks/useSettings';
import {useEditorStore} from '../stores/editorStore';
import {useLicenseStore} from '../stores/licenseStore';
import {usePremiumStore, formatTokenUsage} from '../stores/premiumStore';
import {LicenseActivation} from './LicenseActivation';
import {ObsidianConfig} from './ObsidianConfig';
import {AIConfig as AIConfigComponent} from './AIConfig';
import type {ThemeType} from '../types';

const SUPABASE_URL = 'https://yhpetdqcmqpfwhdtbhat.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_t4l4DUhI_I2rpT9pMU8dgg_Y2j55oJY';

interface UpdateInfo {
    current_version: string;
    latest_version: string;
    has_update: boolean;
    release_url: string;
    release_notes: string | null;
    download_url: string | null;
}

const THEMES: { value: ThemeType; label: string; isPro: boolean }[] = [
    {value: 'dark', label: 'Dark', isPro: false},
    {value: 'light', label: 'Light', isPro: false},
    {value: 'high-contrast', label: 'High Contrast', isPro: false},
    {value: 'solarized-dark', label: 'Solarized Dark', isPro: true},
    {value: 'solarized-light', label: 'Solarized Light', isPro: true},
    {value: 'dracula', label: 'Dracula', isPro: true},
    {value: 'nord', label: 'Nord', isPro: true},
];

export function SettingsPanel() {
    const {settings, handleUpdate, handleReset} = useSettings();
    const {setActivePanel} = useEditorStore();
    const {isProFeatureEnabled, tier, status} = useLicenseStore();
    const [hotkeyInput, setHotkeyInput] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [appVersion, setAppVersion] = useState<string>('');

    const hasCustomThemes = isProFeatureEnabled('custom_themes');

    // Get app version on mount
    useEffect(() => {
        invoke<string>('get_app_version').then(setAppVersion).catch(console.error);
    }, []);

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
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--editor-border)]">
                <h2 className="text-sm font-medium text-[var(--editor-text)]">Settings</h2>
                <button
                    onClick={() => setActivePanel('editor')}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--editor-hover)] text-[var(--editor-muted)] hover:text-[var(--editor-text)] transition-colors"
                    aria-label="Close settings"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
                         strokeLinecap="round">
                        <path d="M2 2l8 8M10 2l-8 8"/>
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <div className="space-y-6">
                    {/* Hotkey Configuration */}
                    <div>
                        <label className="block text-sm font-medium mb-2">Global Hotkey</label>
                        <p className="text-xs text-[var(--editor-muted)] mb-3">
                            Press this keyboard shortcut anywhere to summon Wingman
                        </p>

                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={isRecording ? 'Press keys...' : hotkeyInput}
                                    readOnly
                                    className={`input w-full ${isRecording ? 'ring-2 ring-[var(--editor-accent)]' : ''}`}
                                    placeholder="Command+Shift+Space"
                                />
                            </div>
                            <button
                                onClick={() => setIsRecording(!isRecording)}
                                className={`btn px-3 ${isRecording ? 'bg-[var(--editor-accent)] text-white' : ''}`}
                            >
                                {isRecording ? 'Cancel' : 'Record'}
                            </button>
                        </div>

                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={saveHotkey}
                                disabled={hotkeyInput === settings.hotkey}
                                className="btn bg-[var(--editor-accent)] text-white disabled:opacity-50"
                            >
                                Save Hotkey
                            </button>
                            <button
                                onClick={() => setHotkeyInput(settings.hotkey)}
                                disabled={hotkeyInput === settings.hotkey}
                                className="btn disabled:opacity-50"
                            >
                                Reset
                            </button>
                        </div>
                    </div>

                    {/* Hotkey Examples */}
                    <div className="text-xs text-[var(--editor-muted)] space-y-1">
                        <p className="font-medium text-[var(--editor-text)]">Example hotkeys:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Command+Shift+Space (macOS)</li>
                            <li>Control+Shift+Space (Windows/Linux)</li>
                            <li>Command+Shift+N</li>
                            <li>Control+Alt+Q</li>
                        </ul>
                    </div>

                    {/* Theme Selection */}
                    <div className="mt-6 pt-6 border-t border-[var(--editor-border)]">
                        <label className="block text-sm font-medium mb-2">Theme</label>
                        <div className="grid grid-cols-2 gap-2">
                            {THEMES.map((theme) => {
                                const isDisabled = theme.isPro && !hasCustomThemes;
                                const isSelected = settings?.theme === theme.value;
                                return (
                                    <button
                                        key={theme.value}
                                        onClick={() => !isDisabled && handleUpdate({theme: theme.value})}
                                        disabled={isDisabled}
                                        className={`px-3 py-2 text-sm rounded-md border transition-all ${
                                            isSelected
                                                ? 'border-[var(--editor-accent)] bg-[var(--editor-accent)]/10 text-[var(--editor-accent)]'
                                                : 'border-[var(--editor-border)] hover:border-[var(--editor-muted)]'
                                        } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <span>{theme.label}</span>
                                        {theme.isPro && !hasCustomThemes && (
                                            <span className="ml-1 text-xs text-[var(--editor-muted)]">Pro</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {!hasCustomThemes && (
                            <p className="text-xs text-[var(--editor-muted)] mt-2">
                                Upgrade to Pro to unlock custom themes
                            </p>
                        )}
                    </div>

                    {/* Keyboard Shortcuts */}
                    <div className="mt-6">
                        <p className="text-sm font-medium mb-3">Keyboard Shortcuts</p>

                        {/* Editor shortcuts */}
                        <div className="mb-4">
                            <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">Editor</p>
                            <div className="space-y-1.5">
                                <ShortcutRow keys="Cmd/Ctrl + Enter" description="Copy to clipboard & close"/>
                                <ShortcutRow keys="Escape" description="Close panel or window (keeps text)"/>
                                <ShortcutRow keys="Cmd/Ctrl + N" description="Clear editor"/>
                            </div>
                        </div>

                        {/* Navigation shortcuts */}
                        <div className="mb-4">
                            <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">Navigation</p>
                            <div className="space-y-1.5">
                                <ShortcutRow keys="Cmd/Ctrl + ," description="Open settings"/>
                                <ShortcutRow keys="Cmd/Ctrl + H" description="Toggle history panel"/>
                                <ShortcutRow keys="Cmd/Ctrl + K" description="Toggle snippets panel"/>
                                <ShortcutRow keys="Cmd/Ctrl + Shift + A" description="Quick actions menu"/>
                            </div>
                        </div>

                        {/* Text transform shortcuts */}
                        <div className="mb-4">
                            <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">Text
                                Transforms</p>
                            <div className="space-y-1.5">
                                <ShortcutRow keys="Cmd/Ctrl + Shift + U" description="Transform to UPPERCASE"/>
                                <ShortcutRow keys="Cmd/Ctrl + Shift + L" description="Transform to lowercase"/>
                            </div>
                        </div>

                        {/* List navigation */}
                        <div>
                            <p className="text-xs font-medium text-[var(--editor-muted)] mb-2 uppercase tracking-wide">History
                                & Snippets Panels</p>
                            <div className="space-y-1.5">
                                <ShortcutRow keys="↑ / ↓" description="Navigate through items"/>
                                <ShortcutRow keys="Enter" description="Select item"/>
                                <ShortcutRow keys="Type" description="Focus search and filter"/>
                            </div>
                        </div>
                    </div>

                    {/* License Section */}
                    <div className="mt-6 pt-6 border-t border-[var(--editor-border)]">
                        <p className="text-sm font-medium mb-4">License</p>
                        <LicenseActivation/>
                    </div>

                    {/* Premium Section */}
                    <PremiumSection/>

                    {/* Updates Section */}
                    <div className="mt-6 pt-6 border-t border-[var(--editor-border)]">
                        <p className="text-sm font-medium mb-2">Updates</p>
                        <p className="text-xs text-[var(--editor-muted)] mb-3">
                            Current version: {appVersion || 'Loading...'}
                        </p>

                        <button
                            onClick={checkForUpdates}
                            disabled={isCheckingUpdate}
                            className="btn bg-[var(--editor-surface)] hover:bg-[var(--editor-border)] disabled:opacity-50"
                        >
                            {isCheckingUpdate ? 'Checking...' : 'Check for Updates'}
                        </button>

                        {updateError && (
                            <p className="text-xs text-red-400 mt-2">{updateError}</p>
                        )}

                        {updateInfo && !updateError && (
                            <div
                                className="mt-3 p-3 rounded-md bg-[var(--editor-surface)] border border-[var(--editor-border)]">
                                {updateInfo.has_update ? (
                                    <>
                                        <p className="text-sm text-green-400 mb-2">
                                            Update available: {updateInfo.latest_version}
                                        </p>
                                        <button
                                            onClick={openDownloadUrl}
                                            className="btn bg-[var(--editor-accent)] text-white text-sm"
                                        >
                                            Download Update
                                        </button>
                                    </>
                                ) : (
                                    <p className="text-sm text-[var(--editor-muted)]">
                                        You're running the latest version
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="px-4 py-3 border-t border-[var(--editor-border)] rounded-b-[10px]">
                <button onClick={handleReset}
                        className="text-xs text-[var(--editor-muted)] hover:text-red-400 transition-colors">
                    Reset All Settings
                </button>
            </div>
        </div>
    );
}

function ShortcutRow({keys, description}: { keys: string; description: string }) {
    return (
        <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--editor-muted)]">{description}</span>
            <kbd
                className="px-1.5 py-0.5 bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded text-[var(--editor-text)] font-mono">
                {keys}
            </kbd>
        </div>
    );
}

function PremiumSection() {
    const {tier, status} = useLicenseStore();
    const {
        subscriptionStatus,
        loadSubscriptionStatus,
        loadObsidianConfig,
        isPremium,
        isSubscriptionActive,
        tokenUsagePercent,
        isNearTokenLimit,
        isAtTokenLimit,
    } = usePremiumStore();
    const [showObsidianConfig, setShowObsidianConfig] = useState(false);
    const [showAIConfig, setShowAIConfig] = useState(false);
    const [loadingUpgrade, setLoadingUpgrade] = useState(false);

    // Get license key from the license store by loading status
    const getLicenseKey = (): string | null => {
        return localStorage.getItem('wingman_license_key') || null;
    };

    // Load subscription status when component mounts or tier changes
    useEffect(() => {
        const licenseKey = getLicenseKey();
        if (licenseKey && (tier === 'pro' || tier === 'premium')) {
            loadSubscriptionStatus(licenseKey);
            loadObsidianConfig();
        }
    }, [tier, loadSubscriptionStatus, loadObsidianConfig]);

    const handleUpgradeToPremium = async () => {
        setLoadingUpgrade(true);
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-premium-checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                },
            });
            const data = await response.json();
            console.log('Checkout response:', data);
            if (data.url) {
                await open(data.url);
            } else if (data.error) {
                console.error('Checkout error:', data.error);
            }
        } catch (error) {
            console.error('Failed to create checkout session:', error);
        } finally {
            setLoadingUpgrade(false);
        }
    };

    const handleManageSubscription = async () => {
        try {
            const licenseKey = localStorage.getItem('wingman_license_key');
            if (!licenseKey) {
                console.error('No license key found');
                return;
            }

            const response = await fetch(`${SUPABASE_URL}/functions/v1/create-portal-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ license_key: licenseKey }),
            });

            const data = await response.json();
            if (data.url) {
                await open(data.url);
            } else {
                console.error('Failed to get portal URL:', data.error);
            }
        } catch (err) {
            console.error('Failed to open subscription portal:', err);
        }
    };

    // Calculate reset date (1st of next month)
    const getResetDate = () => {
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        return nextMonth.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
        });
    };

    // Format expiration date
    const formatExpirationDate = (dateStr: string | null) => {
        if (!dateStr) return 'N/A';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            });
        } catch {
            return 'N/A';
        }
    };

    return (
        <div className="mt-2 pt-2 border-t border-[var(--editor-border)]">
            <div className="flex items-center gap-2 mb-4">
                {tier === 'premium' && (
                    <span
                        className="px-2 py-0.5 text-xs font-medium text-amber-400 bg-amber-500/10 rounded-full border border-amber-500/20">
            Active
          </span>
                )}
            </div>

            {/* Not Premium - Show upgrade prompt */}
            {tier !== 'premium' && (
                <div
                    className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg border border-amber-500/20">
                    <div className="flex items-start gap-3 mb-3">
                        <div
                            className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-[var(--editor-text)]">Upgrade to Premium</h4>
                            <p className="text-xs text-[var(--editor-muted)]">$4.99/month - Cancel anytime</p>
                        </div>
                    </div>

                    <ul className="space-y-1.5 mb-4 text-xs text-[var(--editor-muted)]">
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            AI Prompt Optimizer
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            Obsidian Integration
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            1M AI tokens/month
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            All Pro features included
                        </li>
                    </ul>

                    <button
                        onClick={handleUpgradeToPremium}
                        disabled={loadingUpgrade}
                        className="w-full px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-medium rounded-lg hover:from-amber-600 hover:to-orange-700 transition-colors disabled:opacity-50"
                    >
                        {loadingUpgrade ? 'Loading...' : 'Subscribe to Premium'}
                    </button>
                </div>
            )}

            {/* Premium Active - Show status and usage */}
            {tier === 'premium' && subscriptionStatus && (
                <div className="space-y-4">
                    {/* Subscription Status */}
                    <div className="p-3 bg-[var(--editor-surface)] rounded-lg border border-[var(--editor-border)]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[var(--editor-muted)]">Status</span>
                            <span
                                className={`text-xs font-medium ${isSubscriptionActive ? 'text-green-400' : 'text-orange-400'}`}>
                {isSubscriptionActive ? 'Active' : 'Cancelled'}
              </span>
                        </div>
                        {subscriptionStatus.expires_at && (
                            <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--editor-muted)]">
                  {isSubscriptionActive ? 'Renews' : 'Access until'}
                </span>
                                <span className="text-xs text-[var(--editor-text)]">
                  {formatExpirationDate(subscriptionStatus.expires_at)}
                </span>
                            </div>
                        )}
                    </div>

                    {/* Token Usage */}
                    <div className="p-3 bg-[var(--editor-surface)] rounded-lg border border-[var(--editor-border)]">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-[var(--editor-muted)]">AI Token Usage</span>
                            <span className={`text-xs font-medium ${
                                isAtTokenLimit ? 'text-red-400' : isNearTokenLimit ? 'text-orange-400' : 'text-green-400'
                            }`}>
                {tokenUsagePercent}%
              </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-2 bg-[var(--editor-border)] rounded-full overflow-hidden mb-2">
                            <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                    isAtTokenLimit ? 'bg-red-500' : isNearTokenLimit ? 'bg-orange-500' : 'bg-green-500'
                                }`}
                                style={{width: `${Math.min(100, tokenUsagePercent)}%`}}
                            />
                        </div>

                        <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--editor-muted)]">
                {formatTokenUsage(subscriptionStatus.tokens_used, subscriptionStatus.tokens_remaining)}
              </span>
                            <span className="text-[var(--editor-muted)]">
                Resets {getResetDate()}
              </span>
                        </div>

                        {isAtTokenLimit && (
                            <p className="mt-2 text-xs text-red-400">
                                Monthly limit reached. Resets on {getResetDate()}.
                            </p>
                        )}
                        {isNearTokenLimit && !isAtTokenLimit && (
                            <p className="mt-2 text-xs text-orange-400">
                                Approaching monthly limit ({tokenUsagePercent}% used)
                            </p>
                        )}
                    </div>

                    {/* AI Configuration */}
                    <div>
                        <button
                            onClick={() => setShowAIConfig(!showAIConfig)}
                            className="w-full flex items-center justify-between p-3 bg-[var(--editor-surface)] rounded-lg border border-[var(--editor-border)] hover:border-emerald-500/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                                    <path d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                                    <path d="M16.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                                </svg>
                                <span className="text-sm text-[var(--editor-text)]">AI Configuration</span>
                            </div>
                            <svg
                                className={`w-4 h-4 text-[var(--editor-muted)] transition-transform ${showAIConfig ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>

                        {showAIConfig && (
                            <div className="mt-2">
                                <AIConfigComponent/>
                            </div>
                        )}
                    </div>

                    {/* Obsidian Configuration */}
                    <div>
                        <button
                            onClick={() => setShowObsidianConfig(!showObsidianConfig)}
                            className="w-full flex items-center justify-between p-3 bg-[var(--editor-surface)] rounded-lg border border-[var(--editor-border)] hover:border-purple-500/50 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24"
                                     stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
                                </svg>
                                <span className="text-sm text-[var(--editor-text)]">Obsidian Integration</span>
                            </div>
                            <svg
                                className={`w-4 h-4 text-[var(--editor-muted)] transition-transform ${showObsidianConfig ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                            </svg>
                        </button>

                        {showObsidianConfig && (
                            <div className="mt-2">
                                <ObsidianConfig/>
                            </div>
                        )}
                    </div>

                    {/* Manage Subscription Button */}
                    <button
                        onClick={handleManageSubscription}
                        className="w-full mt-3 px-4 py-2 text-sm font-medium text-[var(--editor-text)] bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-lg hover:bg-[var(--editor-hover)] transition-colors flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage Subscription
                    </button>
                </div>
            )}
        </div>
    );
}
