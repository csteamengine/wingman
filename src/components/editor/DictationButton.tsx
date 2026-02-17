import { useState, useRef } from 'react';
import { Mic, Square } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface DictationButtonProps {
  /** True while the editor is in a composition session (dictation or IME). */
  isComposing?: boolean;
  /** DOM-level fallback to end an active composition (blur/refocus the editor). */
  onStopFallback?: () => void;
}

export function DictationButton({ isComposing = false, onStopFallback }: DictationButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggling = useRef(false);

  // Dictation is active if we started it via the button OR if the editor
  // entered a composition session from another source (e.g. system hotkey).
  const isActive = isRecording || isComposing;

  const handleClick = async () => {
    if (toggling.current) return;
    toggling.current = true;

    // Safety: never leave the toggle guard stuck for more than 2 s.
    const safety = setTimeout(() => { toggling.current = false; }, 2000);

    try {
      if (isActive) {
        // --- STOP ---
        // Fire-and-forget the native stop (non-blocking on Rust side).
        invoke('stop_dictation').catch(() => {});
        // DOM-level fallback: toggle contentEditable off/on to tear down the
        // composition session in WKWebView.
        onStopFallback?.();
        setIsRecording(false);
        // Brief cooldown covering the Rust-side afterDelay restore window.
        await new Promise((r) => setTimeout(r, 300));
      } else {
        // --- START ---
        // Update the icon immediately, then fire-and-forget the Tauri command.
        // The Rust side blocks up to 500 ms waiting for the main-thread action
        // to execute, so we must NOT await it or the icon won't update and the
        // toggle guard will be held.
        setIsRecording(true);
        invoke('start_dictation').catch((e) => {
          setIsRecording(false);
          setError(String(e));
          setTimeout(() => setError(null), 3000);
        });
      }
    } finally {
      clearTimeout(safety);
      toggling.current = false;
    }
  };

  return (
    <div className="absolute bottom-3 right-3 z-40">
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleClick}
        className={`flex items-center justify-center w-8 h-8 rounded-lg border shadow-lg transition-colors ${
          isActive
            ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
            : 'bg-[var(--ui-surface-solid)] border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)]'
        }`}
        aria-label={isActive ? 'Stop dictation' : 'Start dictation'}
        title={isActive ? 'Stop dictation' : 'Start dictation'}
      >
        {isActive ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </button>
      {error && (
        <div className="absolute bottom-10 right-0 whitespace-nowrap px-2 py-1 text-xs rounded bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] shadow-lg text-[var(--ui-text-muted)]">
          {error}
        </div>
      )}
    </div>
  );
}
