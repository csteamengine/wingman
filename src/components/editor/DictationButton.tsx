import { useState } from 'react';
import { Mic } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export function DictationButton() {
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    try {
      await invoke('start_dictation');
    } catch (e) {
      setError(String(e));
      setTimeout(() => setError(null), 3000);
    }
  };

  return (
    <div className="absolute bottom-14 right-3 z-40">
      <button
        onClick={handleClick}
        className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] shadow-lg text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
        aria-label="Start dictation"
        title="Start dictation"
      >
        <Mic className="w-4 h-4" />
      </button>
      {error && (
        <div className="absolute bottom-10 right-0 whitespace-nowrap px-2 py-1 text-xs rounded bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] shadow-lg text-[var(--ui-text-muted)]">
          {error}
        </div>
      )}
    </div>
  );
}
