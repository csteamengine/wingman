import type {Detector, DetectorActionResult} from './types';

const JWT_RE = /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;

function decodeJwtPart(part: string): Record<string, unknown> | null {
    try {
        // JWT uses base64url encoding - convert to standard base64
        const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
        const decoded = atob(padded);
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

function extractJwt(text: string): string | null {
    const match = text.match(JWT_RE);
    return match ? match[0] : null;
}

function formatExpiration(exp: number): string {
    const date = new Date(exp * 1000);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const expired = diffMs < 0;
    const absDiff = Math.abs(diffMs);

    let relative: string;
    if (absDiff < 60000) relative = `${Math.round(absDiff / 1000)}s`;
    else if (absDiff < 3600000) relative = `${Math.round(absDiff / 60000)}m`;
    else if (absDiff < 86400000) relative = `${Math.round(absDiff / 3600000)}h`;
    else relative = `${Math.round(absDiff / 86400000)}d`;

    return expired ? `Expired ${relative} ago` : `Expires in ${relative}`;
}

export const jwtDetector: Detector = {
    id: 'jwt',
    priority: 1,
    detect: (text: string) => JWT_RE.test(text),
    toastMessage: 'JWT token detected',
    getToastMessage: (text: string) => {
        const jwt = extractJwt(text);
        if (!jwt) return 'JWT token detected';
        const parts = jwt.split('.');
        const payload = decodeJwtPart(parts[1]);
        if (payload && typeof payload.exp === 'number') {
            return `JWT detected - ${formatExpiration(payload.exp)}`;
        }
        return 'JWT token detected';
    },
    actions: [
        {
            id: 'decode-jwt',
            label: 'Decode',
            execute: (text: string): string => {
                const jwt = extractJwt(text);
                if (!jwt) return text;

                const parts = jwt.split('.');
                const header = decodeJwtPart(parts[0]);
                const payload = decodeJwtPart(parts[1]);

                const lines: string[] = [];
                lines.push('=== JWT Header ===');
                lines.push(JSON.stringify(header, null, 2));
                lines.push('');
                lines.push('=== JWT Payload ===');
                lines.push(JSON.stringify(payload, null, 2));
                lines.push('');
                lines.push('=== Signature ===');
                lines.push(parts[2]);

                return lines.join('\n');
            },
        },
        {
            id: 'check-expiration',
            label: 'Check Expiry',
            execute: (text: string): string | DetectorActionResult => {
                const jwt = extractJwt(text);
                if (!jwt) return text;

                const parts = jwt.split('.');
                const payload = decodeJwtPart(parts[1]);

                if (!payload) {
                    return {
                        text,
                        validationMessage: 'Invalid JWT payload',
                        validationType: 'error',
                    };
                }

                if (typeof payload.exp !== 'number') {
                    return {
                        text,
                        validationMessage: 'No expiration claim (exp) found',
                        validationType: 'error',
                    };
                }

                const expDate = new Date(payload.exp * 1000);
                const now = new Date();
                const expired = expDate < now;

                return {
                    text,
                    validationMessage: `${formatExpiration(payload.exp)} (${expDate.toLocaleString()})`,
                    validationType: expired ? 'error' : 'success',
                };
            },
        },
        {
            id: 'extract-claims',
            label: 'Extract Claims',
            execute: (text: string): string => {
                const jwt = extractJwt(text);
                if (!jwt) return text;

                const parts = jwt.split('.');
                const payload = decodeJwtPart(parts[1]);

                if (!payload) return text;

                const lines: string[] = [];
                const standardClaims: Record<string, string> = {
                    iss: 'Issuer',
                    sub: 'Subject',
                    aud: 'Audience',
                    exp: 'Expiration',
                    nbf: 'Not Before',
                    iat: 'Issued At',
                    jti: 'JWT ID',
                };

                for (const [key, value] of Object.entries(payload)) {
                    const label = standardClaims[key] || key;
                    let displayValue: string;

                    if ((key === 'exp' || key === 'iat' || key === 'nbf') && typeof value === 'number') {
                        displayValue = new Date(value * 1000).toLocaleString();
                    } else if (typeof value === 'object') {
                        displayValue = JSON.stringify(value);
                    } else {
                        displayValue = String(value);
                    }

                    lines.push(`${label}: ${displayValue}`);
                }

                return lines.join('\n');
            },
        },
    ],
};
