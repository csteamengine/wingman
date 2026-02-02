export interface ExplanationToken {
  token: string;
  explanation: string;
  type: 'metachar' | 'quantifier' | 'group' | 'class' | 'anchor' | 'escape' | 'literal';
}

const TOKEN_PATTERNS: Array<{
  regex: RegExp;
  explain: (match: RegExpMatchArray) => ExplanationToken;
}> = [
  // Named capture group
  {
    regex: /^\(\?<([^>]+)>([^)]*)\)/,
    explain: (m) => ({
      token: m[0],
      explanation: `named capture group '${m[1]}'`,
      type: 'group',
    }),
  },
  // Non-capturing group
  {
    regex: /^\(\?:([^)]*)\)/,
    explain: (m) => ({
      token: m[0],
      explanation: 'non-capturing group',
      type: 'group',
    }),
  },
  // Lookahead
  {
    regex: /^\(\?=([^)]*)\)/,
    explain: (m) => ({
      token: m[0],
      explanation: 'positive lookahead',
      type: 'group',
    }),
  },
  // Negative lookahead
  {
    regex: /^\(\?!([^)]*)\)/,
    explain: (m) => ({
      token: m[0],
      explanation: 'negative lookahead',
      type: 'group',
    }),
  },
  // Lookbehind
  {
    regex: /^\(\?<=([^)]*)\)/,
    explain: (m) => ({
      token: m[0],
      explanation: 'positive lookbehind',
      type: 'group',
    }),
  },
  // Negative lookbehind
  {
    regex: /^\(\?<!([^)]*)\)/,
    explain: (m) => ({
      token: m[0],
      explanation: 'negative lookbehind',
      type: 'group',
    }),
  },
  // Capture group
  {
    regex: /^\(([^?][^)]*)\)/,
    explain: (m) => ({
      token: m[0],
      explanation: 'capture group',
      type: 'group',
    }),
  },
  // Character class
  {
    regex: /^\[(\^?)([^\]]+)\]/,
    explain: (m) => ({
      token: m[0],
      explanation: m[1] ? `any character NOT in: ${m[2]}` : `any character in: ${m[2]}`,
      type: 'class',
    }),
  },
  // Quantifier with range
  {
    regex: /^\{(\d+)(?:,(\d*))?\}/,
    explain: (m) => ({
      token: m[0],
      explanation: m[2] === undefined
        ? `exactly ${m[1]} times`
        : m[2] === ''
          ? `${m[1]} or more times`
          : `${m[1]} to ${m[2]} times`,
      type: 'quantifier',
    }),
  },
  // Escaped characters
  {
    regex: /^\\d/,
    explain: () => ({
      token: '\\d',
      explanation: 'any digit (0-9)',
      type: 'escape',
    }),
  },
  {
    regex: /^\\D/,
    explain: () => ({
      token: '\\D',
      explanation: 'any non-digit',
      type: 'escape',
    }),
  },
  {
    regex: /^\\w/,
    explain: () => ({
      token: '\\w',
      explanation: 'any word character (a-z, A-Z, 0-9, _)',
      type: 'escape',
    }),
  },
  {
    regex: /^\\W/,
    explain: () => ({
      token: '\\W',
      explanation: 'any non-word character',
      type: 'escape',
    }),
  },
  {
    regex: /^\\s/,
    explain: () => ({
      token: '\\s',
      explanation: 'any whitespace character',
      type: 'escape',
    }),
  },
  {
    regex: /^\\S/,
    explain: () => ({
      token: '\\S',
      explanation: 'any non-whitespace character',
      type: 'escape',
    }),
  },
  {
    regex: /^\\b/,
    explain: () => ({
      token: '\\b',
      explanation: 'word boundary',
      type: 'anchor',
    }),
  },
  {
    regex: /^\\B/,
    explain: () => ({
      token: '\\B',
      explanation: 'non-word boundary',
      type: 'anchor',
    }),
  },
  {
    regex: /^\\n/,
    explain: () => ({
      token: '\\n',
      explanation: 'newline',
      type: 'escape',
    }),
  },
  {
    regex: /^\\t/,
    explain: () => ({
      token: '\\t',
      explanation: 'tab',
      type: 'escape',
    }),
  },
  {
    regex: /^\\r/,
    explain: () => ({
      token: '\\r',
      explanation: 'carriage return',
      type: 'escape',
    }),
  },
  {
    regex: /^\\(.)/,
    explain: (m) => ({
      token: m[0],
      explanation: `literal '${m[1]}'`,
      type: 'escape',
    }),
  },
  // Anchors
  {
    regex: /^\^/,
    explain: () => ({
      token: '^',
      explanation: 'start of string/line',
      type: 'anchor',
    }),
  },
  {
    regex: /^\$/,
    explain: () => ({
      token: '$',
      explanation: 'end of string/line',
      type: 'anchor',
    }),
  },
  // Quantifiers
  {
    regex: /^\+\?/,
    explain: () => ({
      token: '+?',
      explanation: 'one or more (lazy)',
      type: 'quantifier',
    }),
  },
  {
    regex: /^\*\?/,
    explain: () => ({
      token: '*?',
      explanation: 'zero or more (lazy)',
      type: 'quantifier',
    }),
  },
  {
    regex: /^\?\?/,
    explain: () => ({
      token: '??',
      explanation: 'zero or one (lazy)',
      type: 'quantifier',
    }),
  },
  {
    regex: /^\+/,
    explain: () => ({
      token: '+',
      explanation: 'one or more',
      type: 'quantifier',
    }),
  },
  {
    regex: /^\*/,
    explain: () => ({
      token: '*',
      explanation: 'zero or more',
      type: 'quantifier',
    }),
  },
  {
    regex: /^\?/,
    explain: () => ({
      token: '?',
      explanation: 'zero or one',
      type: 'quantifier',
    }),
  },
  // Meta characters
  {
    regex: /^\./,
    explain: () => ({
      token: '.',
      explanation: 'any character (except newline)',
      type: 'metachar',
    }),
  },
  {
    regex: /^\|/,
    explain: () => ({
      token: '|',
      explanation: 'OR (alternation)',
      type: 'metachar',
    }),
  },
];

export function explainRegex(pattern: string): ExplanationToken[] {
  const tokens: ExplanationToken[] = [];
  let remaining = pattern;

  while (remaining.length > 0) {
    let matched = false;

    for (const { regex, explain } of TOKEN_PATTERNS) {
      const match = remaining.match(regex);
      if (match) {
        tokens.push(explain(match));
        remaining = remaining.slice(match[0].length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Literal character
      const char = remaining[0];
      tokens.push({
        token: char,
        explanation: `literal '${char}'`,
        type: 'literal',
      });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

export function getExplanationColor(type: ExplanationToken['type']): string {
  switch (type) {
    case 'metachar':
      return 'text-purple-400';
    case 'quantifier':
      return 'text-yellow-400';
    case 'group':
      return 'text-blue-400';
    case 'class':
      return 'text-green-400';
    case 'anchor':
      return 'text-red-400';
    case 'escape':
      return 'text-cyan-400';
    case 'literal':
    default:
      return 'text-[var(--ui-text)]';
  }
}
