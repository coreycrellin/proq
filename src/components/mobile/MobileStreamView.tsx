'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2Icon, ClockIcon, CheckCircle2Icon, SearchCheckIcon, MicIcon } from 'lucide-react';
import type { Task, TaskColumns } from '@/lib/types';
import { StructuredPane } from '../StructuredPane';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRef = any;

interface MobileStreamViewProps {
  tasks: TaskColumns;
  projectId: string;
}

function getStreamTasks(columns: TaskColumns): Task[] {
  const allTasks = [
    ...columns['in-progress'],
    ...columns['verify'],
    ...(columns['done'] || []).slice(0, 3),
  ];

  return allTasks.sort((a, b) => {
    const score = (t: Task) =>
      t.agentStatus === 'running' ? 0
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
      <span className="flex items-center gap-1 text-xs text-green-400">
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
  const recognitionRef = useRef<AnyRef>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSupported(!!(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

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

    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [onTranscript]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  if (!supported) return null;

  return (
    <div className="flex-shrink-0 px-3 pb-2">
      <button
        type="button"
        onTouchStart={(e) => { e.preventDefault(); start(); }}
        onTouchEnd={(e) => { e.preventDefault(); stop(); }}
        onMouseDown={start}
        onMouseUp={stop}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-full transition-colors select-none ${
          recording
            ? 'bg-red-500 text-white'
            : 'bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80'
        }`}
      >
        <MicIcon className={`w-5 h-5 ${recording ? 'animate-pulse' : ''}`} />
        <span className="text-sm font-medium">
          {recording ? 'Recording... release to send' : 'Hold to dictate'}
        </span>
      </button>
    </div>
  );
}

export function MobileStreamView({ tasks, projectId }: MobileStreamViewProps) {
  const streamTasks = getStreamTasks(tasks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const sendRef = useRef<((text: string) => void) | null>(null);

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
      <div className="flex-1 flex items-center justify-center h-full p-6">
        <div className="text-center">
          <p className="text-text-tertiary text-sm">No active tasks</p>
          <p className="text-text-tertiary/60 text-xs mt-1">Tasks will appear here when agents are running</p>
        </div>
      </div>
    );
  }

  const currentTask = streamTasks[currentIndex];

  return (
    <div className="flex flex-col h-full overflow-x-hidden">
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
            {/* Task header */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-border-default bg-surface-topbar">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-medium text-text-primary truncate flex-1">
                  {currentTask.title || currentTask.description?.slice(0, 60)}
                </h2>
                {statusBadge(currentTask)}
              </div>
              {currentTask.branch && (
                <p className="text-xs text-text-tertiary mt-0.5 font-mono truncate">
                  {currentTask.branch}
                </p>
              )}
            </div>

            {/* Agent output — must be flex col so StructuredPane's flex-1 works */}
            <div className="flex-1 min-h-0 flex flex-col overflow-x-hidden max-w-[100vw]">
              <StructuredPane
                taskId={currentTask.id}
                projectId={projectId}
                visible={true}
                taskStatus={currentTask.status}
                agentBlocks={currentTask.agentBlocks}
                compact={true}
                sendRef={sendRef}
              />
            </div>
          </div>
        )}
      </div>

      {/* Record button */}
      <RecordButton onTranscript={handleTranscript} />

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
