'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2Icon, ClockIcon, CheckCircle2Icon, SearchCheckIcon } from 'lucide-react';
import type { Task, TaskColumns, AgentBlock } from '@/lib/types';
import { StructuredPane } from '../StructuredPane';

interface MobileStreamViewProps {
  tasks: TaskColumns;
  projectId: string;
}

function getStreamTasks(columns: TaskColumns): Task[] {
  const allTasks = [
    ...columns['in-progress'],
    ...columns['verify'],
    ...(columns['done'] || []).slice(0, 3), // show last 3 done tasks
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

export function MobileStreamView({ tasks, projectId }: MobileStreamViewProps) {
  const streamTasks = getStreamTasks(tasks);
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

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
    <div className="flex flex-col h-full">
      {/* Swipe area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {currentTask && (
          <div className="h-full flex flex-col">
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

            {/* Agent output */}
            <div className="flex-1 overflow-y-auto">
              <StructuredPane
                taskId={currentTask.id}
                projectId={projectId}
                visible={true}
                taskStatus={currentTask.status}
                agentBlocks={currentTask.agentBlocks}
                compact={true}
                readOnly={true}
              />
            </div>
          </div>
        )}
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
