import type {Detector} from './types';
import {maskSecrets} from '../utils/maskSecrets';

const SECRET_PATTERNS = [
    /-----BEGIN [A-Z ]+-----/,
    /(?:postgres|mysql|mongodb|redis|amqp|mssql)(?:\+\w+)?:\/\/[^:/\s]+:[^\s]+@/i,
    /(?:Authorization:\s*Bearer\s+|bearer\s+)[A-Za-z0-9\-_.=+/]{8,}/i,
    /(?:sk_live_|rk_live_|ghp_|github_pat_|sk-)[A-Za-z0-9_]{8,}/,
    /(?:SECRET|PASSWORD|TOKEN|API[_.]?KEY|PRIVATE[_.]?KEY|ACCESS[_.]?KEY)\s*[=:]\s*[^\s"',;]{4,}/i,
];

export const secretsDetector: Detector = {
    id: 'secrets',
    priority: 1,
    detect: (text: string) => SECRET_PATTERNS.some(p => p.test(text)),
    toastMessage: 'Secrets or tokens detected',
    actions: [
        {
            id: 'mask-secrets',
            label: 'Mask',
            execute: (text: string) => maskSecrets(text),
        },
        {
            id: 'redact-secrets',
            label: 'Redact',
            execute: (text: string) => {
                let result = text;
                // Replace known secret patterns with [REDACTED]
                result = result.replace(
                    /(-----BEGIN [A-Z ]+-----\n)([\s\S]*?)(\n-----END [A-Z ]+-----)/g,
                    '$1[REDACTED]$3'
                );
                result = result.replace(
                    /((?:SECRET|PASSWORD|TOKEN|API[_.]?KEY|PRIVATE[_.]?KEY|ACCESS[_.]?KEY)\s*[=:]\s*)[^\s"',;]{4,}/gi,
                    '$1[REDACTED]'
                );
                result = result.replace(
                    /((?:sk_live_|rk_live_|ghp_|github_pat_|sk-))[A-Za-z0-9_]{8,}/g,
                    '$1[REDACTED]'
                );
                result = result.replace(
                    /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
                    '[REDACTED_JWT]'
                );
                return result;
            },
        },
    ],
};
