'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { parseLines } from '@/lib/utils';
import {
  XIcon,
  AlertTriangleIcon,
  Loader2Icon,
  FileTextIcon,
  FileIcon,
  ClipboardListIcon,
  ClipboardCopyIcon,
  CheckIcon,
  CheckCircle2Icon,
  ClockIcon,
  PlayIcon,
  GitBranchIcon,
  Maximize2Icon,
  Minimize2Icon,
} from 'lucide-react';
import type { Task, TaskAttachment } from '@/lib/types';
import { AgentStreamView } from './AgentStreamView';
import { TerminalPane } from './TerminalPane';
import { ConflictModal } from './ConflictModal';

interface TaskAgentModalProps {
  task: Task;
  projectId: string;
  isQueued?: boolean;
  cleanupExpiresAt?: number;
  onClose: () => void;
  onComplete?: (taskId: string) => void;
  onContinueToCode?: (taskId: string) => void;
  parallelMode?: boolean;
  currentBranch?: string;
  onSwitchBranch?: (branch: string) => void;
}

export function TaskAgentModal({ task, projectId, isQueued, cleanupExpiresAt, onClose, onComplete, onContinueToCode, parallelMode, currentBranch, onSwitchBranch }: TaskAgentModalProps) {
  const shortId = task.id.slice(0, 8);
  const terminalTabId = `task-${shortId}`;
  const steps = parseLines(task.humanSteps);
  const findings = parseLines(task.findings);
  const isDispatched = task.dispatch === 'running' || task.dispatch === 'starting';
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');
  const [countdownText, setCountdownText] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  // forceShowLive overrides static mode when a follow-up reply restarts the bridge
  const [forceShowLive, setForceShowLive] = useState(false);
  // Show terminal for done tasks too; fall back to static log only after cleanup has captured agentLog
  const showStaticLog = task.status === 'done' && !cleanupExpiresAt && !!task.agentLog && !forceShowLive;
  const showTerminal = (task.status === 'in-progress' || task.status === 'verify' || (task.status === 'done' && !showStaticLog)) && !isQueued;
  const handleSendFollowUp = useCallback(async (message: string, attachments?: TaskAttachment[]): Promise<{ bridgeRestarted?: boolean } | void> => {
    const res = await fetch(`/api/projects/${projectId}/tasks/${task.id}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, attachments }),
    });
    const data = await res.json();
    if (data.bridgeRestarted) {
      // Bridge was dead and restarted — switch from static log to live terminal view
      setForceShowLive(true);
    }
    return data;
  }, [projectId, task.id]);
  const [topPanelPercent, setTopPanelPercent] = useState(30);
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);
  const [rightPanelPercent, setRightPanelPercent] = useState(33);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const bottomPanelRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isDraggingVerticalRef = useRef(false);

  // Horizontal resize (top/bottom split within right panel)
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const panel = rightPanelRef.current;
    if (!panel) return;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current || !panel) return;
      const rect = panel.getBoundingClientRect();
      // Account for the close button area at top and the complete button at bottom
      const pct = ((ev.clientY - rect.top) / rect.height) * 100;
      setTopPanelPercent(Math.min(Math.max(pct, 15), 85));
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Vertical resize (left/right split between terminal and details)
  const handleVerticalResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingVerticalRef.current = true;
    const modal = modalRef.current;
    if (!modal) return;

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingVerticalRef.current || !modal) return;
      const rect = modal.getBoundingClientRect();
      // Right panel percentage = distance from right edge
      const pct = ((rect.right - ev.clientX) / rect.width) * 100;
      setRightPanelPercent(Math.min(Math.max(pct, 20), 70));
    };
    const onMouseUp = () => {
      isDraggingVerticalRef.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  // Scroll agent report to bottom on first load
  useEffect(() => {
    if (bottomPanelRef.current) {
      bottomPanelRef.current.scrollTop = bottomPanelRef.current.scrollHeight;
    }
  }, []);

  // Countdown timer for cleanup
  useEffect(() => {
    if (!cleanupExpiresAt) {
      setCountdownText('');
      return;
    }
    const update = () => {
      const remaining = Math.max(0, cleanupExpiresAt - Date.now());
      const minutes = Math.ceil(remaining / 60_000);
      setCountdownText(remaining > 0 ? `Session will be cleared in ${minutes}m` : 'Session ended');
    };
    update();
    const interval = setInterval(update, 30_000);
    return () => clearInterval(interval);
  }, [cleanupExpiresAt]);

  // Load xterm CSS
  useEffect(() => {
    const linkId = 'xterm-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = '/xterm.css';
      document.head.appendChild(link);
    }
  }, []);

  // Escape to close
  useEscapeKey(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-none" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative w-full max-w-7xl h-[90vh] flex flex-row rounded-lg border border-bronze-300 dark:border-[#222] bg-bronze-50 dark:bg-[#141414] shadow-2xl shadow-black/60 mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left panel: terminal or queued state ── */}
        <div className={`min-h-0 flex flex-col ${rightPanelExpanded ? 'hidden' : ''}`} style={{ flex: `0 0 calc(${100 - rightPanelPercent}% - 1px)` }}>
          {/* Worktree status — only in parallel mode */}
          {parallelMode && (
            <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-bronze-300 dark:border-zinc-800 bg-bronze-100/50 dark:bg-zinc-900/50">
              {task.status === 'verify' && task.branch && onSwitchBranch && currentBranch === task.branch ? (
                <>
                  <span className="text-xs text-steel font-medium">viewing</span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border border-steel/30 bg-steel/10 text-steel">
                    <GitBranchIcon className="w-3 h-3" />
                    {task.branch}
                  </span>
                  <button
                    onClick={() => onSwitchBranch('main')}
                    className="text-[10px] font-medium text-text-chrome hover:text-text-chrome-hover transition-colors px-1.5 py-0.5 rounded border border-border-default hover:bg-surface-hover"
                  >
                    Back to main
                  </button>
                </>
              ) : (
                <>
                  <span className="text-xs text-bronze-500 dark:text-zinc-500">worktree:</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-mono px-1.5 py-0.5 rounded border ${
                    task.mergeConflict
                      ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                      : 'border-bronze-400/50 bg-bronze-200/60 text-bronze-700 dark:border-bronze-800/50 dark:bg-zinc-800/60 dark:text-text-chrome-active'
                  }`}>
                    <GitBranchIcon className="w-3 h-3" />
                    {task.mergeConflict ? task.mergeConflict.branch : (task.branch || 'main')}
                  </span>
                  {task.status === 'verify' && task.branch && onSwitchBranch && (
                    <button
                      onClick={() => onSwitchBranch(task.branch!)}
                      className="text-[10px] font-medium text-steel hover:text-steel/80 transition-colors px-1.5 py-0.5 rounded border border-steel/30 hover:bg-steel/10"
                    >
                      Preview
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {isQueued ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
              <ClockIcon className="w-8 h-8 text-bronze-500 dark:text-zinc-600" />
              <div>
                <p className="text-sm font-medium text-bronze-600 dark:text-zinc-400">Queued</p>
                <p className="text-xs text-bronze-500 dark:text-zinc-600 mt-1">
                  Waiting for the current task to finish before starting.
                </p>
              </div>
              <button
                onClick={async () => {
                  setDispatching(true);
                  try {
                    await fetch(`/api/projects/${projectId}/tasks/${task.id}/dispatch`, { method: 'POST' });
                    onClose();
                  } catch {
                    setDispatching(false);
                  }
                }}
                disabled={dispatching}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-steel border border-steel/30 rounded-md hover:bg-steel/10 transition-colors disabled:opacity-50"
              >
                {dispatching ? (
                  <Loader2Icon className="w-3 h-3 animate-spin" />
                ) : (
                  <PlayIcon className="w-3 h-3" />
                )}
                Start Now
              </button>
            </div>
          ) : showTerminal ? (
            <div className="flex-1 relative min-h-0 flex flex-col">
              {task.outputMode === 'raw' ? (
                /* Raw output mode: xterm.js terminal */
                <div className="flex-1 min-h-0 relative">
                  <TerminalPane tabId={terminalTabId} visible={true} />
                </div>
              ) : (
                /* Pretty output mode: stream view with Pretty/Raw toggle */
                <>
                  <div className="shrink-0 flex items-center justify-end gap-1 px-3 py-1.5 border-b border-bronze-300 dark:border-zinc-800 bg-bronze-100/50 dark:bg-[#0a0a0a]">
                    <button
                      onClick={() => setViewMode('pretty')}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                        viewMode === 'pretty'
                          ? 'bg-bronze-300 text-bronze-800 dark:bg-zinc-700 dark:text-zinc-200'
                          : 'text-bronze-500 hover:text-bronze-700 dark:text-zinc-500 dark:hover:text-zinc-400'
                      }`}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setViewMode('raw')}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                        viewMode === 'raw'
                          ? 'bg-bronze-300 text-bronze-800 dark:bg-zinc-700 dark:text-zinc-200'
                          : 'text-bronze-500 hover:text-bronze-700 dark:text-zinc-500 dark:hover:text-zinc-400'
                      }`}
                    >
                      Raw
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 relative">
                    <AgentStreamView tabId={terminalTabId} visible={true} mode={viewMode} onSendFollowUp={handleSendFollowUp} />
                  </div>
                </>
              )}
              {countdownText && (
                <div className="shrink-0 px-3 py-1.5 text-[11px] text-bronze-500 dark:text-zinc-600 font-mono border-t border-bronze-300 dark:border-zinc-800 bg-bronze-100/50 dark:bg-[#0a0a0a]">
                  {countdownText}
                </div>
              )}
            </div>
          ) : showStaticLog ? (
            <div className="flex-1 relative min-h-0 flex flex-col">
              {task.agentLog && task.agentLog.trimStart().startsWith('{') ? (
                <>
                  {/* View mode toggle */}
                  <div className="shrink-0 flex items-center justify-end gap-1 px-3 py-1.5 border-b border-bronze-300 dark:border-zinc-800 bg-bronze-100/50 dark:bg-[#0a0a0a]">
                    <button
                      onClick={() => setViewMode('pretty')}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                        viewMode === 'pretty'
                          ? 'bg-bronze-300 text-bronze-800 dark:bg-zinc-700 dark:text-zinc-200'
                          : 'text-bronze-500 hover:text-bronze-700 dark:text-zinc-500 dark:hover:text-zinc-400'
                      }`}
                    >
                      Pretty
                    </button>
                    <button
                      onClick={() => setViewMode('raw')}
                      className={`px-2 py-0.5 text-[11px] font-medium rounded transition-colors ${
                        viewMode === 'raw'
                          ? 'bg-bronze-300 text-bronze-800 dark:bg-zinc-700 dark:text-zinc-200'
                          : 'text-bronze-500 hover:text-bronze-700 dark:text-zinc-500 dark:hover:text-zinc-400'
                      }`}
                    >
                      Raw
                    </button>
                  </div>
                  <div className="flex-1 min-h-0 relative">
                    <AgentStreamView tabId={terminalTabId} visible={true} staticData={task.agentLog} mode={viewMode} onSendFollowUp={handleSendFollowUp} />
                  </div>
                </>
              ) : (
                <pre className="flex-1 min-h-0 overflow-y-auto p-4 text-[12px] font-mono text-bronze-700 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed bg-bronze-100/50 dark:bg-black">
                  {task.agentLog}
                </pre>
              )}
              <div className="shrink-0 px-3 py-1.5 text-[11px] text-bronze-500 dark:text-zinc-600 font-mono border-t border-bronze-300 dark:border-zinc-800 bg-bronze-100/50 dark:bg-[#0a0a0a]">
                Session ended
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Vertical resize handle (between terminal and details) ── */}
        {(showTerminal || isQueued || showStaticLog) && !rightPanelExpanded && (
          <div className="shrink-0 w-px relative z-10">
            {/* Hit target — wider than visible line for easy grabbing */}
            <div
              onMouseDown={handleVerticalResizeMouseDown}
              className="absolute inset-y-0 -left-2 -right-2 z-20 cursor-col-resize group"
            >
              {/* Visible line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-bronze-300 dark:bg-zinc-800 group-hover:w-1 group-hover:bg-steel/40 group-active:bg-steel/50 transition-all" />
            </div>
          </div>
        )}

        {/* ── Right panel: task details ── */}
        <div ref={rightPanelRef} className={`${rightPanelExpanded ? 'w-full' : (showTerminal || isQueued || showStaticLog ? '' : 'w-full')} shrink-0 flex flex-col overflow-hidden bg-bronze-50 dark:bg-[#141414]`} style={(showTerminal || isQueued || showStaticLog) && !rightPanelExpanded ? { flex: `0 0 ${rightPanelPercent}%` } : undefined}>
          {/* Expand / Close buttons */}
          <div className="absolute top-4 right-4 flex items-center gap-1 z-10">
            {(showTerminal || isQueued || showStaticLog) && (
              <button
                onClick={() => setRightPanelExpanded(prev => !prev)}
                className="p-1.5 rounded-md text-text-chrome hover:text-text-chrome-hover hover:bg-surface-hover transition-colors"
                title={rightPanelExpanded ? 'Show terminal' : 'Expand details'}
              >
                {rightPanelExpanded ? (
                  <Minimize2Icon className="w-4 h-4" />
                ) : (
                  <Maximize2Icon className="w-4 h-4" />
                )}
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-text-chrome hover:text-text-chrome-hover hover:bg-surface-hover transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          {/* Top half: title, status, description */}
          <div className="overflow-y-auto p-5 pt-12 space-y-4 shrink-0" style={{ height: `${topPanelPercent}%` }}>
            {/* Status badge */}
            <div className="flex items-center gap-1.5">
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
                  {task.status}
                </span>
              )}
              <span className="ml-auto text-[10px] text-bronze-500 dark:text-zinc-600 font-mono">{shortId}</span>
            </div>

            {/* Title */}
            <h2 className="text-base font-semibold text-bronze-900 dark:text-zinc-100 leading-snug">
              {task.title || 'Untitled task'}
            </h2>

            {/* Description */}
            {task.description && (
              <p className="text-xs text-bronze-700 dark:text-zinc-400 leading-relaxed font-mono whitespace-pre-wrap">
                {task.description}
              </p>
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
                      <img
                        src={att.dataUrl}
                        alt={att.name}
                        className="h-20 w-auto max-w-[120px] object-cover block"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-zinc-300 truncate block">
                          {att.name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={att.id}
                      className="flex items-center gap-2 bg-bronze-200/60 dark:bg-zinc-800/60 border border-bronze-400/50 dark:border-zinc-700/50 rounded-md px-3 py-2.5"
                    >
                      <FileIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                      <span className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[140px]">
                        {att.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Resize handle */}
          <div
            onMouseDown={handleResizeMouseDown}
            className="shrink-0 h-1 cursor-row-resize border-t border-bronze-300 dark:border-zinc-800 hover:bg-steel/20 active:bg-steel/30 transition-colors group relative"
          >
            <div className="absolute inset-x-0 -top-1 -bottom-1" />
          </div>

          {/* Bottom half: agent findings & summary */}
          <div ref={bottomPanelRef} className={`flex-1 min-h-0 overflow-y-auto ${isDispatched && !isQueued && findings.length === 0 ? 'flex flex-col items-center justify-center p-5' : 'p-5 space-y-4'}`}>
            {findings.length > 0 || !isDispatched || isQueued ? (
              <div className="flex items-center gap-2">
                <ClipboardListIcon className="w-3.5 h-3.5 text-bronze-600 dark:text-zinc-500" />
                <span className="text-xs font-medium text-bronze-600 dark:text-zinc-500 uppercase tracking-wide">
                  Agent Report
                </span>
                {findings.length > 0 && (
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
                )}
              </div>
            ) : null}

            {findings.length > 0 ? (
              <div className="space-y-3">
                <ul className="space-y-1.5">
                  {findings.map((finding, idx) => (
                    <li key={idx} className="text-xs text-bronze-700 dark:text-zinc-400 flex items-start font-mono">
                      <span className="mr-2 text-bronze-500 dark:text-zinc-700 shrink-0">-</span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : isDispatched && !isQueued ? (
              <div className="flex flex-col items-center justify-center gap-3">
                <Loader2Icon className="w-5 h-5 text-steel animate-spin" />
                <span className="text-xs text-steel font-medium uppercase tracking-wide">
                  Agent working
                </span>
                <p className="text-xs text-bronze-500 dark:text-zinc-600 italic text-center mt-1">
                  Agent is still working. Findings will appear here when reported.
                </p>
              </div>
            ) : isQueued ? (
              <p className="text-xs text-bronze-500 dark:text-zinc-600 italic">
                Task is queued. Findings will appear here once the agent starts working.
              </p>
            ) : (
              <p className="text-xs text-bronze-500 dark:text-zinc-600 italic">
                No findings reported.
              </p>
            )}

            {task.agentLog && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileTextIcon className="w-3.5 h-3.5 text-bronze-500 dark:text-zinc-600" />
                  <span className="text-[10px] font-medium text-bronze-500 dark:text-zinc-600 uppercase tracking-wide">
                    Log
                  </span>
                </div>
                <pre className="text-[11px] text-bronze-700 dark:text-zinc-500 font-mono bg-bronze-100 dark:bg-zinc-950 border border-bronze-300 dark:border-zinc-800 rounded-md p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {task.agentLog}
                </pre>
              </div>
            )}

            {/* Merge conflict banner */}
            {task.mergeConflict && (
              <div className="bg-red-500/8 border border-red-500/20 rounded-md p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangleIcon className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-medium text-red-400 uppercase tracking-wide">
                    Merge conflict
                  </span>
                  <span className="text-xs font-mono text-red-400/70">
                    {task.mergeConflict.branch}
                  </span>
                </div>
                {task.mergeConflict.files.length > 0 && (
                  <ul className="space-y-0.5 mb-2">
                    {task.mergeConflict.files.map((file) => (
                      <li key={file} className="text-xs font-mono text-bronze-700 dark:text-zinc-400 flex items-start">
                        <span className="mr-2 text-red-400 shrink-0">-</span>
                        <span>{file}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={() => setShowConflictModal(true)}
                  className="text-[11px] font-medium text-red-400 hover:text-red-300 transition-colors"
                >
                  View Details
                </button>
              </div>
            )}

            {/* Human steps banner */}
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
          </div>

          {/* Action buttons pinned to bottom */}
          {task.status === 'verify' && (
            <div className="shrink-0">
              {task.mode === 'plan' && task.findings?.trim() && onContinueToCode && (
                <div className="group/continue">
                  <div className="h-px bg-bronze-300 dark:bg-zinc-800 group-hover/continue:bg-steel/40 transition-colors" />
                  <button
                    onClick={() => onContinueToCode(task.id)}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-5 text-xs font-medium text-steel/80 hover:text-steel hover:bg-steel/10 transition-colors"
                  >
                    <PlayIcon className="w-3.5 h-3.5" />
                    Continue to Code
                  </button>
                </div>
              )}
              {onComplete && (
                <div className="group/complete">
                  <div className="h-px bg-bronze-300 dark:bg-zinc-800 group-hover/complete:bg-patina/40 transition-colors" />
                  <button
                    onClick={() => onComplete(task.id)}
                    className="flex items-center justify-center gap-1.5 w-full px-3 py-5 text-xs font-medium text-patina/80 hover:text-patina hover:bg-patina/10 transition-colors"
                  >
                    <CheckCircle2Icon className="w-3.5 h-3.5" />
                    {task.branch ? 'Merge & Complete' : 'Complete'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showConflictModal && task.mergeConflict && (
        <ConflictModal
          branch={task.mergeConflict.branch}
          files={task.mergeConflict.files}
          onRedispatch={async () => {
            setShowConflictModal(false);
            // Move task to todo then to in-progress to re-dispatch
            await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'todo' }),
            });
            await fetch(`/api/projects/${projectId}/tasks/reorder`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskId: task.id, toColumn: 'in-progress', toIndex: 0 }),
            });
            onClose();
          }}
          onDismiss={() => setShowConflictModal(false)}
        />
      )}
    </div>
  );
}
