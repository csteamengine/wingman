import { create } from 'zustand';

export interface RegexMatch {
  index: number;
  match: string;
  groups: { name: string; value: string }[];
  start: number;
  end: number;
}

export interface RegexFlags {
  g: boolean;
  m: boolean;
  i: boolean;
  s: boolean;
  u: boolean;
}

interface RegexPlaygroundState {
  pattern: string;
  inputText: string;
  replacement: string;
  flags: RegexFlags;
  matches: RegexMatch[];
  currentMatchIndex: number;
  error: string | null;
  showReplace: boolean;
  showExplanation: boolean;

  // Actions
  setPattern: (pattern: string) => void;
  setInputText: (text: string) => void;
  setReplacement: (replacement: string) => void;
  toggleFlag: (flag: keyof RegexFlags) => void;
  setCurrentMatchIndex: (index: number) => void;
  setShowReplace: (show: boolean) => void;
  setShowExplanation: (show: boolean) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  loadSnippet: (pattern: string, flags?: string) => void;
  reset: () => void;
}

function buildFlagsString(flags: RegexFlags): string {
  let result = '';
  if (flags.g) result += 'g';
  if (flags.m) result += 'm';
  if (flags.i) result += 'i';
  if (flags.s) result += 's';
  if (flags.u) result += 'u';
  return result;
}

function parseFlags(flagsStr: string): Partial<RegexFlags> {
  const flags: Partial<RegexFlags> = {};
  if (flagsStr.includes('g')) flags.g = true;
  if (flagsStr.includes('m')) flags.m = true;
  if (flagsStr.includes('i')) flags.i = true;
  if (flagsStr.includes('s')) flags.s = true;
  if (flagsStr.includes('u')) flags.u = true;
  return flags;
}

function executeRegex(pattern: string, input: string, flags: RegexFlags): { matches: RegexMatch[]; error: string | null } {
  if (!pattern) {
    return { matches: [], error: null };
  }

  try {
    const flagsStr = buildFlagsString(flags);
    const regex = new RegExp(pattern, flagsStr);
    const matches: RegexMatch[] = [];

    if (flags.g) {
      let match: RegExpExecArray | null;
      let index = 0;
      while ((match = regex.exec(input)) !== null) {
        const groups: { name: string; value: string }[] = [];

        // Extract named groups
        if (match.groups) {
          for (const [name, value] of Object.entries(match.groups)) {
            groups.push({ name, value: value ?? '' });
          }
        }

        // Extract numbered groups
        for (let i = 1; i < match.length; i++) {
          const existingNamed = groups.find(g => g.value === match![i]);
          if (!existingNamed && match[i] !== undefined) {
            groups.push({ name: `$${i}`, value: match[i] });
          }
        }

        matches.push({
          index,
          match: match[0],
          groups,
          start: match.index,
          end: match.index + match[0].length,
        });
        index++;

        // Prevent infinite loops on zero-length matches
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }
    } else {
      const match = regex.exec(input);
      if (match) {
        const groups: { name: string; value: string }[] = [];

        if (match.groups) {
          for (const [name, value] of Object.entries(match.groups)) {
            groups.push({ name, value: value ?? '' });
          }
        }

        for (let i = 1; i < match.length; i++) {
          const existingNamed = groups.find(g => g.value === match[i]);
          if (!existingNamed && match[i] !== undefined) {
            groups.push({ name: `$${i}`, value: match[i] });
          }
        }

        matches.push({
          index: 0,
          match: match[0],
          groups,
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }

    return { matches, error: null };
  } catch (e) {
    return { matches: [], error: e instanceof Error ? e.message : String(e) };
  }
}

const DEFAULT_FLAGS: RegexFlags = {
  g: true,
  m: false,
  i: false,
  s: false,
  u: false,
};

export const useRegexPlaygroundStore = create<RegexPlaygroundState>((set, get) => ({
  pattern: '',
  inputText: '',
  replacement: '',
  flags: { ...DEFAULT_FLAGS },
  matches: [],
  currentMatchIndex: 0,
  error: null,
  showReplace: false,
  showExplanation: false,

  setPattern: (pattern) => {
    const { inputText, flags } = get();
    const { matches, error } = executeRegex(pattern, inputText, flags);
    set({ pattern, matches, error, currentMatchIndex: 0 });
  },

  setInputText: (inputText) => {
    const { pattern, flags } = get();
    const { matches, error } = executeRegex(pattern, inputText, flags);
    set({ inputText, matches, error, currentMatchIndex: 0 });
  },

  setReplacement: (replacement) => {
    set({ replacement });
  },

  toggleFlag: (flag) => {
    const { pattern, inputText, flags } = get();
    const newFlags = { ...flags, [flag]: !flags[flag] };
    const { matches, error } = executeRegex(pattern, inputText, newFlags);
    set({ flags: newFlags, matches, error, currentMatchIndex: 0 });
  },

  setCurrentMatchIndex: (currentMatchIndex) => {
    const { matches } = get();
    if (currentMatchIndex >= 0 && currentMatchIndex < matches.length) {
      set({ currentMatchIndex });
    }
  },

  setShowReplace: (showReplace) => {
    set({ showReplace });
  },

  setShowExplanation: (showExplanation) => {
    set({ showExplanation });
  },

  nextMatch: () => {
    const { currentMatchIndex, matches } = get();
    if (currentMatchIndex < matches.length - 1) {
      set({ currentMatchIndex: currentMatchIndex + 1 });
    }
  },

  prevMatch: () => {
    const { currentMatchIndex } = get();
    if (currentMatchIndex > 0) {
      set({ currentMatchIndex: currentMatchIndex - 1 });
    }
  },

  loadSnippet: (pattern, flagsStr) => {
    const { inputText } = get();
    const newFlags = flagsStr ? { ...DEFAULT_FLAGS, ...parseFlags(flagsStr) } : { ...DEFAULT_FLAGS };
    const { matches, error } = executeRegex(pattern, inputText, newFlags);
    set({ pattern, flags: newFlags, matches, error, currentMatchIndex: 0 });
  },

  reset: () => {
    set({
      pattern: '',
      inputText: '',
      replacement: '',
      flags: { ...DEFAULT_FLAGS },
      matches: [],
      currentMatchIndex: 0,
      error: null,
      showReplace: false,
      showExplanation: false,
    });
  },
}));
