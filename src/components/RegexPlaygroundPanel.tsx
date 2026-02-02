import { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, Copy, RefreshCw, Info } from 'lucide-react';
import { useEditorStore } from '../stores/editorStore';
import { useRegexPlaygroundStore, type RegexMatch } from '../stores/regexPlaygroundStore';
import { ProFeatureGate } from './ProFeatureGate';
import { REGEX_SNIPPETS } from '../lib/regexSnippets';
import { explainRegex, getExplanationColor } from '../lib/regexExplainer';

// Flag button component
function FlagButton({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={description}
      className={`px-2 py-1 text-xs font-mono rounded transition-colors ${
        active
          ? 'bg-[var(--ui-accent)] text-white'
          : 'bg-[var(--ui-surface)] text-[var(--ui-text-muted)] hover:bg-[var(--ui-hover)]'
      }`}
    >
      {label}
    </button>
  );
}

// Match list item component
function MatchItem({
  match,
  isActive,
  onClick,
}: {
  match: RegexMatch;
  isActive: boolean;
  onClick: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border rounded-md transition-colors cursor-pointer ${
        isActive
          ? 'border-[var(--ui-accent)] bg-[var(--ui-accent)]/10'
          : 'border-[var(--ui-border)] hover:border-[var(--ui-accent)]/50'
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs text-[var(--ui-text-muted)] font-mono">#{match.index + 1}</span>
        <span className="flex-1 text-sm font-mono text-[var(--ui-text)] truncate">
          {match.match || <span className="text-[var(--ui-text-muted)] italic">(empty match)</span>}
        </span>
        <span className="text-[10px] text-[var(--ui-text-muted)]">
          {match.start}-{match.end}
        </span>
        {match.groups.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 hover:bg-[var(--ui-hover)] rounded"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        )}
      </div>
      {expanded && match.groups.length > 0 && (
        <div className="border-t border-[var(--ui-border)] px-3 py-2 space-y-1">
          {match.groups.map((group, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="text-[var(--ui-accent)] font-mono">{group.name}:</span>
              <span className="text-[var(--ui-text)] font-mono truncate">
                {group.value || <span className="text-[var(--ui-text-muted)]">(empty)</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Text with highlighted matches
function HighlightedText({
  text,
  matches,
  currentMatchIndex,
}: {
  text: string;
  matches: RegexMatch[];
  currentMatchIndex: number;
}) {
  const segments: Array<{ text: string; isMatch: boolean; isCurrent: boolean; matchIndex: number }> = [];
  let lastEnd = 0;

  // Sort matches by start position
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);

  for (let i = 0; i < sortedMatches.length; i++) {
    const match = sortedMatches[i];

    // Add text before match
    if (match.start > lastEnd) {
      segments.push({
        text: text.slice(lastEnd, match.start),
        isMatch: false,
        isCurrent: false,
        matchIndex: -1,
      });
    }

    // Add match
    segments.push({
      text: text.slice(match.start, match.end),
      isMatch: true,
      isCurrent: match.index === currentMatchIndex,
      matchIndex: match.index,
    });

    lastEnd = match.end;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    segments.push({
      text: text.slice(lastEnd),
      isMatch: false,
      isCurrent: false,
      matchIndex: -1,
    });
  }

  return (
    <div className="whitespace-pre-wrap break-words font-mono text-sm text-[var(--ui-text)]">
      {segments.map((segment, i) => (
        <span
          key={i}
          className={
            segment.isMatch
              ? segment.isCurrent
                ? 'bg-yellow-400/50 rounded px-0.5'
                : 'bg-yellow-200/30 rounded px-0.5'
              : ''
          }
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}

function RegexPlaygroundContent() {
  const { setActivePanel } = useEditorStore();
  const {
    pattern,
    inputText,
    replacement,
    flags,
    matches,
    currentMatchIndex,
    error,
    showReplace,
    showExplanation,
    setPattern,
    setInputText,
    setReplacement,
    toggleFlag,
    setCurrentMatchIndex,
    setShowReplace,
    setShowExplanation,
    nextMatch,
    prevMatch,
    loadSnippet,
    reset,
  } = useRegexPlaygroundStore();

  const [snippetDropdownOpen, setSnippetDropdownOpen] = useState(false);
  const snippetRef = useRef<HTMLDivElement>(null);
  const patternInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!snippetDropdownOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (snippetRef.current && !snippetRef.current.contains(e.target as Node)) {
        setSnippetDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [snippetDropdownOpen]);

  // Calculate replacement preview
  const replacementPreview = useMemo(() => {
    if (!showReplace || !pattern || !replacement) return '';
    try {
      const flagsStr = [
        flags.g ? 'g' : '',
        flags.m ? 'm' : '',
        flags.i ? 'i' : '',
        flags.s ? 's' : '',
        flags.u ? 'u' : '',
      ].join('');
      const regex = new RegExp(pattern, flagsStr);
      return inputText.replace(regex, replacement);
    } catch {
      return inputText;
    }
  }, [pattern, inputText, replacement, flags, showReplace]);

  // Get pattern explanation
  const explanation = useMemo(() => {
    if (!showExplanation || !pattern) return [];
    return explainRegex(pattern);
  }, [pattern, showExplanation]);

  // Copy pattern to clipboard
  const copyPattern = useCallback(() => {
    navigator.clipboard.writeText(pattern);
  }, [pattern]);

  // Copy replacement result to clipboard
  const copyReplacement = useCallback(() => {
    navigator.clipboard.writeText(replacementPreview);
  }, [replacementPreview]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--ui-border)]">
        <button
          onClick={() => setActivePanel('editor')}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors flex-shrink-0"
          aria-label="Back to editor"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 3L4.5 7L8.5 11" />
          </svg>
        </button>
        <h2 className="text-sm font-medium text-[var(--ui-text)] flex-1">Regex Playground</h2>
        <button
          onClick={reset}
          className="p-1.5 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] rounded"
          title="Reset"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Pattern Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[var(--ui-text)]">Pattern</label>
            <div className="flex items-center gap-2">
              {/* Snippets Dropdown */}
              <div ref={snippetRef} className="relative">
                <button
                  onClick={() => setSnippetDropdownOpen(!snippetDropdownOpen)}
                  className="text-xs text-[var(--ui-accent)] hover:underline flex items-center gap-1"
                >
                  Snippets
                  <ChevronDown className="w-3 h-3" />
                </button>
                {snippetDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-64 max-h-64 overflow-y-auto bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-md shadow-lg py-1">
                    {REGEX_SNIPPETS.map((snippet) => (
                      <button
                        key={snippet.name}
                        onClick={() => {
                          loadSnippet(snippet.pattern, snippet.flags);
                          setSnippetDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-[var(--ui-hover)] transition-colors"
                      >
                        <div className="text-xs font-medium text-[var(--ui-text)]">{snippet.name}</div>
                        <div className="text-[10px] text-[var(--ui-text-muted)] truncate">{snippet.description}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={copyPattern}
                className="p-1 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] rounded"
                title="Copy pattern"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-muted)] font-mono">/</span>
              <input
                ref={patternInputRef}
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Enter regex pattern..."
                spellCheck={false}
                className={`w-full pl-6 pr-3 py-2 text-sm font-mono bg-[var(--ui-surface)] border rounded-md text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)] ${
                  error ? 'border-red-500' : 'border-[var(--ui-border)]'
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ui-text-muted)] font-mono">/</span>
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-400 mt-1">{error}</p>
          )}
        </div>

        {/* Flags */}
        <div>
          <label className="text-xs font-medium text-[var(--ui-text)] mb-2 block">Flags</label>
          <div className="flex flex-wrap gap-2">
            <FlagButton label="g" description="Global - Find all matches" active={flags.g} onClick={() => toggleFlag('g')} />
            <FlagButton label="m" description="Multiline - ^ and $ match line boundaries" active={flags.m} onClick={() => toggleFlag('m')} />
            <FlagButton label="i" description="Case insensitive" active={flags.i} onClick={() => toggleFlag('i')} />
            <FlagButton label="s" description="Dotall - . matches newlines" active={flags.s} onClick={() => toggleFlag('s')} />
            <FlagButton label="u" description="Unicode - Enable Unicode support" active={flags.u} onClick={() => toggleFlag('u')} />
          </div>
        </div>

        {/* Explanation Toggle */}
        <div>
          <button
            onClick={() => setShowExplanation(!showExplanation)}
            className="flex items-center gap-2 text-xs text-[var(--ui-accent)] hover:underline"
          >
            <Info className="w-3 h-3" />
            {showExplanation ? 'Hide explanation' : 'Show explanation'}
          </button>
          {showExplanation && pattern && (
            <div className="mt-2 p-3 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md">
              <div className="flex flex-wrap gap-x-1 gap-y-2">
                {explanation.map((token, i) => (
                  <div key={i} className="group relative">
                    <span className={`font-mono text-sm ${getExplanationColor(token.type)}`}>
                      {token.token}
                    </span>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 text-[10px] bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      {token.explanation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Test Input */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-[var(--ui-text)]">Test String</label>
            <span className="text-[10px] text-[var(--ui-text-muted)]">
              {matches.length} match{matches.length !== 1 ? 'es' : ''}
            </span>
          </div>
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter test string..."
              rows={5}
              spellCheck={false}
              className="w-full px-3 py-2 text-sm font-mono bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] resize-none focus:outline-none focus:border-[var(--ui-accent)]"
            />
          </div>
          {/* Highlighted preview */}
          {inputText && matches.length > 0 && (
            <div className="mt-2 p-3 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md max-h-32 overflow-y-auto">
              <HighlightedText
                text={inputText}
                matches={matches}
                currentMatchIndex={currentMatchIndex}
              />
            </div>
          )}
        </div>

        {/* Matches List */}
        {matches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[var(--ui-text)]">Matches</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={prevMatch}
                  disabled={currentMatchIndex === 0}
                  className="p-1 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] disabled:opacity-40 rounded"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-[var(--ui-text-muted)]">
                  {currentMatchIndex + 1} / {matches.length}
                </span>
                <button
                  onClick={nextMatch}
                  disabled={currentMatchIndex === matches.length - 1}
                  className="p-1 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] disabled:opacity-40 rounded"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {matches.map((match) => (
                <MatchItem
                  key={match.index}
                  match={match}
                  isActive={match.index === currentMatchIndex}
                  onClick={() => setCurrentMatchIndex(match.index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Replace Mode */}
        <div>
          <button
            onClick={() => setShowReplace(!showReplace)}
            className="flex items-center gap-2 text-xs text-[var(--ui-accent)] hover:underline mb-2"
          >
            {showReplace ? 'Hide replace' : 'Show replace'}
          </button>
          {showReplace && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-[var(--ui-text)] mb-1 block">Replacement Pattern</label>
                <input
                  type="text"
                  value={replacement}
                  onChange={(e) => setReplacement(e.target.value)}
                  placeholder="Enter replacement pattern... (use $1, $2 for groups)"
                  spellCheck={false}
                  className="w-full px-3 py-2 text-sm font-mono bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)]"
                />
              </div>
              {replacement && inputText && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-[var(--ui-text)]">Preview</label>
                    <button
                      onClick={copyReplacement}
                      className="p-1 text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] rounded"
                      title="Copy result"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="p-3 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md max-h-32 overflow-y-auto">
                    <pre className="whitespace-pre-wrap break-words font-mono text-sm text-[var(--ui-text)]">
                      {replacementPreview}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RegexPlaygroundPanel() {
  return (
    <ProFeatureGate feature="regex_playground">
      <RegexPlaygroundContent />
    </ProFeatureGate>
  );
}
