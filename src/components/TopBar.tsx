'use client';

import React, { useState } from 'react';
import { GitBranchIcon, ChevronDownIcon, CheckIcon, ArrowUpIcon, ArrowDownIcon, Loader2Icon } from 'lucide-react';
import type { Project, ProjectTab } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export type TabOption = ProjectTab;

export interface GitStatus {
  hasGit: boolean;
  hasRemote: boolean;
  ahead: number;
  behind: number;
  dirty: number;
}

interface TopBarProps {
  project: Project;
  activeTab: TabOption;
  onTabChange: (tab: TabOption) => void;
  currentBranch?: string;
  branches?: string[];
  taskBranchMap?: Record<string, string>;
  onSwitchBranch?: (branch: string) => void;
  gitStatus?: GitStatus;
  onPush?: () => Promise<void>;
  onPull?: () => Promise<void>;
  onFetch?: () => Promise<void>;
  onInitGit?: () => void;
}

export function TopBar({ project, activeTab, onTabChange, currentBranch, branches, taskBranchMap, onSwitchBranch, gitStatus, onPush, onPull, onFetch, onInitGit }: TopBarProps) {
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [fetching, setFetching] = useState(false);

  const tabs: { id: TabOption; label: string }[] = [
    { id: 'project', label: 'Project' },
    { id: 'live', label: 'Live' },
    { id: 'code', label: 'Code' },
  ];

  const isOnPreviewBranch = currentBranch?.startsWith('proq/') ?? false;
  const hasGit = gitStatus?.hasGit !== false;

  // Sort branches: main first, then proq/* branches, then others
  const sortedBranches = branches ? [...branches].sort((a, b) => {
    if (a === 'main' || a === 'master') return -1;
    if (b === 'main' || b === 'master') return 1;
    const aIsProq = a.startsWith('proq/');
    const bIsProq = b.startsWith('proq/');
    if (aIsProq && !bIsProq) return -1;
    if (!aIsProq && bIsProq) return 1;
    return a.localeCompare(b);
  }) : [];

  // Group branches: main/master, proq/* branches, others
  const mainBranches = sortedBranches.filter(b => b === 'main' || b === 'master');
  const proqBranches = sortedBranches.filter(b => b.startsWith('proq/'));
  const otherBranches = sortedBranches.filter(b => b !== 'main' && b !== 'master' && !b.startsWith('proq/'));

  return (
    <header className="h-16 bg-surface-base flex items-center px-6 flex-shrink-0">
      <div className="flex-1 flex flex-col justify-center min-w-0">
        <h1 className="text-lg font-semibold text-bronze-900 dark:text-zinc-100 leading-tight">
          {project.path.replace(/\/+$/, "").split("/").pop() || project.name}
        </h1>
        <span className="text-xs font-mono text-zinc-500 mt-0.5">
          {project.path}
        </span>
      </div>

      <div className="flex-1 flex justify-center min-w-0">
        <div className="bg-surface-secondary p-1 rounded-lg flex items-center border border-border-default">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`relative px-4 py-1.5 text-sm font-medium rounded-md z-10 ${
                  isActive ? 'text-text-chrome-active' : 'text-text-chrome hover:text-text-chrome-hover'
                }`}
              >
                {isActive && (
                  <div
                    className="absolute inset-0 bg-bronze-50 dark:bg-zinc-800/60 rounded-md border border-bronze-400/50 dark:border-bronze-800/50 shadow-sm"
                    style={{ zIndex: -1 }}
                  />
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex justify-end items-center gap-2 min-w-0">
        {!hasGit ? (
          /* No git — show init button */
          <button
            onClick={onInitGit}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border border-border-default bg-surface-secondary text-text-chrome hover:text-text-chrome-hover hover:bg-surface-hover transition-colors"
          >
            <GitBranchIcon className="w-3.5 h-3.5" />
            Track changes
          </button>
        ) : (
          <>
            {/* Status indicators */}
            <div className="flex items-center gap-3 text-xs whitespace-nowrap">
              {gitStatus && gitStatus.dirty > 0 && (
                <span className="text-red-400">
                  {gitStatus.dirty} uncommitted {gitStatus.dirty === 1 ? 'file' : 'files'}
                </span>
              )}
              {gitStatus && gitStatus.behind > 0 && (
                <span className="text-blue-400">
                  {gitStatus.behind} {gitStatus.behind === 1 ? 'commit' : 'commits'} behind
                </span>
              )}
              {gitStatus && gitStatus.ahead > 0 && (
                <span className="text-zinc-400">
                  {gitStatus.ahead} {gitStatus.ahead === 1 ? 'commit' : 'commits'} ahead
                </span>
              )}
            </div>

            {/* Pull / Push / Synced buttons */}
            {gitStatus?.hasRemote && (
              <div className="flex items-center gap-1.5">
                {gitStatus.behind > 0 && (
                  <button
                    onClick={async () => { if (pulling || !onPull) return; setPulling(true); try { await onPull(); } finally { setPulling(false); } }}
                    disabled={pulling}
                    title={`${gitStatus.behind} ${gitStatus.behind === 1 ? 'commit' : 'commits'} behind upstream. Click to pull now.`}
                    className="flex items-center text-xs font-medium rounded-md border border-border-default bg-surface-secondary text-blue-400 hover:bg-surface-hover transition-colors overflow-hidden"
                  >
                    <span className="px-2 py-1.5 border-r border-border-default tabular-nums">{gitStatus.behind}</span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1.5">
                      Pull
                      {pulling
                        ? <Loader2Icon className="w-3.5 h-3.5 text-bronze-500 animate-spin" />
                        : <ArrowDownIcon className="w-3.5 h-3.5" />
                      }
                    </span>
                  </button>
                )}
                {gitStatus.ahead > 0 && (
                  <button
                    onClick={async () => { if (pushing || !onPush) return; setPushing(true); try { await onPush(); } finally { setPushing(false); } }}
                    disabled={pushing}
                    title={`${gitStatus.ahead} ${gitStatus.ahead === 1 ? 'commit' : 'commits'} ahead of upstream. Click to push now.`}
                    className="flex items-center text-xs font-medium rounded-md border border-border-default bg-surface-secondary text-text-chrome hover:text-text-chrome-hover hover:bg-surface-hover transition-colors overflow-hidden"
                  >
                    <span className="px-2 py-1.5 border-r border-border-default tabular-nums">{gitStatus.ahead}</span>
                    <span className="flex items-center gap-1.5 px-2.5 py-1.5">
                      Push
                      {pushing
                        ? <Loader2Icon className="w-3.5 h-3.5 text-bronze-500 animate-spin" />
                        : <ArrowUpIcon className="w-3.5 h-3.5" />
                      }
                    </span>
                  </button>
                )}
                {gitStatus.ahead === 0 && gitStatus.behind === 0 && !pushing && !pulling && (
                  <button
                    onClick={async () => { if (fetching || !onFetch) return; setFetching(true); try { await onFetch(); } finally { setFetching(false); } }}
                    disabled={fetching}
                    title="Up to date with upstream. Click to check."
                    className="flex items-center p-1.5 rounded-md border border-border-default bg-surface-secondary text-bronze-500 hover:bg-surface-hover transition-colors"
                  >
                    {fetching
                      ? <Loader2Icon className="w-3.5 h-3.5 text-bronze-500 animate-spin" />
                      : <CheckIcon className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>
            )}

            {/* Branch selector */}
            {currentBranch && branches && branches.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors outline-none ${
                      isOnPreviewBranch
                        ? 'border-gold/40 bg-surface-secondary text-gold shadow-[0_0_8px_rgba(201,168,76,0.1)] hover:text-gold-light hover:bg-surface-hover'
                        : 'border-border-default bg-surface-secondary text-text-chrome hover:text-text-chrome-hover hover:bg-surface-hover'
                    }`}
                  >
                    <GitBranchIcon className={`w-3.5 h-3.5 ${isOnPreviewBranch ? 'text-gold' : ''}`} />
                    <span className="max-w-[180px] truncate">
                      {isOnPreviewBranch && taskBranchMap?.[currentBranch!]
                        ? taskBranchMap[currentBranch!].split(/\s+/).slice(0, 4).join(' ')
                        : currentBranch}
                    </span>
                    <ChevronDownIcon className="w-3 h-3 opacity-50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 max-h-64">
                  <DropdownMenuLabel>Branches</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {mainBranches.map((branch) => (
                    <BranchItem
                      key={branch}
                      branch={branch}
                      isCurrent={branch === currentBranch}
                      onSelect={() => onSwitchBranch?.(branch)}
                    />
                  ))}
                  {proqBranches.length > 0 && mainBranches.length > 0 && (
                    <DropdownMenuSeparator />
                  )}
                  {proqBranches.map((branch) => (
                    <BranchItem
                      key={branch}
                      branch={branch}
                      isCurrent={branch === currentBranch}
                      taskTitle={taskBranchMap?.[branch]}
                      onSelect={() => onSwitchBranch?.(branch)}
                    />
                  ))}
                  {otherBranches.length > 0 && (mainBranches.length > 0 || proqBranches.length > 0) && (
                    <DropdownMenuSeparator />
                  )}
                  {otherBranches.map((branch) => (
                    <BranchItem
                      key={branch}
                      branch={branch}
                      isCurrent={branch === currentBranch}
                      onSelect={() => onSwitchBranch?.(branch)}
                    />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>
    </header>
  );
}

function BranchItem({ branch, isCurrent, taskTitle, onSelect }: {
  branch: string;
  isCurrent: boolean;
  taskTitle?: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem
      onSelect={() => { if (!isCurrent) onSelect(); }}
      className={`text-xs gap-2 ${isCurrent ? 'text-text-chrome-active' : ''}`}
    >
      {isCurrent ? (
        <CheckIcon className="w-3 h-3 shrink-0" />
      ) : (
        <span className="w-3 shrink-0" />
      )}
      {taskTitle ? (
        <>
          <span className="truncate">{taskTitle}</span>
          <span className="ml-auto text-[10px] font-mono text-bronze-500 dark:text-zinc-600 truncate max-w-[100px]">
            {branch.replace('proq/', '')}
          </span>
        </>
      ) : (
        <span className="font-mono truncate">{branch}</span>
      )}
    </DropdownMenuItem>
  );
}
