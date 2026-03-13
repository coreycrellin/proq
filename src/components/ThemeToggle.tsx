'use client';

import React, { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from 'lucide-react';

function resolveTheme(stored: string | null): boolean {
  if (stored === 'dark') return true;
  if (stored === 'light') return false;
  // "system" or missing — use OS preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));

    // Listen for OS theme changes when in system mode
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const stored = localStorage.getItem('theme');
      if (!stored || stored === 'system') {
        const isDark = mq.matches;
        setDark(isDark);
        document.documentElement.classList.toggle('dark', isDark);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      className="p-1.5 rounded-md text-text-chrome hover:text-text-chrome-hover hover:bg-surface-hover"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
    </button>
  );
}
