import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { useGitHubStore } from '../stores/githubStore';
import { Github, ExternalLink, X, Loader2, CheckCircle, Copy, Check } from 'lucide-react';
import type { DeviceFlowStart } from '../types';

interface GitHubDeviceFlowModalProps {
  flowStart: DeviceFlowStart;
  onClose: () => void;
  onSuccess: () => void;
}

export function GitHubDeviceFlowModal({
  flowStart,
  onClose,
  onSuccess,
}: GitHubDeviceFlowModalProps) {
  const { pollDeviceFlow } = useGitHubStore();
  const [polling, setPolling] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeoutSeconds, setTimeoutSeconds] = useState(flowStart.expires_in);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // GitHub requires minimum 5 seconds, we use 8 to be safe and avoid rate limits
  const currentIntervalMs = useRef(Math.max(flowStart.interval, 8) * 1000);

  // Countdown timer
  useEffect(() => {
    if (success) return;

    const timer = setInterval(() => {
      setTimeoutSeconds((prev) => {
        const next = Math.max(0, prev - 1);
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [success]);

  // Auto-poll for authorization
  useEffect(() => {
    if (success) return;

    const scheduleNextPoll = (delayMs: number) => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }

      intervalRef.current = setTimeout(poll, delayMs);
    };

    const poll = async () => {
      // Prevent concurrent polls using ref
      if (pollingRef.current) {
        console.log('[Modal] Skipping poll - already polling');
        return;
      }

      console.log('[Modal] Starting poll, interval:', currentIntervalMs.current / 1000, 's');
      pollingRef.current = true;
      setPolling(true);
      setError(null);

      try {
        const result = await pollDeviceFlow(flowStart.device_code);

        if (result) {
          // Authentication successful!
          console.log('[Modal] Authentication detected, showing success');
          pollingRef.current = false;
          setPolling(false);
          setSuccess(true);

          // Wait a moment for user to see success message, then close
          setTimeout(() => {
            console.log('[Modal] Closing modal and calling onSuccess');
            onSuccess();
            onClose();
          }, 1500);

          return;
        }

        // Still pending, schedule next poll
        pollingRef.current = false;
        setPolling(false);
        scheduleNextPoll(currentIntervalMs.current);
      } catch (err) {
        const errorStr = String(err);
        console.error('[Modal] Poll error caught:', errorStr);

        // Check if it's a slow_down error - if so, use the interval from GitHub
        if (errorStr.includes('slow_down')) {
          // Parse interval from error message (format: "slow_down:N")
          const match = errorStr.match(/slow_down:(\d+)/);
          console.log('[Modal] slow_down detected, regex match:', match);
          if (match) {
            const newInterval = (parseInt(match[1], 10) + 1) * 1000;
            console.log('[Modal] Setting new interval from GitHub:', newInterval / 1000, 's');
            currentIntervalMs.current = newInterval;
          } else {
            // Fallback: increase interval by 5 seconds
            const newInterval = Math.min(currentIntervalMs.current + 5000, 30000);
            console.log('[Modal] Fallback: increasing interval to:', newInterval / 1000, 's');
            currentIntervalMs.current = newInterval;
          }
          console.log('[Modal] Slowing down, new interval:', currentIntervalMs.current / 1000, 's');
        } else {
          console.log('[Modal] Non-slow_down error, keeping interval:', currentIntervalMs.current / 1000, 's');
        }

        pollingRef.current = false;
        setPolling(false);

        // Schedule next poll even on error (except for fatal errors)
        if (!errorStr.includes('expired') && !errorStr.includes('timeout')) {
          scheduleNextPoll(currentIntervalMs.current);
        } else {
          setError(errorStr);
        }
      }
    };

    // Start first poll after a longer delay to give users time to copy the code,
    // navigate to GitHub, and start signing in before we hit the API
    const initialDelay = 10000; // 10 second initial delay
    scheduleNextPoll(initialDelay);

    return () => {
      if (intervalRef.current) {
        clearTimeout(intervalRef.current);
      }
      pollingRef.current = false;
    };
  }, [flowStart.device_code, pollDeviceFlow, onSuccess, onClose, success]);

  // Handle timeout
  useEffect(() => {
    if (timeoutSeconds === 0 && !success) {
      setError('Authorization timed out. Please try again.');
    }
  }, [timeoutSeconds, success]);

  const handleOpenGitHub = async () => {
    try {
      await invoke('open_github_url', { url: flowStart.verification_uri });
    } catch (err) {
      console.error('Failed to open URL:', err);
      setError('Failed to open GitHub. Please visit manually: ' + flowStart.verification_uri);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(flowStart.user_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[var(--ui-surface-solid)] border border-[var(--ui-border)] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Github className="w-6 h-6 text-[var(--ui-text)]" />
              <h2 className="text-xl font-semibold text-[var(--ui-text)]">
                Authorize GitHub
              </h2>
            </div>
            {!success && (
              <button
                onClick={onClose}
                className="text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {success ? (
            /* Success State */
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center py-8"
            >
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-[var(--ui-text)] mb-2">
                Authorization Successful!
              </h3>
              <p className="text-sm text-[var(--ui-text-muted)]">
                You can now create GitHub Gists from Wingman
              </p>
            </motion.div>
          ) : (
            /* Waiting for Authorization */
            <>
              {/* Instructions */}
              <div className="mb-6">
                <p className="text-sm text-[var(--ui-text-muted)] mb-4">
                  To authorize Wingman to create gists on your behalf:
                </p>
                <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--ui-text-muted)]">
                  <li>Click the button below to open GitHub</li>
                  <li>Enter the code shown below</li>
                  <li>Click "Authorize Wingman Desktop"</li>
                </ol>
              </div>

              {/* User Code Display */}
              <div className="mb-6 p-4 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-lg">
                <p className="text-xs text-[var(--ui-text-muted)] mb-2 text-center">
                  Enter this code on GitHub:
                </p>
                <div className="flex items-center justify-center gap-3">
                  <p className="text-3xl font-mono font-bold text-[var(--ui-text)] tracking-wider">
                    {flowStart.user_code}
                  </p>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
                    title="Copy code"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Open GitHub Button */}
              <button
                onClick={handleOpenGitHub}
                disabled={timeoutSeconds === 0}
                className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
              >
                <Github className="w-5 h-5" />
                Open GitHub
                <ExternalLink className="w-4 h-4" />
              </button>

              {/* Status */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {polling && (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--ui-text-muted)]" />
                      <span className="text-[var(--ui-text-muted)]">
                        Waiting for authorization...
                      </span>
                    </>
                  )}
                  {!polling && !error && (
                    <span className="text-[var(--ui-text-muted)]">
                      Authorize in your browser
                    </span>
                  )}
                </div>
                <span className="text-[var(--ui-text-muted)] font-mono">
                  {formatTime(timeoutSeconds)}
                </span>
              </div>

              {/* Error */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm"
                >
                  <p className="mb-2">{error}</p>
                  {(error.includes('timeout') || error.includes('connection')) && (
                    <button
                      onClick={() => setError(null)}
                      className="text-xs text-red-300 hover:text-red-200 underline"
                    >
                      Try again
                    </button>
                  )}
                </motion.div>
              )}

              {/* Cancel Button */}
              <button
                onClick={onClose}
                className="w-full mt-4 px-4 py-2 text-sm text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] hover:bg-[var(--ui-hover)] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
