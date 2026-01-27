const MASK_CHAR = '*';

function mask(value: string, prefixLen: number, suffixLen: number): string {
    if (value.length <= prefixLen + suffixLen) {
        return MASK_CHAR.repeat(value.length);
    }
    const suffix = suffixLen > 0 ? value.slice(-suffixLen) : '';
    return value.slice(0, prefixLen) + MASK_CHAR.repeat(value.length - prefixLen - suffixLen) + suffix;
}

function isHighEntropy(s: string): boolean {
    if (s.length < 24) return false;
    const hasUpper = /[A-Z]/.test(s);
    const hasLower = /[a-z]/.test(s);
    const hasDigit = /[0-9]/.test(s);
    const hasSymbol = /[^A-Za-z0-9]/.test(s);
    return hasUpper && hasLower && hasDigit && hasSymbol;
}

export function maskSecrets(input: string): string {
    let result = input;

    // 1. Private key blocks — replace body between BEGIN/END lines
    result = result.replace(
        /(-----BEGIN [A-Z ]+-----\n)([\s\S]*?)(\n-----END [A-Z ]+-----)/g,
        (_match, begin: string, _body: string, end: string) => {
            return `${begin}[REDACTED]${end}`;
        }
    );

    // 2. Database connection strings — mask password portion
    // Capture everything from scheme to end of URL, then split at last @ to find password
    result = result.replace(
        /\b((?:postgres|mysql|mongodb|redis|amqp|mssql)(?:\+\w+)?:\/\/[^:\/\s]+:)(\S+)/gi,
        (_match, pre: string, rest: string) => {
            const lastAt = rest.lastIndexOf('@');
            if (lastAt === -1) return _match;
            const password = rest.slice(0, lastAt);
            const hostPart = rest.slice(lastAt);
            return `${pre}${mask(password, 0, 0)}${hostPart}`;
        }
    );

    // 3. JWTs — mask only the payload (middle) segment (before Bearer to avoid conflict)
    result = result.replace(
        /\b(eyJ[A-Za-z0-9_-]+)\.(eyJ[A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\b/g,
        (_match, header: string, payload: string, signature: string) => {
            return `${header}.${mask(payload, 3, 3)}.${signature}`;
        }
    );

    // 4. Bearer tokens (non-JWT, since JWTs already masked above)
    result = result.replace(
        /((?:Authorization:\s*Bearer\s+|bearer\s+))([A-Za-z0-9\-_\.=+\/]{8,})/gi,
        (_match, prefix: string, token: string) => {
            // Skip if it looks like an already-masked JWT
            if (/^eyJ/.test(token)) return _match;
            return `${prefix}${mask(token, 4, 4)}`;
        }
    );

    // 5. Known-prefix API keys and tokens
    const prefixPatterns: Array<{ re: RegExp; prefixLen: number; suffixLen: number }> = [
        { re: /(sk_live_)([A-Za-z0-9]{8,})/g, prefixLen: 4, suffixLen: 4 },
        { re: /(rk_live_)([A-Za-z0-9]{8,})/g, prefixLen: 4, suffixLen: 4 },
        { re: /(ghp_)([A-Za-z0-9]{8,})/g, prefixLen: 4, suffixLen: 4 },
        { re: /(github_pat_)([A-Za-z0-9_]{8,})/g, prefixLen: 4, suffixLen: 4 },
        { re: /(sk-)([A-Za-z0-9]{8,})/g, prefixLen: 4, suffixLen: 4 },
        { re: /((?:anon_|service_role_))([A-Za-z0-9\-_.]{8,})/g, prefixLen: 4, suffixLen: 4 },
        { re: /((?:api_key|apiKey)=)([^\s&"']{8,})/g, prefixLen: 4, suffixLen: 3 },
    ];

    for (const { re, prefixLen, suffixLen } of prefixPatterns) {
        result = result.replace(re, (_match, prefix: string, secret: string) => {
            return `${prefix}${mask(secret, prefixLen, suffixLen)}`;
        });
    }

    // 6. Generic env var secrets — sensitive key names followed by values
    // Matches KEY=value or KEY: value patterns where KEY contains secret-related words
    result = result.replace(
        /((?:^|[\s,;])(?:[A-Z_]*(?:SECRET|PASSWORD|PASSWD|PWD|TOKEN|CREDENTIAL|AUTH_[A-Z_]+|[A-Z_]+_AUTH|PRIVATE[_.]?KEY|ACCESS[_.]?KEY|API[_.]?KEY|APP[_.]?KEY|MASTER[_.]?KEY|ENCRYPTION[_.]?KEY|SIGNING[_.]?KEY|CLIENT[_.]?SECRET|SESSION[_.]?SECRET|JWT[_.]?SECRET|DB[_.]?PASS|DATABASE[_.]?PASSWORD)[A-Z_]*)\s*[=:]\s*)([^\s"',;]{4,})/gim,
        (_match, prefix: string, value: string) => {
            // Skip if already masked or if value is a known keyword (e.g. "Bearer")
            if (/\*{3,}/.test(value) || /^(?:Bearer|Basic|true|false|null|none)$/i.test(value)) return _match;
            return `${prefix}${mask(value, 4, 3)}`;
        }
    );

    // 7. Hex strings that look like hashes/keys (32+ hex chars, common hash lengths)
    result = result.replace(
        /\b([a-f0-9]{32,128})\b/gi,
        (match: string) => {
            // Only mask if it's a known hash length (32=MD5, 40=SHA1, 64=SHA256, 128=SHA512)
            // or long enough to likely be a key
            const len = match.length;
            if (len === 32 || len === 40 || len === 64 || len === 128 || len >= 48) {
                return mask(match, 6, 4);
            }
            return match;
        }
    );

    // 8. High-entropy strings (quoted strings ≥ 24 chars)
    result = result.replace(
        /(?<=["'`])([A-Za-z0-9!@#$%^&*()_+\-=\[\]{};:,.<>?\/\\|~]{24,})(?=["'`])/g,
        (match: string) => {
            if (isHighEntropy(match)) {
                return mask(match, 5, 4);
            }
            return match;
        }
    );

    return result;
}
