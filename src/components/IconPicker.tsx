import { useState, useRef, useEffect } from 'react';
import {
  Wand2,
  Sparkles,
  Zap,
  Code,
  Hash,
  Braces,
  Terminal,
  Replace,
  Type,
  Filter,
  ArrowRightLeft,
  RefreshCw,
  Shuffle,
  SortAsc,
  SortDesc,
  AlignLeft,
  AlignJustify,
  FileText,
  FileCode,
  Regex,
  Binary,
  Link,
  Unlink,
  Scissors,
  Copy,
  Eraser,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Icon map for dynamic rendering
const ICON_MAP: Record<string, LucideIcon> = {
  Wand2,
  Sparkles,
  Zap,
  Code,
  Hash,
  Braces,
  Terminal,
  Replace,
  Type,
  Filter,
  ArrowRightLeft,
  RefreshCw,
  Shuffle,
  SortAsc,
  SortDesc,
  AlignLeft,
  AlignJustify,
  FileText,
  FileCode,
  Regex,
  Binary,
  Link,
  Unlink,
  Scissors,
  Copy,
  Eraser,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

export function getIconComponent(iconName: string): LucideIcon {
  return ICON_MAP[iconName] || Wand2;
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const SelectedIcon = getIconComponent(value);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface)] hover:bg-[var(--ui-hover)] transition-colors"
        title="Select icon"
      >
        <SelectedIcon className="w-5 h-5 text-[var(--ui-text)]" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-md shadow-lg p-2">
          <div className="grid grid-cols-5 gap-1 w-[200px]">
            {AVAILABLE_ICONS.map((iconName) => {
              const Icon = ICON_MAP[iconName];
              const isSelected = value === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => {
                    onChange(iconName);
                    setIsOpen(false);
                  }}
                  className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${
                    isSelected
                      ? 'bg-[var(--ui-accent)] text-white'
                      : 'hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]'
                  }`}
                  title={iconName}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
