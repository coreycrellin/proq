'use client';

import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2Icon, XCircleIcon, Loader2Icon, RefreshCwIcon, ArrowRightIcon, TerminalIcon } from 'lucide-react';

interface SetupCheck {
  setupComplete: boolean;
  claude: { found: boolean; path: string };
  tmux: { found: boolean; path: string };
}

interface SetupPageProps {
  onComplete: () => void;
}

export function SetupPage({ onComplete }: SetupPageProps) {
  const [check, setCheck] = useState<SetupCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [claudePath, setClaudePath] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const runCheck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/setup/check');
      const data: SetupCheck = await res.json();
      setCheck(data);
      if (data.claude.found && !claudePath) {
        setClaudePath(data.claude.path);
      }
    } catch (e) {
      console.error('Setup check failed:', e);
    } finally {
      setLoading(false);
    }
  }, [claudePath]);

  useEffect(() => {
    runCheck();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = useCallback(async () => {
    if (!claudePath.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      // Save the path to settings temporarily and re-check
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claudeBin: claudePath.trim() }),
      });
      const res = await fetch('/api/setup/check');
      const data: SetupCheck = await res.json();
      setCheck(data);
      if (data.claude.found) {
        setVerifyResult({ ok: true, message: `Found at ${data.claude.path}` });
      } else {
        setVerifyResult({ ok: false, message: 'Binary not found at that path' });
      }
    } catch {
      setVerifyResult({ ok: false, message: 'Verification failed' });
    } finally {
      setVerifying(false);
    }
  }, [claudePath]);

  const handleComplete = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claudeBin: claudePath.trim() || 'claude' }),
      });
      onComplete();
    } catch (e) {
      console.error('Failed to complete setup:', e);
    } finally {
      setSaving(false);
    }
  }, [claudePath, onComplete]);

  const allGood = check?.claude.found && check?.tmux.found;

  return (
    <div className="flex h-screen w-full bg-surface-base text-bronze-900 dark:text-zinc-100 items-center justify-center">
      <div className="w-full max-w-lg px-6">
        {/* Header */}
        <div className="text-center mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/proq-logo-vector.svg" alt="proq" width={48} height={48} className="mx-auto mb-4 opacity-60" />
          <h1 className="text-2xl font-semibold text-bronze-800 dark:text-zinc-100 mb-2">
            Welcome to proq
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Let&apos;s make sure everything is set up before you start.
          </p>
        </div>

        {/* Prerequisites */}
        <div className="rounded-xl border border-border-default bg-bronze-50 dark:bg-zinc-900/50 p-6 mb-6">
          <h2 className="text-sm font-semibold text-bronze-700 dark:text-zinc-300 uppercase tracking-wider mb-4">
            Prerequisites
          </h2>

          {loading ? (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2Icon className="w-4 h-4 animate-spin text-zinc-400" />
              <span className="text-sm text-zinc-400">Checking...</span>
            </div>
          ) : check ? (
            <div className="space-y-3">
              {/* tmux */}
              <div className="flex items-center gap-3">
                {check.tmux.found ? (
                  <CheckCircle2Icon className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-sm font-medium">tmux</span>
                  </div>
                  {check.tmux.found ? (
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">{check.tmux.path}</p>
                  ) : (
                    <p className="text-xs text-red-400 mt-0.5">
                      Not found. Install with: <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs">brew install tmux</code>
                    </p>
                  )}
                </div>
              </div>

              {/* Claude CLI */}
              <div className="flex items-center gap-3">
                {check.claude.found ? (
                  <CheckCircle2Icon className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <TerminalIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-sm font-medium">Claude Code CLI</span>
                  </div>
                  {check.claude.found ? (
                    <p className="text-xs text-zinc-500 mt-0.5 font-mono">{check.claude.path}</p>
                  ) : (
                    <p className="text-xs text-red-400 mt-0.5">
                      Not found. Install with: <code className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs">npm i -g @anthropic-ai/claude-code</code>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {!loading && (
            <button
              onClick={runCheck}
              className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <RefreshCwIcon className="w-3 h-3" />
              Re-check
            </button>
          )}
        </div>

        {/* Claude path config */}
        {!loading && check && !check.claude.found && (
          <div className="rounded-xl border border-border-default bg-bronze-50 dark:bg-zinc-900/50 p-6 mb-6">
            <h2 className="text-sm font-semibold text-bronze-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Claude CLI Path
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">
              If Claude Code is installed but wasn&apos;t auto-detected, enter the full path below.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={claudePath}
                onChange={(e) => {
                  setClaudePath(e.target.value);
                  setVerifyResult(null);
                }}
                placeholder="/usr/local/bin/claude"
                className="flex-1 bg-bronze-100 dark:bg-zinc-900 border border-border-default rounded-md px-3 py-2 text-sm font-mono text-bronze-900 dark:text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-steel"
              />
              <button
                onClick={handleVerify}
                disabled={verifying || !claudePath.trim()}
                className="px-3 py-2 rounded-md bg-bronze-200 dark:bg-zinc-800 border border-border-default text-sm text-bronze-800 dark:text-zinc-200 hover:bg-bronze-300 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                {verifying ? (
                  <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCwIcon className="w-3.5 h-3.5" />
                )}
                Verify
              </button>
            </div>
            {verifyResult && (
              <p className={`text-xs mt-2 ${verifyResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {verifyResult.message}
              </p>
            )}
          </div>
        )}

        {/* Get Started */}
        <button
          onClick={handleComplete}
          disabled={saving || !allGood}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-bronze-800 dark:bg-zinc-700 text-white font-medium hover:bg-bronze-900 dark:hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2Icon className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Get Started
              <ArrowRightIcon className="w-4 h-4" />
            </>
          )}
        </button>

        {!loading && check && !allGood && (
          <p className="text-center text-xs text-zinc-500 mt-3">
            Install the missing prerequisites above to continue.
          </p>
        )}
      </div>
    </div>
  );
}
