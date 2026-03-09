'use client';

import React from 'react';
import { ChevronLeftIcon, WifiIcon, WifiOffIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MobileShellProps {
  title?: string;
  showBack?: boolean;
  connected?: boolean;
  children: React.ReactNode;
  bottomBar?: React.ReactNode;
}

export function MobileShell({ title, showBack, connected = true, children, bottomBar }: MobileShellProps) {
  const router = useRouter();

  return (
    <div className="h-[100dvh] flex flex-col bg-surface-base text-text-primary overflow-hidden">
      {/* Header */}
      <header className="h-12 flex-shrink-0 bg-surface-topbar border-b border-border-default flex items-center px-3 gap-2">
        {showBack && (
          <button
            onClick={() => router.push('/mobile')}
            className="p-1.5 -ml-1 rounded-lg hover:bg-surface-hover active:bg-surface-hover/80 text-text-secondary"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
        )}
        <h1 className="text-sm font-semibold text-text-primary truncate flex-1">
          {title || 'proq'}
        </h1>
        <div className="flex-shrink-0">
          {connected ? (
            <WifiIcon className="w-4 h-4 text-green-400" />
          ) : (
            <WifiOffIcon className="w-4 h-4 text-red-400" />
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>

      {/* Bottom bar */}
      {bottomBar}
    </div>
  );
}
