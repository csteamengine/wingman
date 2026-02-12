export interface SecureTransformResult {
  success: boolean;
  result?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 500;
const MAX_INPUT_LENGTH = 1_000_000;
const BLOCKED_CODE_PATTERNS = [
  /\bimportScripts\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bfetch\s*\(/,
  /\bnavigator\b/,
  /\bpostMessage\b/,
  /\bclose\s*\(/,
];

function buildWorkerScript(): string {
  return `
self.onmessage = (event) => {
  try {
    const { code, text } = event.data || {};

    if (typeof code !== "string") {
      self.postMessage({ success: false, error: "Invalid transformation code." });
      return;
    }

    if (typeof text !== "string") {
      self.postMessage({ success: false, error: "Invalid transformation input." });
      return;
    }

    // Reduce available side effects inside the worker runtime.
    try { self.fetch = undefined; } catch {}
    try { self.XMLHttpRequest = undefined; } catch {}
    try { self.WebSocket = undefined; } catch {}
    try { self.importScripts = undefined; } catch {}
    try { self.navigator = undefined; } catch {}
    try { self.postMessage = self.postMessage.bind(self); } catch {}

    const wrappedCode = \`
      "use strict";
      return (function(text) {
        \${code}
      })(inputText);
    \`;

    const fn = new Function("inputText", wrappedCode);
    const output = fn(text);

    if (output === undefined || output === null) {
      self.postMessage({
        success: false,
        error: "Transformation returned undefined/null. Return a string value.",
      });
      return;
    }

    self.postMessage({ success: true, result: String(output) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ success: false, error: "Transformation error: " + message });
  }
};
`;
}

export function executeUserTransformation(
  code: string,
  text: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SecureTransformResult> {
  for (const pattern of BLOCKED_CODE_PATTERNS) {
    if (pattern.test(code)) {
      return Promise.resolve({
        success: false,
        error: "Transformation uses blocked APIs.",
      });
    }
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return Promise.resolve({
      success: false,
      error: `Input too large (${MAX_INPUT_LENGTH.toLocaleString()} char max).`,
    });
  }

  return new Promise((resolve) => {
    const blob = new Blob([buildWorkerScript()], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    let settled = false;
    const cleanup = () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({
        success: false,
        error: `Transformation timed out after ${timeoutMs}ms.`,
      });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<SecureTransformResult>) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      resolve(event.data);
    };

    worker.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      resolve({
        success: false,
        error: "Transformation execution failed in worker.",
      });
    };

    worker.postMessage({ code, text });
  });
}
