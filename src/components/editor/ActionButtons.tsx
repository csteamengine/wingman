import {useRef, useState, useEffect} from 'react';
import {Bot, ChevronDown, Check, Download, Loader2, Diamond, Github, FileOutput, ClipboardCopy} from 'lucide-react';
import type {AIPreset, CustomAIPrompt, AppSettings, ExportAction} from '../../types';

interface ActionButtonsProps {
    // Content state
    content: string;
    hasImages: boolean;

    // AI state
    isPremium: boolean;
    aiLoading: boolean;
    selectedPreset: AIPreset | undefined;
    selectedCustomPrompt: CustomAIPrompt | undefined;
    enabledPresets: AIPreset[];
    enabledCustomPrompts: CustomAIPrompt[];
    onAiButtonClick: () => void;
    onSelectPreset: (presetId: string) => void;
    onSelectCustomPrompt: (promptId: string) => void;

    // Export handlers
    hasObsidianAccess: boolean;
    hasObsidianConfigured: boolean;
    onObsidianSend: () => void;
    hasGitHubAccess: boolean;
    isGitHubAuthenticated: boolean;
    gistLoading: boolean;
    onGitHubGist: () => void;
    onSaveToFile: () => void;
    onCopyAsFile: () => void;

    // Primary action
    settings: AppSettings | null;
    onPasteAndClose: () => void;
    onUpdateSettings: (settings: Partial<AppSettings>) => void;

    // Error state
    aiError: string | null;
    githubError: string | null;
}

const EXPORT_OPTIONS: { id: ExportAction; label: string; description: string }[] = [
    { id: 'save_file', label: 'Save to File', description: 'Save with native file picker' },
    { id: 'obsidian', label: 'Obsidian', description: 'Send to Obsidian vault' },
    { id: 'gist', label: 'GitHub Gist', description: 'Create a GitHub Gist' },
    { id: 'copy_as_file', label: 'Copy as File', description: 'Copy content as a file to clipboard' },
];

export function ActionButtons({
    content,
    hasImages,
    isPremium,
    aiLoading,
    selectedPreset,
    selectedCustomPrompt,
    enabledPresets,
    enabledCustomPrompts,
    onAiButtonClick,
    onSelectPreset,
    onSelectCustomPrompt,
    hasObsidianAccess,
    hasObsidianConfigured,
    onObsidianSend,
    hasGitHubAccess,
    isGitHubAuthenticated,
    gistLoading,
    onGitHubGist,
    onSaveToFile,
    onCopyAsFile,
    settings,
    onPasteAndClose,
    onUpdateSettings,
    aiError,
    githubError,
}: ActionButtonsProps) {
    const [showAiPopover, setShowAiPopover] = useState(false);
    const [showExportPopover, setShowExportPopover] = useState(false);
    const aiPopoverRef = useRef<HTMLDivElement>(null);
    const exportPopoverRef = useRef<HTMLDivElement>(null);

    const exportAction: ExportAction = settings?.export_action || 'save_file';

    // Close AI popover when clicking outside or pressing Escape
    useEffect(() => {
        if (!showAiPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (aiPopoverRef.current && !aiPopoverRef.current.contains(e.target as Node)) {
                setShowAiPopover(false);
            }
        };
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setShowAiPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [showAiPopover]);

    // Close export popover when clicking outside
    useEffect(() => {
        if (!showExportPopover) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (exportPopoverRef.current && !exportPopoverRef.current.contains(e.target as Node)) {
                setShowExportPopover(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showExportPopover]);

    const handleSelectPreset = (presetId: string) => {
        onSelectPreset(presetId);
        setShowAiPopover(false);
    };

    const hasContent = content.trim() || hasImages;

    const executeExportAction = (action: ExportAction) => {
        switch (action) {
            case 'save_file':
                onSaveToFile();
                break;
            case 'obsidian':
                onObsidianSend();
                break;
            case 'gist':
                onGitHubGist();
                break;
            case 'copy_as_file':
                onCopyAsFile();
                break;
        }
    };

    const isExportDisabled = (action: ExportAction): boolean => {
        switch (action) {
            case 'obsidian':
                return !hasObsidianAccess || !hasObsidianConfigured;
            case 'gist':
                return !hasGitHubAccess || !isGitHubAuthenticated || gistLoading;
            default:
                return false;
        }
    };

    const getExportIcon = (action: ExportAction) => {
        switch (action) {
            case 'save_file':
                return <Download className="w-4 h-4" />;
            case 'obsidian':
                return <Diamond className="w-4 h-4" />;
            case 'gist':
                return gistLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />;
            case 'copy_as_file':
                return <FileOutput className="w-4 h-4" />;
        }
    };

    const getExportLabel = (action: ExportAction): string => {
        return EXPORT_OPTIONS.find(o => o.id === action)?.label || 'Export';
    };

    return (
        <div className="rounded-b-[10px]">
            {/* Action button row */}
            <div className="px-3 py-3 flex gap-2 items-center">
                {/* Clipboard button - floats left */}
                <button
                    onClick={onPasteAndClose}
                    disabled={!hasContent}
                    title="Copy to Clipboard (⌘↵)"
                    className="btn-primary flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md text-sm disabled:opacity-40 transition-colors"
                >
                    <ClipboardCopy className="w-4 h-4" />
                    <span>Copy to Clipboard</span>
                    <kbd className="ml-1 text-[10px] opacity-60 font-sans">⌘↵</kbd>
                </button>

                {/* Spacer pushes remaining buttons right */}
                <div className="flex-1" />

                {/* AI Refine split button - green */}
                <div className="relative flex" ref={aiPopoverRef}>
                    {/* Main button - triggers refinement with selected preset */}
                    <button
                        onClick={onAiButtonClick}
                        disabled={!isPremium || !content.trim() || aiLoading}
                        title={
                            selectedCustomPrompt
                                ? `Refine with ${selectedCustomPrompt.name}`
                                : selectedPreset
                                    ? `Refine with ${selectedPreset.name}`
                                    : "Refine text with AI"
                        }
                        className="btn-ai flex items-center justify-center gap-1.5 pl-3 pr-2 py-2.5 rounded-l-md text-sm transition-colors disabled:opacity-40 border-r-0"
                    >
                        {aiLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Bot className="w-4 h-4" />
                        )}
                        <span>{selectedCustomPrompt?.name || selectedPreset?.name || 'AI'}</span>
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
                        <div className="absolute bottom-full mb-2 left-0 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-lg z-50 min-w-[220px] max-w-[280px] py-1 animate-fade-in">
                            <div className="px-3 py-2 border-b border-[var(--ui-border)]">
                                <p className="text-xs font-medium text-[var(--ui-text)]">Select AI Prompt</p>
                                <p className="text-[10px] text-[var(--ui-text-muted)]">Choose a prompt for the AI button</p>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {/* Built-in Presets */}
                                {enabledPresets.length > 0 && (
                                    <>
                                        <div className="px-3 py-1.5 bg-[var(--ui-surface)] sticky top-0">
                                            <p className="text-[10px] font-medium text-[var(--ui-text-muted)] uppercase tracking-wide">Built-in</p>
                                        </div>
                                        {enabledPresets.map((preset) => (
                                            <button
                                                key={preset.id}
                                                onClick={() => handleSelectPreset(preset.id)}
                                                className={`w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors ${
                                                    selectedPreset?.id === preset.id && !selectedCustomPrompt ? 'bg-[var(--btn-ai-bg)]' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {selectedPreset?.id === preset.id && !selectedCustomPrompt && (
                                                        <Check className="w-3 h-3 text-emerald-400" />
                                                    )}
                                                    <div className={selectedPreset?.id === preset.id && !selectedCustomPrompt ? '' : 'ml-5'}>
                                                        <p className="text-xs font-medium text-[var(--ui-text)]">{preset.name}</p>
                                                        <p className="text-[10px] text-[var(--ui-text-muted)] line-clamp-1">{preset.description}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                )}

                                {/* Custom Prompts */}
                                {enabledCustomPrompts.length > 0 && (
                                    <>
                                        {enabledPresets.length > 0 && (
                                            <div className="border-t border-[var(--ui-border)] my-1"></div>
                                        )}
                                        <div className="px-3 py-1.5 bg-[var(--ui-surface)] sticky top-0">
                                            <p className="text-[10px] font-medium text-[var(--ui-text-muted)] uppercase tracking-wide">Custom</p>
                                        </div>
                                        {enabledCustomPrompts.map((prompt) => (
                                            <button
                                                key={prompt.id}
                                                onClick={() => {
                                                    onSelectCustomPrompt(prompt.id);
                                                    setShowAiPopover(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors ${
                                                    selectedCustomPrompt?.id === prompt.id ? 'bg-[var(--btn-ai-bg)]' : ''
                                                }`}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {selectedCustomPrompt?.id === prompt.id && (
                                                        <Check className="w-3 h-3 text-emerald-400" />
                                                    )}
                                                    <div className={selectedCustomPrompt?.id === prompt.id ? '' : 'ml-5'}>
                                                        <p className="text-xs font-medium text-[var(--ui-text)]">{prompt.name}</p>
                                                        <p className="text-[10px] text-[var(--ui-text-muted)] line-clamp-1">{prompt.description}</p>
                                                    </div>
                                                </div>
                                            </button>
                                        ))}
                                    </>
                                )}

                                {enabledPresets.length === 0 && enabledCustomPrompts.length === 0 && (
                                    <p className="px-3 py-2 text-xs text-[var(--ui-text-muted)]">No prompts enabled. Configure in Settings.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Export split button */}
                <div className="relative flex" ref={exportPopoverRef}>
                    {/* Main button - triggers selected export action */}
                    <button
                        onClick={() => executeExportAction(exportAction)}
                        disabled={!hasContent || isExportDisabled(exportAction)}
                        title={getExportLabel(exportAction)}
                        className="btn-primary flex items-center justify-center gap-1.5 pl-3 pr-2 py-2.5 rounded-l-md text-sm disabled:opacity-40 transition-colors"
                    >
                        {getExportIcon(exportAction)}
                        <span>{getExportLabel(exportAction)}</span>
                    </button>
                    {/* Dropdown button - opens export selector */}
                    <button
                        onClick={() => setShowExportPopover(!showExportPopover)}
                        disabled={!hasContent}
                        title="Select export action"
                        className="btn-primary flex items-center justify-center px-1.5 py-2.5 rounded-r-md text-sm disabled:opacity-40 transition-colors border-l border-white/20"
                    >
                        <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>

                    {/* Export Action Popover */}
                    {showExportPopover && (
                        <div className="absolute bottom-full mb-2 right-0 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg shadow-lg z-50 min-w-[220px] py-1 animate-fade-in">
                            <div className="px-3 py-2 border-b border-[var(--ui-border)]">
                                <p className="text-xs font-medium text-[var(--ui-text)]">Export Action</p>
                                <p className="text-[10px] text-[var(--ui-text-muted)]">Choose default export method</p>
                            </div>
                            <div className="py-1">
                                {EXPORT_OPTIONS.map((option) => {
                                    const disabled = isExportDisabled(option.id);
                                    const isSelected = exportAction === option.id;
                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => {
                                                onUpdateSettings({ export_action: option.id });
                                                setShowExportPopover(false);
                                            }}
                                            disabled={disabled}
                                            className={`w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors disabled:opacity-40 ${
                                                isSelected ? 'bg-[var(--ui-accent)]/10' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isSelected && (
                                                    <Check className="w-3 h-3 text-[var(--ui-accent)]" />
                                                )}
                                                <div className={isSelected ? '' : 'ml-5'}>
                                                    <p className="text-xs font-medium text-[var(--ui-text)]">{option.label}</p>
                                                    <p className="text-[10px] text-[var(--ui-text-muted)]">{option.description}</p>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Error Messages */}
            {aiError && (
                <div className="mx-3 mb-3 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
                    {aiError}
                </div>
            )}
            {githubError && (
                <div className="mx-3 mb-3 px-3 py-2 text-xs bg-red-500/10 border border-red-500/20 rounded-md text-red-400">
                    <span className="font-medium">GitHub: </span>{githubError}
                </div>
            )}
        </div>
    );
}
