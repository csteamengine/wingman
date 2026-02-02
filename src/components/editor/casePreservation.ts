/**
 * Case preservation utilities for search and replace operations.
 * Allows replacing text while maintaining the original text's case pattern.
 */

export type CasePattern = 'lower' | 'upper' | 'title' | 'mixed';

/**
 * Detects the case pattern of a string.
 * @param text - The text to analyze
 * @returns The detected case pattern
 */
export function detectCasePattern(text: string): CasePattern {
    if (!text || text.length === 0) {
        return 'lower';
    }

    const letters = text.replace(/[^a-zA-Z]/g, '');
    if (letters.length === 0) {
        return 'lower';
    }

    const isAllLower = letters === letters.toLowerCase();
    const isAllUpper = letters === letters.toUpperCase();

    if (isAllLower) {
        return 'lower';
    }

    if (isAllUpper) {
        return 'upper';
    }

    // Check for title case: first letter uppercase, rest lowercase
    const firstLetter = letters[0];
    const restLetters = letters.slice(1);
    if (
        firstLetter === firstLetter.toUpperCase() &&
        restLetters === restLetters.toLowerCase()
    ) {
        return 'title';
    }

    return 'mixed';
}

/**
 * Applies a case pattern to a single character.
 * @param char - The character to transform
 * @param isUpper - Whether the character should be uppercase
 * @returns The transformed character
 */
function applyCharCase(char: string, isUpper: boolean): string {
    return isUpper ? char.toUpperCase() : char.toLowerCase();
}

/**
 * Determines if a character is uppercase.
 * @param char - The character to check
 * @returns True if uppercase, false otherwise
 */
function isUpperCase(char: string): boolean {
    return char !== char.toLowerCase() && char === char.toUpperCase();
}

/**
 * Preserves the case pattern of the original text when applying the replacement.
 * @param original - The original text whose case pattern should be preserved
 * @param replacement - The replacement text to transform
 * @returns The replacement text with the original's case pattern applied
 */
export function preserveCase(original: string, replacement: string): string {
    if (!original || !replacement) {
        return replacement;
    }

    const pattern = detectCasePattern(original);

    switch (pattern) {
        case 'lower':
            return replacement.toLowerCase();

        case 'upper':
            return replacement.toUpperCase();

        case 'title':
            return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();

        case 'mixed': {
            // Character-by-character mapping
            const result: string[] = [];
            const originalLetters = original.replace(/[^a-zA-Z]/g, '');
            let letterIndex = 0;

            for (let i = 0; i < replacement.length; i++) {
                const char = replacement[i];

                // Non-letter characters pass through unchanged
                if (!/[a-zA-Z]/.test(char)) {
                    result.push(char);
                    continue;
                }

                if (letterIndex < originalLetters.length) {
                    // Apply the case from the corresponding original letter
                    result.push(applyCharCase(char, isUpperCase(originalLetters[letterIndex])));
                    letterIndex++;
                } else {
                    // If replacement is longer, use the last original letter's case
                    const lastCase = originalLetters.length > 0
                        ? isUpperCase(originalLetters[originalLetters.length - 1])
                        : false;
                    result.push(applyCharCase(char, lastCase));
                }
            }

            return result.join('');
        }

        default:
            return replacement;
    }
}
