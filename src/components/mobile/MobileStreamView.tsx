'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2Icon, ClockIcon, CheckCircle2Icon, SearchCheckIcon, MicIcon, PlusIcon, CheckIcon, SendIcon } from 'lucide-react';
import type { Task, TaskColumns } from '@/lib/types';
import { StructuredPane } from '../StructuredPane';

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
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<AnyRef>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const start = useCallback(() => {
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError('Requires HTTPS — use npm run dev:mobile');
      setTimeout(() => setError(null), 4000);
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
        setError('Microphone access denied');
      } else {
        setError('Speech recognition failed');
      }
      setTimeout(() => setError(null), 3000);
    };
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setError('Speech recognition not available');
      setTimeout(() => setError(null), 3000);
    }
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  return (
    <div>
      <button
        type="button"
        onTouchStart={(e) => { e.preventDefault(); start(); }}
        onTouchEnd={(e) => { e.preventDefault(); stop(); }}
        onMouseDown={start}
        onMouseUp={stop}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-full transition-colors select-none ${
          recording
            ? 'bg-red-500 text-white'
            : error
            ? 'bg-surface-hover border border-red-500/50 text-red-400'
            : 'bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80'
        }`}
      >
        <MicIcon className={`w-5 h-5 ${recording ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">
          {recording ? 'Recording... release to send' : error ? error : 'Hold to dictate'}
        </span>
      </button>
    </div>
  );
}

export function MobileStreamView({ tasks, projectId, onTaskCreated, focusTaskId, isNewTask }: MobileStreamViewProps) {
  const streamTasks = getStreamTasks(tasks, focusTaskId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<((text: string) => void) | null>(null);
  const attachRef = useRef<(() => void) | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [taskDescription, setTaskDescription] = useState('');
  const [submittingDescription, setSubmittingDescription] = useState(false);
  const descriptionInputRef = useRef<HTMLTextAreaElement>(null);

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
    if (!taskDescription.trim() || submittingDescription) return;
    setSubmittingDescription(true);
    try {
      const title = generateTitle(taskDescription);
      await fetch(`/api/projects/${projectId}/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description: taskDescription.trim(),
        }),
      });
      setTaskDescription('');
      onTaskCreated?.(); // triggers refetch
    } catch {
      // best effort
    } finally {
      setSubmittingDescription(false);
    }
  }, [taskDescription, submittingDescription, projectId, generateTitle, onTaskCreated]);

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

  // Focus on a specific task when requested from board view
  useEffect(() => {
    if (focusTaskId) {
      const idx = streamTasks.findIndex((t) => t.id === focusTaskId);
      if (idx !== -1) {
        setCurrentIndex(idx);
      }
    }
  }, [focusTaskId, streamTasks]);

  // Clamp index when tasks change
  useEffect(() => {
    if (currentIndex >= streamTasks.length && streamTasks.length > 0) {
      setCurrentIndex(streamTasks.length - 1);
    }
  }, [streamTasks.length, currentIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const threshold = 50;
    if (touchDeltaX.current < -threshold && currentIndex < streamTasks.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else if (touchDeltaX.current > threshold && currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
    touchDeltaX.current = 0;
  }, [currentIndex, streamTasks.length]);

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

  const currentTask = streamTasks[currentIndex];

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

      {/* Swipe area */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 flex flex-col overflow-x-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentTask && (
          <div className="h-full flex flex-col min-h-0">
            {/* Task header — hide for blank new tasks */}
            {(currentTask.title || currentTask.description) && (
              <div className="flex-shrink-0 px-4 py-3 border-b border-border-default bg-surface-topbar">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-text-primary truncate flex-1">
                    {currentTask.title || currentTask.description?.slice(0, 60)}
                  </h2>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {currentTask.status === 'verify' && (
                      <button
                        onClick={() => handleMarkDone(currentTask)}
                        disabled={completing}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-emerald bg-emerald/10 border border-emerald/20 active:bg-emerald/20 disabled:opacity-50"
                      >
                        <CheckIcon className="w-3 h-3" />
                        {completing ? '...' : 'Done'}
                      </button>
                    )}
                    {statusBadge(currentTask)}
                  </div>
                </div>
                {currentTask.branch && (
                  <p className="text-xs text-text-tertiary mt-0.5 font-mono truncate">
                    {currentTask.branch}
                  </p>
                )}
              </div>
            )}

            {/* New task compose UI */}
            {currentTask.status === 'todo' && !currentTask.title && !currentTask.description ? (
              <div className="flex-1 flex flex-col min-h-0 p-4">
                <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full gap-3">
                  <p className="text-text-tertiary text-sm text-center">Describe what you want done</p>
                  <textarea
                    ref={descriptionInputRef}
                    autoFocus
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitDescription(currentTask);
                      }
                    }}
                    placeholder="e.g. Add a dark mode toggle to the settings page..."
                    className="w-full rounded-xl bg-surface-hover border border-border-default text-text-primary text-sm p-4 min-h-[120px] resize-none placeholder:text-text-tertiary/50 outline-none focus:border-bronze-400/50"
                  />
                  <button
                    onClick={() => handleSubmitDescription(currentTask)}
                    disabled={!taskDescription.trim() || submittingDescription}
                    className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-medium disabled:opacity-40 active:bg-blue-700 transition-colors"
                  >
                    <SendIcon className="w-4 h-4" />
                    {submittingDescription ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>
            ) : (
              /* Agent output — must be flex col so StructuredPane's flex-1 works */
              <div className="flex-1 min-h-0 flex flex-col overflow-x-hidden max-w-[100vw]">
                <StructuredPane
                  taskId={currentTask.id}
                  projectId={projectId}
                  visible={true}
                  taskStatus={currentTask.status}
                  agentBlocks={
                    !(currentTask.agentStatus === 'running' || currentTask.agentStatus === 'starting') && currentTask.status === 'done' && currentTask.agentBlocks
                      ? currentTask.agentBlocks
                      : undefined
                  }
                  compact={true}
                  sendRef={sendRef}
                  attachRef={attachRef}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action bar: record + new task */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 pb-2">
        <div className="flex-1">
          <RecordButton onTranscript={handleTranscript} />
        </div>
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
