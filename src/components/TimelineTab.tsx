'use client';

import React, { useState, useMemo } from 'react';
import { SearchIcon, XIcon } from 'lucide-react';
import { TimelineData } from '@/lib/types';

// ── Colors by story type ─────────────────────────────────
type StoryType = 'feature' | 'fix' | 'infra' | 'chore';

const TYPE_COLORS: Record<StoryType, { badge: string }> = {
  feature: { badge: 'bg-steel/20 text-steel-light' },
  fix:     { badge: 'bg-crimson/20 text-crimson-light' },
  infra:   { badge: 'bg-gold/20 text-gold-light' },
  chore:   { badge: 'bg-bronze-800/30 text-bronze-500' },
};

const TYPE_LABELS: Record<StoryType, string> = {
  feature: 'Feature', fix: 'Fix', infra: 'Infra', chore: 'Chore',
};

function isStoryType(t: string): t is StoryType {
  return t === 'feature' || t === 'fix' || t === 'infra' || t === 'chore';
}

// ── Helpers ──────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// ── Component ────────────────────────────────────────────
interface TimelineTabProps {
  data?: TimelineData | null;
}

export function TimelineTab({ data }: TimelineTabProps) {
  const [search, setSearch] = useState('');
  const weeks = data?.weeks ?? [];

  const filteredWeeks = useMemo(() => {
    if (!search.trim()) return weeks;
    const q = search.toLowerCase();
    return weeks
      .map((week) => {
        const matchingBullets = week.bullets.filter(
          (b) =>
            b.text.toLowerCase().includes(q) ||
            b.authors.some((a) => a.toLowerCase().includes(q)),
        );
        if (matchingBullets.length > 0) {
          return { ...week, bullets: matchingBullets };
        }
        // Also match on date range or type tags
        const dateStr = `${formatDate(week.weekStart)} ${formatDate(week.weekEnd)}`.toLowerCase();
        if (dateStr.includes(q) || week.types.some((t) => t.toLowerCase().includes(q))) {
          return week;
        }
        return null;
      })
      .filter(Boolean) as typeof weeks;
  }, [weeks, search]);

  if (!data) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-500">
        Loading timeline…
      </div>
    );
  }

  if (weeks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-500">
        No commit history found
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-surface-base">
      {/* Search bar */}
      <div className="shrink-0 flex items-center gap-2 px-6 pt-6 pb-4 bg-surface-base">
        <div className="relative flex-shrink-0 w-48">
          <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-bronze-400 dark:text-zinc-600" />
          <input
            type="text"
            placeholder="Search timeline..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-7 py-1.5 text-xs bg-surface-secondary border border-border-default rounded-md text-bronze-800 dark:text-zinc-200 placeholder-bronze-400 dark:placeholder-zinc-600 outline-none focus:border-steel/50"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-bronze-400 dark:text-zinc-600 hover:text-bronze-600 dark:hover:text-zinc-400"
            >
              <XIcon className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-6 pb-6 space-y-2">
          {filteredWeeks.map((week) => (
            <div key={week.weekStart} className="border border-border-default bg-surface-primary rounded-md overflow-hidden px-5 py-3 border-l-2 border-l-gold/40">
              <div className="flex items-start gap-3">
                <span className="text-[11px] font-mono text-zinc-500 w-[120px] shrink-0 pt-0.5">
                  {formatDate(week.weekStart)} – {formatDate(week.weekEnd)}
                </span>
                <div className="w-px h-8 bg-border-default shrink-0" />
                <div className="min-w-0 flex-1">
                  <ul className="space-y-0.5 select-text">
                    {week.bullets.map((bullet, i) => (
                      <li key={i} className="text-[12px] leading-relaxed flex gap-2">
                        <span className="text-zinc-600 shrink-0">·</span>
                        <span className="text-bronze-500">{bullet.text}</span>
                        {bullet.authors.length > 0 && (
                          <span className="text-zinc-600 text-[10px] shrink-0 self-center">
                            {bullet.authors.join(', ')}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {week.types.filter(isStoryType).map(type => (
                      <span key={type} className={`text-[9px] font-medium px-1.5 py-0.5 rounded ${TYPE_COLORS[type].badge}`}>
                        {TYPE_LABELS[type]}
                      </span>
                    ))}
                    <span className="text-[10px] font-mono text-zinc-600 ml-1">
                      {week.commitCount} commits
                    </span>
                    {week.hasMilestone && (
                      <span className="text-amber-500 text-[10px] ml-1">★</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {search && filteredWeeks.length === 0 && (
            <div className="text-center text-[13px] text-zinc-500 py-8">
              No results for "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
