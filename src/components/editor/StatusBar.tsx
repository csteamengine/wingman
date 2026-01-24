import {useRef, useState, useEffect} from 'react';
import {LANGUAGE_OPTIONS} from './languageConfig';
import type {TextStats} from '../../types';

import type { ProFeature } from '../../types';

interface StatusBarProps {
    stats: TextStats;
    language: string;
    setLanguage: (lang: string) => void;
    hasStatsDisplay: boolean;
    isProFeatureEnabled: (feature: ProFeature) => boolean;
}

export function StatusBar({
    stats,
    language,
    setLanguage,
    hasStatsDisplay,
    isProFeatureEnabled,
}: StatusBarProps) {
    const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
    const languageDropdownRef = useRef<HTMLDivElement>(null);

    // Close language dropdown when clicking outside
    useEffect(() => {
        if (!showLanguageDropdown) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (languageDropdownRef.current && !languageDropdownRef.current.contains(e.target as Node)) {
                setShowLanguageDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showLanguageDropdown]);

    return (
        <div className="border-t border-[var(--ui-border)]">
            {/* Stats info row */}
            <div className="flex items-center justify-between px-4 py-2 text-xs text-[var(--ui-text-muted)]">
                <div className="flex items-center gap-3">
                    {hasStatsDisplay ? (
                        <>
                            <span>{stats.character_count} chars</span>
                            <span className="opacity-30">·</span>
                            <span>{stats.word_count} words</span>
                            <span className="opacity-30">·</span>
                            <span>{stats.line_count} lines</span>
                        </>
                    ) : (
                        <span className="opacity-60">Pro: Stats</span>
                    )}
                </div>
                {/* Language Selector */}
                <div className="relative" ref={languageDropdownRef}>
                    <button
                        onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                        className="text-xs px-2 py-1 rounded-md hover:bg-[var(--ui-hover)] transition-colors"
                    >
                        {LANGUAGE_OPTIONS.find(l => l.value === language)?.label || 'Plain Text'}
                        {LANGUAGE_OPTIONS.find(l => l.value === language)?.isPro && (
                            <span className="ml-1 text-[9px] text-[var(--ui-accent)]">PRO</span>
                        )}
                        <span className="ml-1 opacity-40">▾</span>
                    </button>
                    {showLanguageDropdown && (
                        <div
                            className="absolute bottom-full mb-1 right-0 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-md shadow-lg z-50 min-w-[140px] max-h-[280px] overflow-y-auto py-1">
                            {LANGUAGE_OPTIONS.map((lang) => {
                                const isProLang = lang.isPro;
                                const hasAccess = !isProLang || isProFeatureEnabled('syntax_highlighting');
                                return (
                                    <button
                                        key={lang.value}
                                        onClick={() => {
                                            if (hasAccess) {
                                                setLanguage(lang.value);
                                                setShowLanguageDropdown(false);
                                            }
                                        }}
                                        disabled={!hasAccess}
                                        className={`w-full text-left text-xs px-3 py-1.5 flex items-center justify-between ${
                                            hasAccess ? 'hover:bg-[var(--ui-hover)]' : 'opacity-50 cursor-not-allowed'
                                        } ${language === lang.value ? 'text-[var(--ui-accent)]' : ''}`}
                                    >
                                        <span>{lang.label}</span>
                                        {isProLang && (
                                            <span className="text-[9px] text-[var(--ui-accent)] ml-2">PRO</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
