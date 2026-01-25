import {useRef, useState, useEffect} from 'react';
import {Bot, ChevronDown, Check, Download, Loader2, Diamond} from 'lucide-react';
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
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Bot className="w-4 h-4" />
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
                        <ChevronDown className="w-3 h-3 opacity-60" />
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
                                                <Check className="w-3 h-3 text-emerald-400" />
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
                    <Diamond className="w-4 h-4" />
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
                                <Download className="w-3.5 h-3.5" />
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
                        <ChevronDown className="w-3 h-3 opacity-60" />
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
                                            <Check className="w-3 h-3 text-[var(--ui-accent)]" />
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
                                            <Check className="w-3 h-3 text-[var(--ui-accent)]" />
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
