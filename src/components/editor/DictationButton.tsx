import { useState, useRef } from 'react';
import { Mic, Square } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export function DictationButton() {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggling = useRef(false);

  const handleClick = async () => {
    if (toggling.current) return;
    toggling.current = true;
    try {
      if (isRecording) {
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
          isRecording
            ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
            : 'bg-[var(--ui-surface-solid)] border-[var(--ui-border)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)]'
        }`}
        aria-label={isRecording ? 'Stop dictation' : 'Start dictation'}
        title={isRecording ? 'Stop dictation' : 'Start dictation'}
      >
        {isRecording ? (
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
