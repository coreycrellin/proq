'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangleIcon,
  Loader2Icon,
  ClipboardListIcon,
  ClipboardCopyIcon,
  CheckIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileIcon,
  FileTextIcon,
  GitBranchIcon,
  ExternalLinkIcon,
  ArrowLeftIcon,
  PlayIcon,
} from 'lucide-react';
import type { Task } from '@/lib/types';
import { parseLines } from '@/lib/utils';

interface TaskDetailPanelProps {
  task: Task;
  projectId: string;
  projectName: string;
  onStatusChange?: (taskId: string, status: string) => void;
  onContinueToCode?: (taskId: string) => void;
  onClickTask?: (task: Task) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function TaskDetailPanel({ task, projectId, projectName, onStatusChange, onContinueToCode, onClickTask }: TaskDetailPanelProps) {
  const router = useRouter();
  const steps = parseLines(task.humanSteps);
  const findings = parseLines(task.findings);
  const shortId = task.id.slice(0, 8);
  const isDispatched = task.dispatch === 'running' || task.dispatch === 'starting';
  const isQueued = task.dispatch === 'queued';
  const [copied, setCopied] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 p-5 pb-4 border-b border-border-subtle space-y-3">
        {/* Status + short ID */}
        <div className="flex items-center gap-2">
          {isQueued ? (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium uppercase tracking-wide">
              <ClockIcon className="w-3 h-3" />
              Queued
            </span>
          ) : isDispatched ? (
            <span className="flex items-center gap-1.5 text-xs text-steel font-medium uppercase tracking-wide">
              <Loader2Icon className="w-3 h-3 animate-spin" />
              Agent working
            </span>
          ) : task.status === 'verify' ? (
            <span className="flex items-center gap-1.5 text-xs text-gold-dark dark:text-gold font-medium uppercase tracking-wide">
              <ClockIcon className="w-3 h-3" />
              Awaiting review
            </span>
          ) : task.status === 'done' ? (
            <span className="flex items-center gap-1.5 text-xs text-patina-dark dark:text-patina font-medium uppercase tracking-wide">
              <CheckCircle2Icon className="w-3 h-3" />
              Completed
            </span>
          ) : (
            <span className="text-xs text-bronze-600 dark:text-zinc-500 font-medium uppercase tracking-wide">
              Todo
            </span>
          )}
          <span className="ml-auto text-[10px] text-bronze-500 dark:text-zinc-600 font-mono">{shortId}</span>
        </div>

        {/* Title */}
        <h2 className="text-base font-semibold text-bronze-900 dark:text-zinc-100 leading-snug">
          {task.title || 'Untitled task'}
        </h2>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[11px] text-bronze-500 dark:text-zinc-500">
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="hover:text-bronze-700 dark:hover:text-zinc-300 transition-colors flex items-center gap-1"
          >
            <ExternalLinkIcon className="w-3 h-3" />
            {projectName}
          </button>
          {task.priority && (
            <>
              <span className="text-bronze-400 dark:text-zinc-700">·</span>
              <span className="capitalize">{task.priority}</span>
            </>
          )}
          {task.mode && (
            <>
              <span className="text-bronze-400 dark:text-zinc-700">·</span>
              <span className="capitalize">{task.mode}</span>
            </>
          )}
          <span className="text-bronze-400 dark:text-zinc-700">·</span>
          <span>Updated {timeAgo(task.updatedAt)}</span>
        </div>

        {/* Branch info */}
        {task.branch && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border border-bronze-800/50 bg-zinc-800/60 text-text-chrome-active">
              <GitBranchIcon className="w-3 h-3" />
              {task.branch}
            </span>
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
        {/* Description */}
        {task.description && (
          <div>
            <p className="text-xs text-bronze-700 dark:text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Attachments */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {task.attachments.map((att) => {
              const isImage = att.type?.startsWith('image/') || false;
              return isImage && att.dataUrl ? (
                <div
                  key={att.id}
                  className="relative group rounded-md overflow-hidden border border-bronze-400/50 dark:border-zinc-700/50 bg-bronze-200/60 dark:bg-zinc-800/60 cursor-pointer"
                  onClick={() => window.open(att.dataUrl, '_blank')}
                >
                  <img src={att.dataUrl} alt={att.name} className="h-16 w-auto max-w-[100px] object-cover block" />
                </div>
              ) : (
                <div key={att.id} className="flex items-center gap-2 bg-bronze-200/60 dark:bg-zinc-800/60 border border-bronze-400/50 dark:border-zinc-700/50 rounded-md px-2 py-1.5">
                  <FileIcon className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">{att.name}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Findings */}
        {findings.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ClipboardListIcon className="w-3.5 h-3.5 text-bronze-600 dark:text-zinc-500" />
              <span className="text-xs font-medium text-bronze-600 dark:text-zinc-500 uppercase tracking-wide">
                Agent Report
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(task.findings || '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="ml-auto text-text-chrome hover:text-text-chrome-hover transition-colors p-0.5"
                title="Copy to clipboard"
              >
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5 text-patina" />
                ) : (
                  <ClipboardCopyIcon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <ul className="space-y-1.5">
              {findings.map((finding, idx) => (
                <li key={idx} className="text-xs text-bronze-700 dark:text-zinc-400 flex items-start font-mono">
                  <span className="mr-2 text-bronze-500 dark:text-zinc-700 shrink-0">-</span>
                  <span>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Merge conflict */}
        {task.mergeConflict && (
          <div className="bg-red-500/8 border border-red-500/20 rounded-md p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangleIcon className="w-3.5 h-3.5 text-red-400" />
              <span className="text-xs font-medium text-red-400 uppercase tracking-wide">Merge conflict</span>
              <span className="text-xs font-mono text-red-400/70">{task.mergeConflict.branch}</span>
            </div>
            {task.mergeConflict.files.length > 0 && (
              <ul className="space-y-0.5">
                {task.mergeConflict.files.map((file) => (
                  <li key={file} className="text-xs font-mono text-bronze-700 dark:text-zinc-400 flex items-start">
                    <span className="mr-2 text-red-400 shrink-0">-</span>
                    <span>{file}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Human steps */}
        {steps.length > 0 && (
          <div className="bg-gold/8 border border-gold/20 rounded-md p-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangleIcon className="w-3.5 h-3.5 text-gold" />
              <span className="text-xs font-medium text-gold uppercase tracking-wide">
                Steps for you
              </span>
            </div>
            <ul className="space-y-1">
              {steps.map((step, idx) => (
                <li key={idx} className="text-xs text-bronze-800 dark:text-zinc-300 flex items-start">
                  <span className="mr-2 text-bronze-500 dark:text-zinc-600">&bull;</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Agent log (collapsible) */}
        {task.agentLog && (
          <div>
            <button
              onClick={() => setLogExpanded(!logExpanded)}
              className="flex items-center gap-2 mb-2 group"
            >
              <FileTextIcon className="w-3.5 h-3.5 text-bronze-500 dark:text-zinc-600" />
              <span className="text-[10px] font-medium text-bronze-500 dark:text-zinc-600 uppercase tracking-wide group-hover:text-bronze-700 dark:group-hover:text-zinc-400 transition-colors">
                Agent Log {logExpanded ? '(collapse)' : '(expand)'}
              </span>
            </button>
            {logExpanded && (
              <pre className="text-[11px] text-bronze-700 dark:text-zinc-500 font-mono bg-bronze-100 dark:bg-zinc-950 border border-bronze-300 dark:border-zinc-800 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                {task.agentLog}
              </pre>
            )}
          </div>
        )}
      </div>

      {/* Action footer */}
      <div className="shrink-0 border-t border-border-subtle p-3 flex items-center gap-2">
        {onClickTask ? (
          <button
            onClick={() => onClickTask(task)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-chrome hover:text-text-chrome-hover border border-border-default rounded-md hover:bg-surface-hover transition-colors"
          >
            <ExternalLinkIcon className="w-3 h-3" />
            Open
          </button>
        ) : (
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-chrome hover:text-text-chrome-hover border border-border-default rounded-md hover:bg-surface-hover transition-colors"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            View in Board
          </button>
        )}

        {task.status === 'verify' && onStatusChange && (
          <>
            {task.mode === 'plan' && task.findings?.trim() && onContinueToCode && (
              <button
                onClick={() => onContinueToCode(task.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-steel border border-steel/30 rounded-md hover:bg-steel/10 transition-colors ml-auto"
              >
                <PlayIcon className="w-3 h-3" />
                Continue to Code
              </button>
            )}
            <button
              onClick={() => onStatusChange(task.id, 'done')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-patina border border-patina/30 rounded-md hover:bg-patina/10 transition-colors ${!(task.mode === 'plan' && task.findings?.trim() && onContinueToCode) ? 'ml-auto' : ''}`}
            >
              <CheckCircle2Icon className="w-3 h-3" />
              {task.branch ? 'Merge & Complete' : 'Complete'}
            </button>
            <button
              onClick={() => onStatusChange(task.id, 'todo')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-chrome hover:text-text-chrome-hover border border-border-default rounded-md hover:bg-surface-hover transition-colors"
            >
              <ArrowLeftIcon className="w-3 h-3" />
              Back to Todo
            </button>
          </>
        )}

        {task.status === 'todo' && onStatusChange && (
          <button
            onClick={() => onStatusChange(task.id, 'in-progress')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-steel border border-steel/30 rounded-md hover:bg-steel/10 transition-colors ml-auto"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}
