import { useState, useRef, useEffect } from 'react';
import { Mic, Square } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

interface DictationButtonProps {
  /** True while the editor is in a composition session (dictation or IME). */
  isComposing?: boolean;
}

export function DictationButton({ isComposing = false }: DictationButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggling = useRef(false);

  // If composition ends externally (e.g. system dictation timeout) while we
  // thought we were recording, reset our local state.
  useEffect(() => {
    if (!isComposing && isRecording) {
      setIsRecording(false);
    }
  }, [isComposing, isRecording]);

  // Dictation is active if we started it via the button OR if the editor
  // entered a composition session from another source (e.g. system hotkey).
  const isActive = isRecording || isComposing;

  const handleClick = async () => {
    if (toggling.current) return;
    toggling.current = true;
    try {
      if (isActive) {
        await invoke('stop_dictation');
        setIsRecording(false);
        // Brief cooldown covering the Rust-side afterDelay restore window
        await new Promise((r) => setTimeout(r, 300));
      } else {
        await invoke('start_dictation');
        setIsRecording(true);
      }
    } catch (e) {
      setIsRecording(false);
      setError(String(e));
      setTimeout(() => setError(null), 3000);
    } finally {
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
