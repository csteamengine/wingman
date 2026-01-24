import {useRef, useState, useEffect} from 'react';
import type {AIPreset, AppSettings} from '../../types';

interface ActionButtonsProps {
    // Content state
    content: string;
    hasImages: boolean;

    // AI state
    isPremium: boolean;
    aiLoading: boolean;
    selectedPreset: AIPreset | undefined;
    enabledPresets: AIPreset[];
    onAiButtonClick: () => void;
    onSelectPreset: (presetId: string) => void;

    // Obsidian state
    hasObsidianAccess: boolean;
    hasObsidianConfigured: boolean;
    onObsidianSend: () => void;

    // Primary action state
    settings: AppSettings | null;
    onPasteAndClose: () => void;
    onSaveToFile: () => void;
    onUpdateSettings: (settings: Partial<AppSettings>) => void;

    // Error state
    aiError: string | null;
}

export function ActionButtons({
    content,
    hasImages,
    isPremium,
    aiLoading,
    selectedPreset,
    enabledPresets,
    onAiButtonClick,
    onSelectPreset,
    hasObsidianAccess,
    hasObsidianConfigured,
    onObsidianSend,
    settings,
    onPasteAndClose,
    onSaveToFile,
    onUpdateSettings,
    aiError,
}: ActionButtonsProps) {
    const [showAiPopover, setShowAiPopover] = useState(false);
    const [showPrimaryActionPopover, setShowPrimaryActionPopover] = useState(false);
    const aiPopoverRef = useRef<HTMLDivElement>(null);
    const primaryActionRef = useRef<HTMLDivElement>(null);

    // Close AI popover when clicking outside
    useEffect(() => {
        if (!showAiPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (aiPopoverRef.current && !aiPopoverRef.current.contains(e.target as Node)) {
                setShowAiPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showAiPopover]);

    // Close primary action popover when clicking outside
    useEffect(() => {
        if (!showPrimaryActionPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (primaryActionRef.current && !primaryActionRef.current.contains(e.target as Node)) {
                setShowPrimaryActionPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showPrimaryActionPopover]);

    const handleSelectPreset = (presetId: string) => {
        onSelectPreset(presetId);
        setShowAiPopover(false);
    };

    const hasContent = content.trim() || hasImages;

    return (
        <div className="rounded-b-[10px]">
            {/* Action button row */}
            <div className="px-3 py-3 flex gap-2">
                {/* AI Refine split button - green */}
                <div className="relative flex" ref={aiPopoverRef}>
                    {/* Main button - triggers refinement with selected preset */}
                    <button
                        onClick={onAiButtonClick}
                        disabled={!isPremium || !content.trim() || aiLoading}
                        title={selectedPreset ? `Refine with ${selectedPreset.name}` : "Refine text with AI"}
                        className="btn-ai flex items-center justify-center gap-1.5 pl-3 pr-2 py-2.5 rounded-l-md text-sm transition-colors disabled:opacity-40 border-r-0"
                    >
                        {aiLoading ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
                                <path d="M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                                <path d="M16.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
                            </svg>
                        )}
                        <span>{selectedPreset?.name || 'AI'}</span>
                    </button>
                    {/* Dropdown button - opens preset selector */}
                    <button
                        onClick={() => setShowAiPopover(!showAiPopover)}
                        disabled={!isPremium || aiLoading}
                        title="Select AI preset"
                        className="btn-ai flex items-center justify-center px-1.5 py-2.5 rounded-r-md text-sm transition-colors disabled:opacity-40"
                    >
                        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>

                    {/* AI Presets Popover */}
                    {showAiPopover && (
                        <div className="absolute bottom-full mb-2 left-0 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-lg z-50 min-w-[220px] py-1 animate-fade-in">
                            <div className="px-3 py-2 border-b border-[var(--ui-border)]">
                                <p className="text-xs font-medium text-[var(--ui-text)]">Select Default Preset</p>
                                <p className="text-[10px] text-[var(--ui-text-muted)]">Choose a preset for the AI button</p>
                            </div>
                            <div className="max-h-[200px] overflow-y-auto">
                                {enabledPresets.map((preset) => (
                                    <button
                                        key={preset.id}
                                        onClick={() => handleSelectPreset(preset.id)}
                                        className={`w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors ${
                                            selectedPreset?.id === preset.id ? 'bg-[var(--btn-ai-bg)]' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {selectedPreset?.id === preset.id && (
                                                <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                                </svg>
                                            )}
                                            <div className={selectedPreset?.id === preset.id ? '' : 'ml-5'}>
                                                <p className="text-xs font-medium text-[var(--ui-text)]">{preset.name}</p>
                                                <p className="text-[10px] text-[var(--ui-text-muted)]">{preset.description}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                            {enabledPresets.length === 0 && (
                                <p className="px-3 py-2 text-xs text-[var(--ui-text-muted)]">No presets enabled. Configure in Settings.</p>
                            )}
                        </div>
                    )}
                </div>

                {/* Obsidian button - purple/violet (Obsidian brand color) - Pro feature */}
                <button
                    onClick={onObsidianSend}
                    disabled={!hasObsidianAccess || !hasObsidianConfigured || !content.trim()}
                    title={!hasObsidianAccess ? "Pro feature - Send to Obsidian" : (!hasObsidianConfigured ? "Configure Obsidian vault in Settings first" : "Send to Obsidian")}
                    className="btn-obsidian flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm transition-colors disabled:opacity-40"
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18l6.9 3.45L12 11.09 5.1 7.63 12 4.18zM4 8.82l7 3.5v7.36l-7-3.5V8.82zm9 10.86v-7.36l7-3.5v7.36l-7 3.5z"/>
                    </svg>
                    <span>Obsidian</span>
                </button>

                {/* Primary Action split button */}
                <div className="relative flex flex-1" ref={primaryActionRef}>
                    {/* Main button - triggers primary action */}
                    <button
                        onClick={() => {
                            if (settings?.primary_action === 'save_file') {
                                onSaveToFile();
                            } else {
                                onPasteAndClose();
                            }
                        }}
                        disabled={!hasContent}
                        className="btn-primary flex-1 flex items-center justify-center gap-2 pl-3 pr-2 py-2.5 rounded-l-md text-sm disabled:opacity-40 transition-colors"
                    >
                        {settings?.primary_action === 'save_file' ? (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                <span>Save to File</span>
                            </>
                        ) : (
                            <span>Copy to Clipboard</span>
                        )}
                        <span className="kbd">⌘↵</span>
                    </button>
                    {/* Dropdown button - opens action selector */}
                    <button
                        onClick={() => setShowPrimaryActionPopover(!showPrimaryActionPopover)}
                        disabled={!hasContent}
                        title="Select primary action"
                        className="btn-primary flex items-center justify-center px-1.5 py-2.5 rounded-r-md text-sm disabled:opacity-40 transition-colors border-l border-white/20"
                    >
                        <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                        </svg>
                    </button>

                    {/* Primary Action Popover */}
                    {showPrimaryActionPopover && (
                        <div className="absolute bottom-full mb-2 right-0 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-lg z-50 min-w-[200px] py-1 animate-fade-in">
                            <div className="px-3 py-2 border-b border-[var(--ui-border)]">
                                <p className="text-xs font-medium text-[var(--ui-text)]">Primary Action</p>
                                <p className="text-[10px] text-[var(--ui-text-muted)]">Choose what ⌘↵ does</p>
                            </div>
                            <div className="py-1">
                                <button
                                    onClick={() => {
                                        onUpdateSettings({ primary_action: 'clipboard' });
                                        setShowPrimaryActionPopover(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors ${
                                        settings?.primary_action !== 'save_file' ? 'bg-[var(--ui-accent)]/10' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {settings?.primary_action !== 'save_file' && (
                                            <svg className="w-3 h-3 text-[var(--ui-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                            </svg>
                                        )}
                                        <div className={settings?.primary_action !== 'save_file' ? '' : 'ml-5'}>
                                            <p className="text-xs font-medium text-[var(--ui-text)]">Copy to Clipboard</p>
                                            <p className="text-[10px] text-[var(--ui-text-muted)]">Copy and paste to previous app</p>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        onUpdateSettings({ primary_action: 'save_file' });
                                        setShowPrimaryActionPopover(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors ${
                                        settings?.primary_action === 'save_file' ? 'bg-[var(--ui-accent)]/10' : ''
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        {settings?.primary_action === 'save_file' && (
                                            <svg className="w-3 h-3 text-[var(--ui-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                                            </svg>
                                        )}
                                        <div className={settings?.primary_action === 'save_file' ? '' : 'ml-5'}>
                                            <p className="text-xs font-medium text-[var(--ui-text)]">Save to File</p>
                                            <p className="text-[10px] text-[var(--ui-text-muted)]">Save with native file picker</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Error message */}
            {aiError && (
                <div className="mx-3 mb-3 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
                    {aiError}
                </div>
            )}
        </div>
    );
}
