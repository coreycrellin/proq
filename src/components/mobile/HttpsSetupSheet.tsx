'use client';

import React, { useState, useCallback } from 'react';
import { ShieldCheckIcon, DownloadIcon, RefreshCwIcon, XIcon, CheckCircle2Icon, LoaderIcon } from 'lucide-react';

interface HttpsSetupSheetProps {
  open: boolean;
  onClose: () => void;
}

export function HttpsSetupSheet({ open, onClose }: HttpsSetupSheetProps) {
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/https-setup', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setGenerated(true);
      } else {
        setError(data.error || 'Failed to generate certificates');
      }
    } catch {
      setError('Network error');
    } finally {
      setGenerating(false);
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
            <ShieldCheckIcon className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-semibold text-text-primary">Enable Voice Dictation</h3>
          </div>
          <button onClick={onClose} className="p-1 text-text-tertiary">
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-text-secondary mb-5">
          Speech recognition requires HTTPS. Follow these steps to enable it:
        </p>

        <div className="space-y-4">
          {/* Step 1: Generate certs */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              1
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary mb-2">Generate HTTPS certificates</p>
              <button
                onClick={handleGenerate}
                disabled={generating || generated}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors w-full justify-center ${
                  generated
                    ? 'bg-emerald/10 border border-emerald/30 text-emerald'
                    : 'bg-blue-600 text-white active:bg-blue-700 disabled:opacity-50'
                }`}
              >
                {generating ? (
                  <><LoaderIcon className="w-4 h-4 animate-spin" /> Generating...</>
                ) : generated ? (
                  <><CheckCircle2Icon className="w-4 h-4" /> Certificates Ready</>
                ) : (
                  'Generate Certificates'
                )}
              </button>
              {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
            </div>
          </div>

          {/* Step 2: Restart server */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              2
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary mb-1">Restart proq with HTTPS</p>
              <p className="text-xs text-text-tertiary mb-2">On your computer, stop the server and run:</p>
              <code className="block text-xs font-mono bg-surface-inset text-bronze-400 px-3 py-2 rounded-lg border border-border-default select-all">
                npm run dev:mobile
              </code>
            </div>
          </div>

          {/* Step 3: iOS cert trust */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              3
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary mb-1">Trust the certificate (iOS)</p>
              <p className="text-xs text-text-tertiary mb-2">
                Download and install the certificate, then trust it in Settings.
              </p>
              <a
                href="/api/https-setup?action=download-cert"
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80 w-full justify-center"
              >
                <DownloadIcon className="w-4 h-4" />
                Download Certificate
              </a>
              <div className="mt-2 text-xs text-text-tertiary space-y-1">
                <p>After downloading:</p>
                <p className="pl-2">1. Open <strong>Settings &gt; General &gt; VPN & Device Management</strong></p>
                <p className="pl-2">2. Tap the &quot;proq-mobile&quot; profile and install it</p>
                <p className="pl-2">3. Go to <strong>Settings &gt; General &gt; About &gt; Certificate Trust Settings</strong></p>
                <p className="pl-2">4. Enable trust for &quot;proq-mobile&quot;</p>
              </div>
            </div>
          </div>

          {/* Step 4: Reload */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
              4
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-text-primary mb-2">Reload this page</p>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80 w-full justify-center"
              >
                <RefreshCwIcon className="w-4 h-4" />
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
