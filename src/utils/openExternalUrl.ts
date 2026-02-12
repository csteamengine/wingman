import { open } from "@tauri-apps/plugin-shell";

const DEFAULT_ALLOWED_PROTOCOLS = new Set(["https:", "http:"]);

function hostMatches(allowedHost: string, host: string): boolean {
  return host === allowedHost || host.endsWith(`.${allowedHost}`);
}

export async function openExternalUrl(
  url: string,
  allowedHosts?: string[]
): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (!DEFAULT_ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error("Blocked URL protocol.");
  }

  if (allowedHosts && allowedHosts.length > 0) {
    const host = parsed.hostname.toLowerCase();
    const hostAllowed = allowedHosts.some((allowed) =>
      hostMatches(allowed.toLowerCase(), host)
    );
    if (!hostAllowed) {
      throw new Error("Blocked URL host.");
    }
  }

  await open(parsed.toString());
}
