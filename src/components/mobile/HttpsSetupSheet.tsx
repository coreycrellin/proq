'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { GlobeIcon, XIcon, CheckCircle2Icon, LoaderIcon, ExternalLinkIcon } from 'lucide-react';

interface HttpsSetupSheetProps {
  open: boolean;
  onClose: () => void;
}

export function HttpsSetupSheet({ open, onClose }: HttpsSetupSheetProps) {
  const [starting, setStarting] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if tunnel is already running when sheet opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/tunnel')
      .then((res) => res.json())
      .then((data) => {
        if (data.active && data.url) {
          setTunnelUrl(data.url);
        }
      })
      .catch(() => {});
  }, [open]);

  const handleStartTunnel = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch('/api/tunnel', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.url) {
        setTunnelUrl(data.url);
        setStarting(false);
        return;
      }
      if (!res.ok) {
        setError(data.error || 'Failed to start tunnel');
        setStarting(false);
        return;
      }
      // POST returned starting: true — poll GET until ready
      const poll = setInterval(async () => {
        try {
          const r = await fetch('/api/tunnel');
          const d = await r.json();
          if (d.active && d.url) {
            clearInterval(poll);
            setTunnelUrl(d.url);
            setStarting(false);
          } else if (d.error) {
            clearInterval(poll);
            setError(d.error);
            setStarting(false);
          } else if (!d.starting) {
            // Process died without setting error or url
            clearInterval(poll);
            setError('Tunnel process exited unexpectedly');
            setStarting(false);
          }
        } catch {
          // network hiccup, keep polling
        }
      }, 1000);
      // Safety timeout: stop polling after 60s
      setTimeout(() => {
        clearInterval(poll);
        setStarting((s) => {
          if (s) setError('Tunnel took too long to start');
          return false;
        });
      }, 60000);
    } catch {
      setError('Network error');
      setStarting(false);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Sheet */}
      <div
        className="relative w-full max-w-lg bg-surface-primary border-t border-border-default rounded-t-2xl p-5 pb-8 animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-text-tertiary/30" />
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <GlobeIcon className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-semibold text-text-primary">Enable Voice Dictation</h3>
          </div>
          <button onClick={onClose} className="p-1 text-text-tertiary">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-text-secondary mb-5">
          Voice dictation needs a secure connection. Start a tunnel to get an HTTPS link — no certificates or server restart needed.
        </p>

        {tunnelUrl ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald/10 border border-emerald/20">
              <CheckCircle2Icon className="w-5 h-5 text-emerald flex-shrink-0" />
              <p className="text-sm text-emerald font-medium">Tunnel is running</p>
            </div>
            <p className="text-sm text-text-secondary">
              Open this link on your phone to use voice dictation:
            </p>
            <a
              href={tunnelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-blue-600 text-white active:bg-blue-700 w-full"
            >
              <ExternalLinkIcon className="w-4 h-4" />
              Open Tunnel Link
            </a>
            <code className="block text-xs font-mono bg-surface-inset text-bronze-400 px-3 py-2 rounded-lg border border-border-default select-all text-center break-all">
              {tunnelUrl}
            </code>
            <button
              onClick={async () => {
                await fetch('/api/tunnel', { method: 'DELETE' });
                setTunnelUrl(null);
              }}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium w-full bg-surface-base border border-border-default text-text-secondary active:bg-surface-hover"
            >
              <XIcon className="w-4 h-4" />
              Stop Tunnel
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={handleStartTunnel}
              disabled={starting}
              className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full justify-center bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50"
            >
              {starting ? (
                <><LoaderIcon className="w-4 h-4 animate-spin" /> Starting tunnel...</>
              ) : (
                'Start Tunnel'
              )}
            </button>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{error}</p>
                {error.includes('cloudflared not found') && (
                  <div className="mt-2">
                    <p className="text-xs text-text-tertiary mb-1">Install cloudflared first:</p>
                    <code className="block text-xs font-mono bg-surface-inset text-bronze-400 px-3 py-2 rounded-lg border border-border-default select-all">
                      brew install cloudflared
                    </code>
                  </div>
                )}
              </div>
            )}
            <p className="text-xs text-text-tertiary text-center leading-relaxed">
              This starts a free Cloudflare tunnel — no account needed. You can also start it from Settings on desktop.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
