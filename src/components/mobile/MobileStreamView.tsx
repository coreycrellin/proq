'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Loader2Icon, ClockIcon, CheckCircle2Icon, SearchCheckIcon, MicIcon, PlusIcon, CheckIcon, SendIcon, PaperclipIcon, XIcon, FileIcon, ShieldAlertIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import type { Task, TaskColumns, TaskAttachment } from '@/lib/types';
import { StructuredPane } from '../StructuredPane';
import { uploadFiles, attachmentUrl } from '@/lib/upload';
import { HttpsSetupSheet } from './HttpsSetupSheet';
import { useTTS } from '@/hooks/useTTS';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRef = any;

interface MobileStreamViewProps {
  tasks: TaskColumns;
  projectId: string;
  onTaskCreated?: () => void;
  focusTaskId?: string | null;
  isNewTask?: boolean;
}

function getStreamTasks(columns: TaskColumns, focusTaskId?: string | null): Task[] {
  const allTasks = [
    ...columns['in-progress'],
    ...columns['verify'],
    ...(columns['done'] || []).slice(0, 3),
  ];

  // Include the focused todo task if it's not already in the stream
  if (focusTaskId) {
    const alreadyIncluded = allTasks.some((t) => t.id === focusTaskId);
    if (!alreadyIncluded) {
      const todoTask = columns['todo']?.find((t) => t.id === focusTaskId);
      if (todoTask) {
        allTasks.unshift(todoTask);
      }
    }
  }

  return allTasks.sort((a, b) => {
    const score = (t: Task) =>
      // Focused todo task sorts first
      t.id === focusTaskId && t.status === 'todo' ? -1
      : t.agentStatus === 'running' ? 0
      : t.agentStatus === 'starting' ? 1
      : t.agentStatus === 'queued' ? 2
      : t.status === 'verify' ? 3
      : 4;
    return score(a) - score(b);
  });
}

function statusBadge(task: Task) {
  if (task.agentStatus === 'running') {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-400">
        <Loader2Icon className="w-3 h-3 animate-spin" />
        Running
      </span>
    );
  }
  if (task.agentStatus === 'starting') {
    return (
      <span className="flex items-center gap-1 text-xs text-text-tertiary">
        <Loader2Icon className="w-3 h-3 animate-spin" />
        Starting
      </span>
    );
  }
  if (task.agentStatus === 'queued') {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400">
        <ClockIcon className="w-3 h-3" />
        Queued
      </span>
    );
  }
  if (task.status === 'verify') {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-400">
        <SearchCheckIcon className="w-3 h-3" />
        Verify
      </span>
    );
  }
  if (task.status === 'done') {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald">
        <CheckCircle2Icon className="w-3 h-3" />
        Done
      </span>
    );
  }
  return null;
}

function RecordButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [supported, setSupported] = useState(false);
  const [needsHttps, setNeedsHttps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const recognitionRef = useRef<AnyRef>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const hasSR = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    setSupported(hasSR);
    if (!hasSR) {
      const isSecure = w.location?.protocol === 'https:' || w.location?.hostname === 'localhost';
      if (!isSecure) {
        setNeedsHttps(true);
      } else {
        setError('Not supported in this browser');
      }
    }
  }, []);

  const start = useCallback(() => {
    setRuntimeError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    };

    recognition.onerror = (e: AnyRef) => {
      setRecording(false);
      if (e.error === 'not-allowed') {
        setRuntimeError('Microphone access denied');
      } else {
        setRuntimeError('Speech recognition failed');
      }
      setTimeout(() => setRuntimeError(null), 3000);
    };
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setRuntimeError('Speech recognition not available');
      setTimeout(() => setRuntimeError(null), 3000);
    }
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  // If needs HTTPS, show a tappable setup button instead of disabled
  if (needsHttps) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setShowSetup(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-full transition-colors select-none bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80"
        >
          <ShieldAlertIcon className="w-5 h-5" />
          <span className="text-sm font-medium">Tap to enable voice dictation</span>
        </button>
        <HttpsSetupSheet open={showSetup} onClose={() => setShowSetup(false)} />
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={!supported}
        onTouchStart={(e) => { e.preventDefault(); if (supported) start(); }}
        onTouchEnd={(e) => { e.preventDefault(); if (supported) stop(); }}
        onMouseDown={() => { if (supported) start(); }}
        onMouseUp={() => { if (supported) stop(); }}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-full transition-colors select-none ${
          !supported
            ? 'bg-surface-hover border border-border-default text-text-tertiary opacity-60 cursor-not-allowed'
            : recording
            ? 'bg-red-500 text-white'
            : runtimeError
            ? 'bg-surface-hover border border-red-500/50 text-red-400'
            : 'bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80'
        }`}
      >
        <MicIcon className={`w-5 h-5 ${recording ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">
          {!supported ? (error || 'Dictation not available') : recording ? 'Recording... release to send' : runtimeError ? runtimeError : 'Hold to dictate'}
        </span>
      </button>
    </div>
  );
}

export function MobileStreamView({ tasks, projectId, onTaskCreated, focusTaskId, isNewTask }: MobileStreamViewProps) {
  const tts = useTTS();
  // Memoize streamTasks by task IDs + statuses to avoid unnecessary recalculations
  const streamTasks = useMemo(() => getStreamTasks(tasks, focusTaskId), [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(
      [...(tasks['in-progress'] || []), ...(tasks['verify'] || []), ...(tasks['done'] || []), ...(tasks['todo'] || [])]
        .map(t => `${t.id}:${t.status}:${t.agentStatus}`)
    ),
    focusTaskId,
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  const isHorizontalSwipe = useRef<boolean | null>(null);
  const swipeOffsetRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const currentIndexRef = useRef(currentIndex);
  currentIndexRef.current = currentIndex;
  const streamTasksLenRef = useRef(streamTasks.length);
  streamTasksLenRef.current = streamTasks.length;
  const sendRef = useRef<((text: string) => void) | null>(null);
  const attachRef = useRef<(() => void) | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [submittingDescription, setSubmittingDescription] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);
  const [composeAttachments, setComposeAttachments] = useState<TaskAttachment[]>([]);
  const composeFileInputRef = useRef<HTMLInputElement>(null);

  // Reset TTS when switching tasks
  const prevTaskIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (currentIndex !== prevTaskIndexRef.current) {
      tts.reset();
      prevTaskIndexRef.current = currentIndex;
    }
  }, [currentIndex, tts]);

  // Track whether current task is in compose mode (new blank task)
  const currentTask = streamTasks[currentIndex];
  const isComposeMode = currentTask && currentTask.status === 'todo' && !currentTask.title && !currentTask.description;

  // Wire up attachRef for compose mode so the plus button triggers file picker
  useEffect(() => {
    if (isComposeMode && attachRef) {
      attachRef.current = () => composeFileInputRef.current?.click();
      return () => { attachRef.current = null; };
    }
  }, [isComposeMode, attachRef]);

  const handleComposeFiles = useCallback(async (files: FileList | File[]) => {
    try {
      const uploaded = await uploadFiles(files);
      setComposeAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      // best effort
    }
  }, []);

  const removeComposeAttachment = useCallback((id: string) => {
    setComposeAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleCreateTask = useCallback(async () => {
    if (!newTaskTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTaskTitle.trim(), description: '' }),
      });
      if (res.ok) {
        setNewTaskTitle('');
        setShowNewTask(false);
        onTaskCreated?.();
      }
    } catch {
      // best effort
    } finally {
      setCreating(false);
    }
  }, [newTaskTitle, creating, projectId, onTaskCreated]);

  // Auto-generate title from description (first meaningful chunk)
  const generateTitle = useCallback((description: string): string => {
    const trimmed = description.trim();
    const firstLine = trimmed.split('\n')[0].trim();
    if (firstLine.length <= 80) return firstLine;
    // Truncate at word boundary
    const truncated = firstLine.slice(0, 80);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated) ;
  }, []);

  const handleSubmitDescription = useCallback(async (task: Task) => {
    if (!taskDescription.trim() && composeAttachments.length === 0) return;
    if (submittingDescription) return;
    setSubmittingDescription(true);
    try {
      const desc = taskDescription.trim();
      const title = desc ? generateTitle(desc) : (composeAttachments.length > 0 ? `Task with ${composeAttachments.length} attachment(s)` : '');
      const body: Record<string, unknown> = { title, description: desc };
      if (composeAttachments.length > 0) {
        body.attachments = composeAttachments;
      }
      await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setTaskDescription('');
      setComposeAttachments([]);
      onTaskCreated?.(); // triggers refetch
    } catch {
      // best effort
    } finally {
      setSubmittingDescription(false);
    }
  }, [taskDescription, submittingDescription, projectId, generateTitle, onTaskCreated, composeAttachments]);

  const handleMarkDone = useCallback(async (task: Task) => {
    if (completing) return;
    setCompleting(true);
    try {
      await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      onTaskCreated?.(); // triggers refetch
    } catch {
      // best effort
    } finally {
      setCompleting(false);
    }
  }, [completing, projectId, onTaskCreated]);

  // Focus on a specific task when requested from board view — only on focusTaskId change
  const prevFocusTaskId = useRef(focusTaskId);
  useEffect(() => {
    if (focusTaskId && focusTaskId !== prevFocusTaskId.current) {
      const idx = streamTasks.findIndex((t) => t.id === focusTaskId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
    prevFocusTaskId.current = focusTaskId;
  }, [focusTaskId, streamTasks]);

  // Clamp index when tasks change
  useEffect(() => {
    if (currentIndex >= streamTasks.length && streamTasks.length > 0) {
      setCurrentIndex(streamTasks.length - 1);
    }
  }, [streamTasks.length, currentIndex]);

  // Use native touch listeners with { passive: false } so we can preventDefault on horizontal swipes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSliderTransform = (idx: number, offset: number, animate: boolean) => {
      const slider = sliderRef.current;
      if (!slider) return;
      slider.style.transition = animate ? 'transform 300ms cubic-bezier(0.25, 1, 0.5, 1)' : 'none';
      slider.style.transform = `translateX(calc(-${idx * 100}% + ${offset}px))`;
    };

    const onTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      touchDeltaX.current = 0;
      isHorizontalSwipe.current = null;
      // Cancel any ongoing animation
      updateSliderTransform(currentIndexRef.current, 0, false);
    };

    const onTouchMove = (e: TouchEvent) => {
      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = e.touches[0].clientY - touchStartY.current;

      // Determine swipe direction on first significant movement
      if (isHorizontalSwipe.current === null) {
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          isHorizontalSwipe.current = Math.abs(deltaX) > Math.abs(deltaY);
        }
        return;
      }

      if (!isHorizontalSwipe.current) return;

      // Prevent vertical scroll during horizontal swipe
      e.preventDefault();

      touchDeltaX.current = deltaX;
      const idx = currentIndexRef.current;
      const len = streamTasksLenRef.current;
      // Add resistance at edges
      const offset = (idx === 0 && deltaX > 0) || (idx === len - 1 && deltaX < 0)
        ? deltaX * 0.3
        : deltaX;
      swipeOffsetRef.current = offset;
      updateSliderTransform(idx, offset, false);
    };

    const onTouchEnd = () => {
      if (isHorizontalSwipe.current === false) {
        isHorizontalSwipe.current = null;
        return;
      }
      const threshold = 50;
      const idx = currentIndexRef.current;
      const len = streamTasksLenRef.current;
      let newIdx = idx;
      if (touchDeltaX.current < -threshold && idx < len - 1) {
        newIdx = idx + 1;
      } else if (touchDeltaX.current > threshold && idx > 0) {
        newIdx = idx - 1;
      }
      // Animate to final position
      updateSliderTransform(newIdx, 0, true);
      swipeOffsetRef.current = 0;
      touchDeltaX.current = 0;
      isHorizontalSwipe.current = null;
      if (newIdx !== idx) {
        setCurrentIndex(newIdx);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamTasks.length > 0]); // Re-run when container appears/disappears

  const handleTranscript = useCallback((text: string) => {
    sendRef.current?.(text);
  }, []);

  if (streamTasks.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full p-6 gap-4">
        <div className="text-center">
          <p className="text-text-tertiary text-sm">No active tasks</p>
          <p className="text-text-tertiary/60 text-xs mt-1">Tasks will appear here when agents are running</p>
        </div>
        {showNewTask ? (
          <div className="w-full max-w-xs flex flex-col gap-2">
            <input
              autoFocus
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
              placeholder="Task title..."
              className="w-full px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNewTask(false); setNewTaskTitle(''); }}
                className="flex-1 py-2 rounded-lg text-sm text-text-tertiary bg-surface-hover border border-border-default"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTaskTitle.trim() || creating}
                className="flex-1 py-2 rounded-lg text-sm text-white bg-blue-600 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-surface-hover border border-border-default text-text-secondary text-sm active:bg-surface-hover/80"
          >
            <PlusIcon className="w-4 h-4" />
            New Task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
      {/* New task inline form */}
      {showNewTask && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-border-default bg-surface-topbar">
          <div className="flex gap-2">
            <input
              autoFocus
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTask();
                if (e.key === 'Escape') { setShowNewTask(false); setNewTaskTitle(''); }
              }}
              placeholder="New task title..."
              className="flex-1 px-3 py-2 rounded-lg bg-surface-hover border border-border-default text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleCreateTask}
              disabled={!newTaskTitle.trim() || creating}
              className="px-3 py-2 rounded-lg text-sm text-white bg-blue-600 disabled:opacity-50"
            >
              {creating ? '...' : 'Add'}
            </button>
            <button
              onClick={() => { setShowNewTask(false); setNewTaskTitle(''); }}
              className="px-2 py-2 rounded-lg text-sm text-text-tertiary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Swipe area — horizontal carousel */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 overflow-hidden"
        style={{ touchAction: 'pan-y' }}
      >
        <div
          ref={sliderRef}
          className="flex h-full"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {streamTasks.map((task, i) => (
            <div key={task.id} className="w-full h-full flex-shrink-0 flex flex-col min-h-0" style={{ width: '100%' }}>
              {/* Task header — hide for blank new tasks */}
              {(task.title || task.description) && (
                <div className="flex-shrink-0 px-4 py-3 border-b border-border-default bg-surface-topbar">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-medium text-text-primary truncate flex-1">
                      {task.title || task.description?.slice(0, 60)}
                    </h2>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {task.status === 'verify' && (
                        <button
                          onClick={() => handleMarkDone(task)}
                          disabled={completing}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald bg-emerald/10 border border-emerald/20 active:bg-emerald/20 disabled:opacity-50"
                        >
                          <CheckIcon className="w-3 h-3" />
                          {completing ? '...' : 'Done'}
                        </button>
                      )}
                      {statusBadge(task)}
                    </div>
                  </div>
                  {task.branch && (
                    <p className="text-xs text-text-tertiary mt-0.5 font-mono truncate">
                      {task.branch}
                    </p>
                  )}
                </div>
              )}

              {/* New task compose UI */}
              {task.status === 'todo' && !task.title && !task.description ? (
                <div className="flex-1 flex flex-col min-h-0 p-4">
                  <input
                    ref={i === currentIndex ? composeFileInputRef : undefined}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        handleComposeFiles(e.target.files);
                        e.target.value = '';
                      }
                    }}
                  />
                  <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full gap-3">
                    <p className="text-text-tertiary text-sm text-center">Describe what you want done</p>
                    <textarea
                      ref={i === currentIndex ? descriptionInputRef : undefined}
                      autoFocus={i === currentIndex}
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmitDescription(task);
                        }
                      }}
                      placeholder="e.g. Add a dark mode toggle to the settings page..."
                      className="w-full rounded-xl bg-surface-hover border border-border-default text-text-primary text-sm p-4 min-h-[120px] resize-none placeholder:text-text-tertiary/50 outline-none focus:border-bronze-400/50"
                    />
                    {/* Attachment previews */}
                    {composeAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {composeAttachments.map((att) => {
                          const url = att.filePath ? attachmentUrl(att.filePath) : undefined;
                          const isImage = att.type?.startsWith('image/');
                          return (
                            <div key={att.id} className="relative group">
                              {isImage && url ? (
                                <img src={url} alt={att.name} className="h-16 rounded-lg border border-border-default object-cover" />
                              ) : (
                                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-hover border border-border-default text-xs text-text-secondary">
                                  <FileIcon className="w-3.5 h-3.5 flex-shrink-0" />
                                  <span className="truncate max-w-[120px]">{att.name}</span>
                                </div>
                              )}
                              <button
                                onClick={() => removeComposeAttachment(att.id)}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-700 border border-border-default flex items-center justify-center text-text-tertiary hover:text-white"
                              >
                                <XIcon className="w-3 h-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => composeFileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-surface-hover border border-border-default text-text-secondary text-sm active:bg-surface-hover/80 transition-colors"
                      >
                        <PaperclipIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSubmitDescription(task)}
                        disabled={(!taskDescription.trim() && composeAttachments.length === 0) || submittingDescription}
                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 active:bg-blue-700 transition-colors"
                      >
                        <SendIcon className="w-4 h-4" />
                        {submittingDescription ? 'Sending...' : 'Send'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Agent output — must be flex col so StructuredPane's flex-1 works */
                <div className="flex-1 min-h-0 flex flex-col overflow-x-hidden max-w-[100vw]" style={{ touchAction: 'pan-y' }}>
                  <StructuredPane
                    taskId={task.id}
                    projectId={projectId}
                    visible={i === currentIndex}
                    taskStatus={task.status}
                    agentBlocks={
                      !(task.agentStatus === 'running' || task.agentStatus === 'starting') && task.status === 'done' && task.agentBlocks
                        ? task.agentBlocks
                        : undefined
                    }
                    compact={true}
                    sendRef={i === currentIndex ? sendRef : undefined}
                    attachRef={i === currentIndex ? attachRef : undefined}
                    onNewText={i === currentIndex ? tts.speak : undefined}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Action bar: record + TTS toggle + attach */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 pb-2">
        <div className="flex-1">
          <RecordButton onTranscript={handleTranscript} />
        </div>
        {tts.supported && (
          <button
            onClick={tts.speaking ? tts.stop : tts.toggle}
            className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full border transition-colors ${
              tts.speaking
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-400 active:bg-blue-500/30'
                : tts.enabled
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 active:bg-blue-500/20'
                : 'bg-surface-hover border-border-default text-text-tertiary active:bg-surface-hover/80'
            }`}
            title={tts.speaking ? 'Stop reading' : tts.enabled ? 'Disable read aloud' : 'Enable read aloud'}
          >
            {tts.enabled ? (
              <Volume2Icon className={`w-5 h-5 ${tts.speaking ? 'animate-pulse' : ''}`} />
            ) : (
              <VolumeXIcon className="w-5 h-5" />
            )}
          </button>
        )}
        <button
          onClick={() => attachRef.current?.()}
          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Dot indicators */}
      {streamTasks.length > 1 && (
        <div className="flex-shrink-0 flex items-center justify-center gap-1.5 py-2 bg-surface-topbar border-t border-border-default">
          {streamTasks.map((task, i) => (
            <button
              key={task.id}
              onClick={() => setCurrentIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentIndex
                  ? task.agentStatus === 'running'
                    ? 'bg-blue-400 w-4'
                    : task.status === 'verify'
                    ? 'bg-amber-400 w-4'
                    : 'bg-text-primary w-4'
                  : 'bg-text-tertiary/40'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
