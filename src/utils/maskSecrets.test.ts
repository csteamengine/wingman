import { describe, it, expect } from 'vitest';
import { maskSecrets } from './maskSecrets';

describe('maskSecrets', () => {
    it('masks Stripe live keys', () => {
        const input = 'key=sk_live_abc123XYZabc123XYZ';
        const output = maskSecrets(input);
        expect(output).toContain('sk_live_');
        expect(output).not.toContain('abc123XYZabc123XYZ');
        expect(output).toMatch(/sk_live_abc1\*+3XYZ$/);
    });

    it('masks GitHub PATs', () => {
        const input = 'token: ghp_aBcDeFgHiJkLmNoPqRsT';
        const output = maskSecrets(input);
        expect(output).toContain('ghp_');
        expect(output).not.toContain('aBcDeFgHiJkLmNoPqRsT');
    });

    it('masks github_pat_ tokens', () => {
        const input = 'GITHUB_TOKEN=github_pat_abcdefghijklmnop';
        const output = maskSecrets(input);
        expect(output).toContain('github_pat_');
        expect(output).not.toContain('abcdefghijklmnop');
    });

    it('masks JWT payloads only', () => {
        const header = 'eyJhbGciOiJIUzI1NiJ9';
        const payload = 'eyJzdWIiOiIxMjM0NTY3ODkwIn0';
        const sig = 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
        const input = `Bearer ${header}.${payload}.${sig}`;
        const output = maskSecrets(input);
        // Header and sig preserved, payload masked
        expect(output).toContain(header);
        expect(output).toContain(sig);
        expect(output).not.toContain(payload);
    });

    it('masks Bearer tokens', () => {
        const input = 'Authorization: Bearer mySecretTokenValue1234';
        const output = maskSecrets(input);
        expect(output).toContain('Authorization: Bearer mySe');
        expect(output).not.toContain('mySecretTokenValue1234');
    });

    it('masks database connection string passwords', () => {
        const input = 'postgres://admin:s3cretP@ss@db.example.com:5432/mydb';
        const output = maskSecrets(input);
        expect(output).toContain('postgres://admin:');
        expect(output).not.toContain('s3cretP@ss');
        expect(output).toContain('@db.example.com:5432/mydb');
    });

    it('masks private key blocks', () => {
        const input = `-----BEGIN RSA PRIVATE KEY-----
MIIBogIBAAJBALRiMLAHudeSA/x3hB2f+2NRkJLA
-----END RSA PRIVATE KEY-----`;
        const output = maskSecrets(input);
        expect(output).toContain('-----BEGIN RSA PRIVATE KEY-----');
        expect(output).toContain('-----END RSA PRIVATE KEY-----');
        expect(output).toContain('[REDACTED]');
        expect(output).not.toContain('MIIBogIBAAJBALRiMLAHudeSA');
    });

    it('masks api_key= values', () => {
        const input = 'url?api_key=abcdef1234567890abcd';
        const output = maskSecrets(input);
        expect(output).toContain('api_key=');
        expect(output).not.toContain('abcdef1234567890abcd');
    });

    it('masks high-entropy quoted strings', () => {
        const input = `secret="aB3$dEfGhIjKlMnOpQrStUvWx"`;
        const output = maskSecrets(input);
        expect(output).not.toContain('aB3$dEfGhIjKlMnOpQrStUvWx');
    });

    it('handles multiple secrets in one input', () => {
        const input = `DB_URL=postgres://user:password123@host/db
STRIPE_KEY=sk_live_abcdefghijklmnop
GH_TOKEN=ghp_1234567890abcdef`;
        const output = maskSecrets(input);
        expect(output).not.toContain('password123');
        expect(output).not.toContain('abcdefghijklmnop');
        expect(output).not.toContain('1234567890abcdef');
        // Prefixes preserved
        expect(output).toContain('sk_live_');
        expect(output).toContain('ghp_');
        expect(output).toContain('postgres://user:');
    });

    it('preserves non-secret text and formatting', () => {
        const input = `# Config
HOST=localhost
PORT=3000
API_KEY=sk_live_abcdefghijklmnop`;
        const output = maskSecrets(input);
        expect(output).toContain('# Config\nHOST=localhost\nPORT=3000\n');
    });

    it('masks Supabase anon key', () => {
        const input = 'SUPABASE_ANON_KEY=anon_abcdefghijklmnop';
        const output = maskSecrets(input);
        expect(output).toContain('anon_');
        expect(output).not.toContain('abcdefghijklmnop');
    });

    it('masks service_role key', () => {
        const input = 'KEY=service_role_abcdefghijklmnop';
        const output = maskSecrets(input);
        expect(output).toContain('service_role_');
        expect(output).not.toContain('abcdefghijklmnop');
    });

    it('masks rk_live_ keys', () => {
        const input = 'rk_live_abcdefghijklmnop';
        const output = maskSecrets(input);
        expect(output).toContain('rk_live_');
        expect(output).not.toContain('abcdefghijklmnop');
    });

    it('masks generic PASSWORD env vars', () => {
        const input = 'PASSWORD=mysecretvalue123';
        const output = maskSecrets(input);
        expect(output).toContain('PASSWORD=');
        expect(output).not.toContain('mysecretvalue123');
        expect(output).toContain('myse');
    });

    it('masks SECRET, TOKEN, and CREDENTIAL env vars', () => {
        const input = `APP_SECRET=abcdef123456
MY_TOKEN=xyz789qwerty456
DB_PASSWORD=hunter2isnotgood`;
        const output = maskSecrets(input);
        expect(output).not.toContain('abcdef123456');
        expect(output).not.toContain('xyz789qwerty456');
        expect(output).not.toContain('hunter2isnotgood');
    });

    it('masks MD5 hashes (32 hex chars)', () => {
        const input = 'hash: 5d41402abc4b2a76b9719d911017c592';
        const output = maskSecrets(input);
        expect(output).not.toContain('5d41402abc4b2a76b9719d911017c592');
        expect(output).toContain('5d4140');
    });

    it('masks SHA-256 hashes (64 hex chars)', () => {
        const input = '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824';
        const output = maskSecrets(input);
        expect(output).not.toContain('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('masks colon-separated secret values', () => {
        const input = 'JWT_SECRET: myverysecretjwtkey99';
        const output = maskSecrets(input);
        expect(output).not.toContain('myverysecretjwtkey99');
    });

    it('returns unchanged text with no secrets', () => {
        const input = 'Hello world\nThis is normal text.';
        expect(maskSecrets(input)).toBe(input);
    });
});
