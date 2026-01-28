import {useEffect, useRef, useCallback, useState} from 'react';
import {EditorView, placeholder, drawSelection, dropCursor, keymap} from '@codemirror/view';
import {EditorState} from '@codemirror/state';
import {defaultKeymap, history, historyKeymap, indentWithTab} from '@codemirror/commands';
import {search, searchKeymap} from '@codemirror/search';
import {bracketMatching} from '@codemirror/language';
import {autocompletion, closeBrackets, closeBracketsKeymap} from '@codemirror/autocomplete';
import {linter, lintGutter, setDiagnostics} from '@codemirror/lint';
import type {Diagnostic} from '@codemirror/lint';
import {oneDark} from '@codemirror/theme-one-dark';
import {listen} from '@tauri-apps/api/event';
import {invoke} from '@tauri-apps/api/core';

import {useEditorStore} from '../stores/editorStore';
import {useSettingsStore} from '../stores/settingsStore';
import {useLicenseStore, isDev} from '../stores/licenseStore';
import {usePremiumStore} from '../stores/premiumStore';
import {useGitHubStore} from '../stores/githubStore';
import {useDragStore} from '../stores/dragStore';
import {useCustomAIPromptsStore} from '../stores/customAIPromptsStore';
import {useDiffStore} from '../stores/diffStore';

import {DiffPreviewModal} from './DiffPreviewModal';
import {DiffReviewModal} from './DiffReviewModal';
import {TransformationFloatingButton} from './TransformationFloatingButton';

import {
    languages,
    jsonLinter,
    xmlLinter,
    pythonLinter,
    htmlLinter,
    yamlLinter,
    markdownPlugin,
    markdownTheme,
    codeBlockTheme,
    markdownLinkPasteHandler,
    clipboardDropHandler,
    isUrl,
    editorKeymap,
    StatusBar,
    ActionButtons,
    AttachmentsBar,
    FloatingNotifications,
    Toolbar,
    FileDragOverlay,
    ClipboardDragIndicator,
    AILoadingOverlay,
} from './editor';

import type {ObsidianResult, GistResult, AIPreset} from '../types';
import {maskSecrets} from '../utils/maskSecrets';
import {detectContent} from '../detectors';
import type {DetectorResult, DetectorAction, DetectorActionResult} from '../detectors';

// Parse error line/column from formatter error messages
function parseErrorPosition(errorMsg: string): { line: number; column: number } | null {
    // Prettier format: "message (line:column)"
    const prettierMatch = errorMsg.match(/\((\d+):(\d+)\)/);
    if (prettierMatch) return { line: parseInt(prettierMatch[1], 10), column: parseInt(prettierMatch[2], 10) };

    // "line N, column N" or "line N column N"
    const lineColMatch = errorMsg.match(/line\s+(\d+)[,\s]+column\s+(\d+)/i);
    if (lineColMatch) return { line: parseInt(lineColMatch[1], 10), column: parseInt(lineColMatch[2], 10) };

    // "at position N" (JSON.parse style)
    const posMatch = errorMsg.match(/at position (\d+)/);
    if (posMatch) {
        // Can't convert position to line without source text, return null
        return null;
    }

    // "Line N:" at start
    const lineOnlyMatch = errorMsg.match(/^Line\s+(\d+):/i);
    if (lineOnlyMatch) return { line: parseInt(lineOnlyMatch[1], 10), column: 1 };

    return null;
}

// Show an error diagnostic at a specific position in the editor, auto-clears after timeout
function showErrorDiagnostic(
    view: EditorView,
    viewRef: React.RefObject<EditorView | null>,
    from: number,
    to: number,
    message: string,
    source?: string,
    timeoutMs = 5000,
) {
    const diagnostic: Diagnostic = {
        from,
        to,
        severity: 'error',
        message,
        source: source ?? 'Format',
    };

    view.dispatch(
        setDiagnostics(view.state, [diagnostic]),
        { selection: { anchor: from } },
        { effects: EditorView.scrollIntoView(from, { y: 'center' }) },
    );
    view.focus();

    setTimeout(() => {
        if (viewRef.current) {
            viewRef.current.dispatch(setDiagnostics(viewRef.current.state, []));
        }
    }, timeoutMs);
}

export function EditorWindow() {
    const editorRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const editorContainerRef = useRef<HTMLDivElement>(null);

    const [isDragging, setIsDragging] = useState(false);
    const [obsidianToast, setObsidianToast] = useState<ObsidianResult | null>(null);
    const [gistToast, setGistToast] = useState<GistResult | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);
    const [selectedCustomPromptId, setSelectedCustomPromptId] = useState<string | null>(null);
    const [parsedUrlInfo, setParsedUrlInfo] = useState<{url: string; cursorPos: number} | null>(null);
    const [contextDetection, setContextDetection] = useState<DetectorResult | null>(null);
    const contextDismissedRef = useRef<string | null>(null); // tracks dismissed detector id
    const pasteOrDropRef = useRef(false); // tracks if content change came from paste/drag

    // Get drag store state and functions
    const {
        isDraggingClipboardItem,
        draggedContent,
        cursorPosition,
        editorInsertPosition,
        endDrag,
        updateCursorPosition,
        clearCursor,
    } = useDragStore();

    const {
        content,
        setContent,
        language,
        setLanguage,
        stats,
        isVisible,
        activePanel,
        pasteAndClose,
        hideWindow,
        setEditorView,
        images,
        addImage,
        removeImage,
        transformText,
        applyBulletList,
        applyNumberedList,
        saveToFile,
        validationToast,
        setValidationToast,
    } = useEditorStore();

    const {settings, updateSettings} = useSettingsStore();
    const {tier, devTierOverride} = useLicenseStore();

    const {
        aiLoading,
        obsidianConfig,
        loadAIConfig,
        loadObsidianConfig,
        loadSubscriptionStatus,
        loadAIPresets,
        callAIWithPreset,
        getEnabledPresets,
        addToObsidian,
        openObsidianNote,
    } = usePremiumStore();

    const {
        loadPrompts: loadCustomAIPrompts,
        getEnabledPrompts: getEnabledCustomPrompts,
    } = useCustomAIPromptsStore();

    const {
        isAuthenticated: isGitHubAuthenticated,
        gistLoading,
        error: githubError,
        loadAuthStatus: loadGitHubAuthStatus,
        loadConfig: loadGitHubConfig,
        createGist,
    } = useGitHubStore();

    // Feature flags - compute effective tier to react to dev tier changes
    // Premium tier has access to all Pro features
    const effectiveTier = (isDev && devTierOverride !== null) ? devTierOverride : tier;
    const isPremium = effectiveTier === 'premium';
    const isPro = effectiveTier === 'pro' || effectiveTier === 'premium';
    const hasObsidianAccess = isPro;
    const hasObsidianConfigured = obsidianConfig && obsidianConfig.vault_path;
    const hasGitHubAccess = isPro;
    const hasImageSupport = isPro;
    const hasClipboardDragDrop = isPro;
    const hasStatsDisplay = isPro;
    const hasProEditorFeatures = isPro;

    // Load Obsidian config when user has Pro/Premium access
    useEffect(() => {
        if (hasObsidianAccess) {
            loadObsidianConfig();
        }
    }, [hasObsidianAccess, loadObsidianConfig]);

    // Load GitHub config and auth status when user has Pro/Premium access
    useEffect(() => {
        if (hasGitHubAccess) {
            loadGitHubConfig();
            loadGitHubAuthStatus();
        }
    }, [hasGitHubAccess, loadGitHubConfig, loadGitHubAuthStatus]);

    // Load Premium features when user has Premium tier
    useEffect(() => {
        if (isPremium) {
            loadAIConfig();
            loadAIPresets();
            loadCustomAIPrompts();
            const licenseKey = localStorage.getItem('wingman_license_key');
            if (licenseKey) {
                loadSubscriptionStatus(licenseKey);
            }
        }
    }, [isPremium, loadAIConfig, loadAIPresets, loadSubscriptionStatus]);

    // Auto-hide toasts
    useEffect(() => {
        if (obsidianToast) {
            const timer = setTimeout(() => setObsidianToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [obsidianToast]);

    useEffect(() => {
        if (gistToast) {
            const timer = setTimeout(() => setGistToast(null), 10000);
            return () => clearTimeout(timer);
        }
    }, [gistToast]);

    useEffect(() => {
        if (aiError) {
            const timer = setTimeout(() => setAiError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [aiError]);

    // Clear GitHub error after showing it
    useEffect(() => {
        if (githubError) {
            const timer = setTimeout(() => {
                // Clear the error from the store
                useGitHubStore.setState({ error: null });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [githubError]);

    useEffect(() => {
        if (parsedUrlInfo) {
            const timer = setTimeout(() => setParsedUrlInfo(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [parsedUrlInfo]);

    useEffect(() => {
        if (validationToast) {
            const timer = setTimeout(() => setValidationToast(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [validationToast, setValidationToast]);

    // Content detection - debounced, only show toast on paste/drag events
    useEffect(() => {
        const timer = setTimeout(() => {
            let result = detectContent(content);

            // Add "Switch to {lang}" action if a different language is suggested
            if (result?.suggestedLanguage && settings?.auto_detect_language && result.suggestedLanguage !== language) {
                const lang = result.suggestedLanguage;
                const switchAction: DetectorAction = {
                    id: `switch-language:${lang}`,
                    label: `Switch to ${lang.toUpperCase()}`,
                    execute: (text: string) => text,
                };
                result = { ...result, actions: [switchAction, ...result.actions] };
            }

            // Only show toast on paste/drag, and not if user already dismissed this detector
            if (pasteOrDropRef.current && result && contextDismissedRef.current !== result.detectorId) {
                setContextDetection(result);
                pasteOrDropRef.current = false;
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [content, settings?.auto_detect_language, language, setLanguage]);

    // Auto-dismiss context detection after 8 seconds
    useEffect(() => {
        if (contextDetection) {
            const timer = setTimeout(() => setContextDetection(null), 8000);
            return () => clearTimeout(timer);
        }
    }, [contextDetection]);

    // Load selected preset from localStorage
    useEffect(() => {
        const savedPresetId = localStorage.getItem('wingman_selected_ai_preset');
        if (savedPresetId) {
            setSelectedPresetId(savedPresetId);
        }
    }, []);

    // Handle mouse-based drag over the editor
    useEffect(() => {
        if (!isDraggingClipboardItem || !hasClipboardDragDrop) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (editorContainerRef.current && viewRef.current) {
                const rect = editorContainerRef.current.getBoundingClientRect();
                const isOverEditor = (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                );

                if (isOverEditor) {
                    const pos = viewRef.current.posAtCoords({ x: e.clientX, y: e.clientY });
                    updateCursorPosition(e.clientX, e.clientY, pos ?? null);
                } else {
                    clearCursor();
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (editorContainerRef.current && viewRef.current && draggedContent) {
                const rect = editorContainerRef.current.getBoundingClientRect();
                const isOverEditor = (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                );

                if (isOverEditor) {
                    const view = viewRef.current;
                    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
                    const insertPos = pos ?? view.state.selection.main.head;

                    view.dispatch({
                        changes: { from: insertPos, to: insertPos, insert: draggedContent },
                        selection: { anchor: insertPos + draggedContent.length },
                    });
                    view.focus();
                    pasteOrDropRef.current = true;
                    contextDismissedRef.current = null;
                    endDrag();
                }
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDraggingClipboardItem, hasClipboardDragDrop, draggedContent, updateCursorPosition, clearCursor, endDrag]);

    // AI Presets and Custom Prompts
    const enabledPresets = getEnabledPresets();
    const enabledCustomPrompts = getEnabledCustomPrompts();
    const selectedPreset = enabledPresets.find(p => p.id === selectedPresetId) || enabledPresets[0] || null;
    const selectedCustomPrompt = enabledCustomPrompts.find(p => p.id === selectedCustomPromptId);

    const handleSelectPreset = useCallback((presetId: string) => {
        setSelectedPresetId(presetId);
        setSelectedCustomPromptId(null); // Clear custom prompt selection
        localStorage.setItem('wingman_selected_ai_preset', presetId);
        localStorage.removeItem('wingman_selected_custom_prompt');
    }, []);

    const handleSelectCustomPrompt = useCallback((promptId: string) => {
        setSelectedCustomPromptId(promptId);
        setSelectedPresetId(null); // Clear built-in preset selection
        localStorage.setItem('wingman_selected_custom_prompt', promptId);
        localStorage.removeItem('wingman_selected_ai_preset');
    }, []);

    const handleAiRefineWithPreset = useCallback(async (preset: Parameters<typeof callAIWithPreset>[2]) => {
        if (aiLoading || !content.trim()) return;
        setAiError(null);

        const licenseKey = localStorage.getItem('wingman_license_key');
        if (!licenseKey) {
            setAiError('License key not found');
            return;
        }

        const response = await callAIWithPreset(licenseKey, content, preset);
        if (response && response.result) {
            setContent(response.result);
            if (preset.id === 'code_explainer') {
                setLanguage('markdown');
            }
        } else {
            setAiError('Failed to refine text');
        }
    }, [aiLoading, content, callAIWithPreset, setContent, setLanguage]);

    const handleAiButtonClick = useCallback(async () => {
        // Use custom prompt if selected, otherwise use built-in preset
        if (selectedCustomPrompt) {
            // Convert custom prompt to preset format for AI call
            const customAsPreset = {
                id: selectedCustomPrompt.id as any,
                name: selectedCustomPrompt.name,
                description: selectedCustomPrompt.description,
                systemPrompt: selectedCustomPrompt.system_prompt,
                enabled: selectedCustomPrompt.enabled,
            } as AIPreset;
            await handleAiRefineWithPreset(customAsPreset);
        } else if (selectedPreset) {
            await handleAiRefineWithPreset(selectedPreset);
        }
    }, [selectedPreset, selectedCustomPrompt, handleAiRefineWithPreset]);

    // Obsidian handlers
    const handleObsidianSend = useCallback(async () => {
        if (!content.trim()) return;
        const result = await addToObsidian(content);
        if (result) {
            setObsidianToast(result);
        }
    }, [content, addToObsidian]);

    const handleToastClick = useCallback(async () => {
        if (obsidianToast) {
            await openObsidianNote(obsidianToast.open_uri);
            setObsidianToast(null);
            await hideWindow();
        }
    }, [obsidianToast, openObsidianNote, hideWindow]);

    // GitHub Gist handlers
    const handleGitHubGist = useCallback(async () => {
        // Pre-flight validation
        if (!content.trim()) {
            setValidationToast({
                type: 'error',
                message: 'Cannot create gist: content is empty',
            });
            return;
        }

        if (!isGitHubAuthenticated) {
            setValidationToast({
                type: 'error',
                message: 'Not authenticated with GitHub. Please authorize in Settings.',
            });
            return;
        }

        const result = await createGist(content, language || 'plaintext');
        if (result) {
            setGistToast(result);
        }
    }, [content, language, createGist, isGitHubAuthenticated, setValidationToast]);

    // Copy as File handler
    const handleCopyAsFile = useCallback(async () => {
        if (!content.trim()) return;
        try {
            await invoke<string>('copy_file_to_clipboard', {
                content,
                language: language || 'plaintext',
            });
            setValidationToast({ type: 'success', message: 'File copied to clipboard' });
        } catch (error) {
            setValidationToast({ type: 'error', message: `Failed to copy as file: ${error}` });
        }
    }, [content, language, setValidationToast]);

    const handleGistToastOpen = useCallback(async () => {
        if (gistToast) {
            await invoke('open_url', { url: gistToast.html_url });
            setGistToast(null);
            await hideWindow();
        }
    }, [gistToast, hideWindow]);

    // Format handler
    const handleFormat = useCallback(async () => {
        const view = viewRef.current;
        if (!view) return;

        const selection = view.state.selection.main;
        const cursorPos = selection.head;
        const text = selection.empty ? view.state.doc.toString() : view.state.sliceDoc(selection.from, selection.to);
        const from = selection.empty ? 0 : selection.from;
        const to = selection.empty ? view.state.doc.length : selection.to;

        if (!text.trim()) return;

        try {
            let detectedLang = language;

            // Auto-detect language for plaintext
            if (language === 'plaintext') {
                detectedLang = await invoke<string>('detect_language', { text });
                if (detectedLang === 'plaintext') {
                    setValidationToast({ type: 'error', message: 'Cannot detect language. Please select a language mode first.' });
                    return;
                }
                setLanguage(detectedLang);
            }

            const formatted = await invoke<string>('format_code', { text, language: detectedLang });

            const applyCallback = () => {
                const lengthDiff = formatted.length - (to - from);
                const newCursorPos = cursorPos <= from ? cursorPos : cursorPos + lengthDiff;
                view.dispatch({
                    changes: { from, to, insert: formatted },
                    selection: { anchor: newCursorPos },
                });
            };

            // Check if diff preview is enabled
            const showDiffPreview = settings?.show_diff_preview;
            if (showDiffPreview && isPro && text !== formatted) {
                useDiffStore.getState().setPendingDiff({
                    originalText: text,
                    transformedText: formatted,
                    transformationType: 'Format',
                    selectionRange: selection.empty ? null : { from, to },
                    cursorPos,
                    applyCallback,
                });
                useDiffStore.getState().openPreviewModal();
            } else {
                applyCallback();
                if (text !== formatted && isPro) {
                    useDiffStore.getState().addTransformationRecord({
                        originalText: text,
                        transformedText: formatted,
                        transformationType: 'Format',
                    });
                }
            }
        } catch (error) {
            const errorMsg = String(error);
            setValidationToast({ type: 'error', message: errorMsg });

            // Highlight the error position using CodeMirror diagnostics
            const errorPos = parseErrorPosition(errorMsg);
            if (errorPos && view) {
                const lineNum = Math.min(errorPos.line, view.state.doc.lines);
                const line = view.state.doc.line(lineNum);
                const col = Math.min(errorPos.column - 1, line.length);
                const from = line.from + col;
                const to = Math.min(from + 1, line.to);
                showErrorDiagnostic(view, viewRef, from, to, errorMsg);
            }
        }
    }, [language, setLanguage, settings, isPro, setValidationToast]);

    // Minify handler
    const handleMinify = useCallback(async () => {
        const view = viewRef.current;
        if (!view) return;

        const selection = view.state.selection.main;
        const cursorPos = selection.head;
        const text = selection.empty ? view.state.doc.toString() : view.state.sliceDoc(selection.from, selection.to);
        const from = selection.empty ? 0 : selection.from;
        const to = selection.empty ? view.state.doc.length : selection.to;

        if (!text.trim()) return;

        try {
            let detectedLang = language;

            // Auto-detect language for plaintext
            if (language === 'plaintext') {
                detectedLang = await invoke<string>('detect_language', { text });
                if (detectedLang === 'plaintext') {
                    setValidationToast({ type: 'error', message: 'Cannot detect language. Please select a language mode first.' });
                    return;
                }
                setLanguage(detectedLang);
            }

            const minified = await invoke<string>('minify_code', { text, language: detectedLang });

            const applyCallback = () => {
                const lengthDiff = minified.length - (to - from);
                const newCursorPos = cursorPos <= from ? cursorPos : cursorPos + lengthDiff;
                view.dispatch({
                    changes: { from, to, insert: minified },
                    selection: { anchor: newCursorPos },
                });
            };

            // Check if diff preview is enabled
            const showDiffPreview = settings?.show_diff_preview;
            if (showDiffPreview && isPro && text !== minified) {
                useDiffStore.getState().setPendingDiff({
                    originalText: text,
                    transformedText: minified,
                    transformationType: 'Minify',
                    selectionRange: selection.empty ? null : { from, to },
                    cursorPos,
                    applyCallback,
                });
                useDiffStore.getState().openPreviewModal();
            } else {
                applyCallback();
                if (text !== minified && isPro) {
                    useDiffStore.getState().addTransformationRecord({
                        originalText: text,
                        transformedText: minified,
                        transformationType: 'Minify',
                    });
                }
            }
        } catch (error) {
            const errorMsg = String(error);
            setValidationToast({ type: 'error', message: errorMsg });

            const errorPos = parseErrorPosition(errorMsg);
            if (errorPos && view) {
                const lineNum = Math.min(errorPos.line, view.state.doc.lines);
                const line = view.state.doc.line(lineNum);
                const col = Math.min(errorPos.column - 1, line.length);
                const from = line.from + col;
                const to = Math.min(from + 1, line.to);
                showErrorDiagnostic(view, viewRef, from, to, errorMsg);
            }
        }
    }, [language, setLanguage, settings, isPro, setValidationToast]);

    // Mask Secrets handler
    const handleMaskSecrets = useCallback(() => {
        const view = viewRef.current;
        if (!view) return;

        const selection = view.state.selection.main;
        const cursorPos = selection.head;
        const text = selection.empty ? view.state.doc.toString() : view.state.sliceDoc(selection.from, selection.to);
        const from = selection.empty ? 0 : selection.from;
        const to = selection.empty ? view.state.doc.length : selection.to;

        if (!text.trim()) return;

        const masked = maskSecrets(text);

        const applyCallback = () => {
            const lengthDiff = masked.length - (to - from);
            const newCursorPos = cursorPos <= from ? cursorPos : cursorPos + lengthDiff;
            view.dispatch({
                changes: { from, to, insert: masked },
                selection: { anchor: newCursorPos },
            });
        };

        const showDiffPreview = settings?.show_diff_preview;
        if (showDiffPreview && isPro && text !== masked) {
            useDiffStore.getState().setPendingDiff({
                originalText: text,
                transformedText: masked,
                transformationType: 'Mask Secrets',
                selectionRange: selection.empty ? null : { from, to },
                cursorPos,
                applyCallback,
            });
            useDiffStore.getState().openPreviewModal();
        } else {
            applyCallback();
            if (text !== masked && isPro) {
                useDiffStore.getState().addTransformationRecord({
                    originalText: text,
                    transformedText: masked,
                    transformationType: 'Mask Secrets',
                });
            }
        }
    }, [settings, isPro]);

    // Context detection action handler
    const handleContextAction = useCallback((action: DetectorAction) => {
        if (action.id.startsWith('switch-language:')) {
            const lang = action.id.split(':')[1];
            setLanguage(lang);
            setContextDetection(null);
            return;
        }

        const result = action.execute(content);
        setContextDetection(null);

        if (typeof result === 'string') {
            setContent(result);
            return;
        }

        const actionResult = result as DetectorActionResult;
        if (actionResult.text !== content) {
            setContent(actionResult.text);
        }

        if (actionResult.validationMessage) {
            if (actionResult.validationType === 'success') {
                setValidationToast({ type: 'success', message: actionResult.validationMessage });
            } else if (actionResult.validationType === 'error') {
                setValidationToast({ type: 'error', message: actionResult.validationMessage });

                // Highlight the error position using CodeMirror diagnostics
                if (actionResult.errorLine && viewRef.current) {
                    const view = viewRef.current;
                    const line = view.state.doc.line(Math.min(actionResult.errorLine, view.state.doc.lines));
                    const errorCol = actionResult.errorColumn ? Math.min(actionResult.errorColumn - 1, line.length) : 0;
                    const from = line.from + errorCol;
                    const to = Math.min(from + 1, line.to);
                    showErrorDiagnostic(view, viewRef, from, to, actionResult.validationMessage ?? 'Error', 'Validate');
                }
            }
        }
    }, [content, setContent, setValidationToast, setLanguage, setContextDetection]);

    // URL Parser
    const handleParseUrl = useCallback(() => {
        if (!parsedUrlInfo || !viewRef.current) return;

        try {
            const url = new URL(parsedUrlInfo.url);
            const lines: string[] = [];

            lines.push(`Protocol: ${url.protocol.replace(':', '')}`);
            lines.push(`Host: ${url.hostname}`);
            if (url.port) lines.push(`Port: ${url.port}`);
            if (url.pathname && url.pathname !== '/') lines.push(`Path: ${url.pathname}`);
            if (url.search) {
                lines.push('Query Parameters:');
                url.searchParams.forEach((value, key) => {
                    lines.push(`  - ${key}: ${decodeURIComponent(value)}`);
                });
            }
            if (url.hash) lines.push(`Fragment: ${url.hash.slice(1)}`);
            lines.push(`Full URL: ${url.href}`);

            const output = lines.join('\n');
            const view = viewRef.current;
            const cursorPos = parsedUrlInfo.cursorPos;

            view.dispatch({
                changes: {from: cursorPos, to: cursorPos, insert: output},
                selection: {anchor: cursorPos + output.length},
            });
            view.focus();
        } catch {
            // Invalid URL, do nothing
        }

        setParsedUrlInfo(null);
    }, [parsedUrlInfo]);

    // Handle paste for file attachments and URL detection
    const handlePaste = useCallback(async (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        pasteOrDropRef.current = true;
        contextDismissedRef.current = null;

        const pastedText = e.clipboardData?.getData('text/plain');
        if (pastedText && isUrl(pastedText) && viewRef.current) {
            const selection = viewRef.current.state.selection.main;
            if (selection.empty) {
                setTimeout(() => {
                    if (viewRef.current) {
                        const newCursorPos = viewRef.current.state.selection.main.head;
                        setParsedUrlInfo({url: pastedText.trim(), cursorPos: newCursorPos});
                    }
                }, 10);
            }
        }

        if (!hasImageSupport) return;

        const filesToAdd: File[] = [];
        for (const item of Array.from(items)) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) filesToAdd.push(file);
            }
        }

        if (filesToAdd.length > 0) {
            e.preventDefault();
            for (const file of filesToAdd) {
                await addImage(file);
            }
        }
    }, [hasImageSupport, addImage]);

    useEffect(() => {
        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    // Drag and drop handlers
    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasImageSupport && e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    }, [hasImageSupport]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (hasImageSupport && e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            setIsDragging(true);
        }
    }, [hasImageSupport]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (!hasImageSupport) return;

        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            await addImage(file);
        }
    }, [hasImageSupport, addImage]);

    // Focus editor when window becomes visible
    useEffect(() => {
        const shouldFocusEditor = isVisible && activePanel === 'editor';
        if (shouldFocusEditor && viewRef.current) {
            setTimeout(() => {
                const view = viewRef.current;
                if (view) {
                    view.focus();
                    const endPos = view.state.doc.length;
                    view.dispatch({ selection: { anchor: endPos } });
                }
            }, 50);
        }
    }, [isVisible, activePanel]);

    const getLanguageExtension = useCallback(() => {
        const langFn = languages[language];
        return langFn ? [langFn()] : [];
    }, [language]);

    // Store current content before recreating editor
    const contentRef = useRef(content);
    useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // Initialize CodeMirror editor
    useEffect(() => {
        if (!editorRef.current) return;

        const extensions = [
            history(),
            EditorState.allowMultipleSelections.of(true),
            drawSelection(),
            dropCursor(),
            editorKeymap,
            keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
            search({ top: true }),
            placeholder('Start typing...'),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
                if (update.docChanged) {
                    setContent(update.state.doc.toString());
                }
            }),
            clipboardDropHandler,
            ...getLanguageExtension(),
        ];

        // Only apply markdown rendering when markdown language is selected
        if (language === 'markdown') {
            extensions.push(
                markdownLinkPasteHandler,
                markdownPlugin,
                markdownTheme,
                codeBlockTheme
            );
        }

        if (hasProEditorFeatures) {
            extensions.push(
                bracketMatching(),
                closeBrackets(),
                keymap.of(closeBracketsKeymap),
                autocompletion({ activateOnTyping: true, maxRenderedOptions: 10 })
            );

            // Enable linters for supported languages
            if (language === 'json') {
                extensions.push(lintGutter(), linter(jsonLinter, { delay: 300 }));
            } else if (language === 'xml') {
                extensions.push(lintGutter(), linter(xmlLinter, { delay: 300 }));
            } else if (language === 'python') {
                extensions.push(lintGutter(), linter(pythonLinter, { delay: 300 }));
            } else if (language === 'html') {
                extensions.push(lintGutter(), linter(htmlLinter, { delay: 300 }));
            } else if (language === 'yaml') {
                extensions.push(lintGutter(), linter(yamlLinter, { delay: 300 }));
            }
        }

        const lightThemes = ['light', 'solarized-light'];
        const isLightTheme = settings?.theme && lightThemes.includes(settings.theme);

        if (!isLightTheme) {
            extensions.push(oneDark);
        }

        extensions.push(EditorView.theme({
            '&': { backgroundColor: 'transparent' },
            '.cm-scroller': { backgroundColor: 'transparent' },
            '.cm-content': { backgroundColor: 'transparent' },
            '.cm-gutters': { backgroundColor: 'transparent' },
        }));

        if (isLightTheme) {
            extensions.push(EditorView.theme({
                '.cm-content': { color: '#1a1a1a' },
                '.cm-gutters': { color: '#666666' },
                '.cm-cursor': { borderLeftColor: '#1a1a1a' },
                '.cm-activeLine': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                '.cm-activeLineGutter': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
            }));
        }

        const state = EditorState.create({
            doc: contentRef.current,
            extensions,
        });

        const view = new EditorView({
            state,
            parent: editorRef.current,
        });

        viewRef.current = view;
        setEditorView(view);
        view.focus();

        return () => {
            view.destroy();
            setEditorView(null);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language, settings?.theme, setContent, getLanguageExtension, hasProEditorFeatures]);

    // Listen for refocus events
    useEffect(() => {
        const unlisten = listen('refocus-editor', () => {
            if (viewRef.current) {
                viewRef.current.focus();
            }
        });
        return () => { unlisten.then(fn => fn()); };
    }, []);

    // Update editor content when it changes externally
    useEffect(() => {
        if (viewRef.current) {
            const currentContent = viewRef.current.state.doc.toString();
            if (currentContent !== content) {
                viewRef.current.dispatch({
                    changes: { from: 0, to: currentContent.length, insert: content },
                });
            }
        }
    }, [content]);

    return (
        <div
            className="flex flex-col h-full relative"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <Toolbar
                onTransform={transformText}
                onBulletList={applyBulletList}
                onNumberedList={applyNumberedList}
                onFormat={handleFormat}
                onMinify={handleMinify}
                onMaskSecrets={handleMaskSecrets}
                language={language}
            />

            <FileDragOverlay isDragging={isDragging} />

            <ClipboardDragIndicator
                isDraggingClipboardItem={isDraggingClipboardItem}
                hasClipboardDragDrop={hasClipboardDragDrop}
                cursorPosition={cursorPosition}
                editorInsertPosition={editorInsertPosition}
                editorContainerRef={editorContainerRef}
                viewRef={viewRef}
            />

            <AILoadingOverlay isLoading={aiLoading} />

            <div
                ref={(el) => {
                    editorRef.current = el;
                    editorContainerRef.current = el;
                }}
                className={`flex-1 overflow-hidden editor-pane${settings?.colorblind_mode ? ' colorblind-editor' : ''}`}
                style={{
                    fontFamily: settings?.font_family || 'monospace',
                    fontSize: `${settings?.font_size || 14}px`,
                }}
            />

            <AttachmentsBar
                images={images}
                removeImage={removeImage}
                hasContent={!!content.trim()}
            />

            {settings?.show_status_bar !== false && (
                <StatusBar
                    stats={stats}
                    language={language}
                    setLanguage={setLanguage}
                    hasStatsDisplay={hasStatsDisplay}
                    isProFeatureEnabled={() => isPro}
                />
            )}

            <ActionButtons
                content={content}
                hasImages={images.length > 0}
                isPremium={isPremium}
                aiLoading={aiLoading}
                selectedPreset={selectedPreset}
                selectedCustomPrompt={selectedCustomPrompt}
                enabledPresets={enabledPresets}
                enabledCustomPrompts={enabledCustomPrompts}
                onAiButtonClick={handleAiButtonClick}
                onSelectPreset={handleSelectPreset}
                onSelectCustomPrompt={handleSelectCustomPrompt}
                hasObsidianAccess={hasObsidianAccess}
                hasObsidianConfigured={!!hasObsidianConfigured}
                onObsidianSend={handleObsidianSend}
                hasGitHubAccess={hasGitHubAccess}
                isGitHubAuthenticated={isGitHubAuthenticated}
                gistLoading={gistLoading}
                onGitHubGist={handleGitHubGist}
                onSaveToFile={saveToFile}
                onCopyAsFile={handleCopyAsFile}
                settings={settings}
                onPasteAndClose={pasteAndClose}
                onUpdateSettings={updateSettings}
                aiError={aiError}
                githubError={githubError}
            />

            <FloatingNotifications
                parsedUrlInfo={parsedUrlInfo}
                onParseUrl={handleParseUrl}
                onDismissUrlParser={() => setParsedUrlInfo(null)}
                obsidianToast={obsidianToast}
                onToastClick={handleToastClick}
                gistToast={gistToast}
                onGistToastOpen={handleGistToastOpen}
                onGistToastDismiss={() => setGistToast(null)}
                validationToast={validationToast}
                onDismissValidation={() => setValidationToast(null)}
                contextDetection={contextDetection}
                onContextAction={handleContextAction}
                onDismissContext={() => {
                    contextDismissedRef.current = contextDetection?.detectorId ?? null;
                    setContextDetection(null);
                }}
            />

            <TransformationFloatingButton />
            <DiffPreviewModal />
            <DiffReviewModal />
        </div>
    );
}
