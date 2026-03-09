'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RadioTowerIcon, LayoutGridIcon, MessageSquareIcon } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import { MobileStreamView } from '@/components/mobile/MobileStreamView';
import { MobileBoardView } from '@/components/mobile/MobileBoardView';
import { MobileChat } from '@/components/mobile/MobileChat';
import type { Project, TaskColumns } from '@/lib/types';

type MobileTab = 'streams' | 'board' | 'chat';

const TABS: { id: MobileTab; label: string; icon: React.ReactNode }[] = [
  { id: 'streams', label: 'Streams', icon: <RadioTowerIcon className="w-5 h-5" /> },
  { id: 'board', label: 'Board', icon: <LayoutGridIcon className="w-5 h-5" /> },
  { id: 'chat', label: 'Chat', icon: <MessageSquareIcon className="w-5 h-5" /> },
];

export default function MobileProjectView() {
  const params = useParams();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskColumns>({
    'todo': [],
    'in-progress': [],
    'verify': [],
    'done': [],
  });
  const [activeTab, setActiveTab] = useState<MobileTab>('streams');
  const [connected, setConnected] = useState(true);

  // Fetch project info
  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then(setProject)
      .catch(console.error);
  }, [projectId]);

  // Fetch tasks
  const fetchTasks = useCallback(() => {
    fetch(`/api/projects/${projectId}/tasks`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          setTasks(data);
        }
      })
      .catch(console.error);
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // SSE for real-time updates
  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      es = new EventSource(`/api/projects/${projectId}/events`);

      es.onopen = () => setConnected(true);

      es.onmessage = (event) => {
        if (event.data === 'heartbeat') return;
        try {
          const update = JSON.parse(event.data);
          if (update.taskId && update.changes) {
            // Merge changes into local state
            setTasks((prev) => {
              const next = { ...prev };
              for (const col of Object.keys(next) as (keyof TaskColumns)[]) {
                next[col] = next[col].map((t) =>
                  t.id === update.taskId ? { ...t, ...update.changes } : t
                );
              }
              return next;
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        es?.close();
        reconnectTimer = setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      es?.close();
      clearTimeout(reconnectTimer);
    };
  }, [projectId]);

  // Fallback poll every 5s
  useEffect(() => {
    const interval = setInterval(fetchTasks, 5000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  return (
    <MobileShell
      title={project?.name || 'Loading...'}
      showBack
      connected={connected}
      bottomBar={
        <nav className="flex-shrink-0 bg-surface-topbar border-t border-border-default flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                activeTab === tab.id
                  ? 'text-bronze-400'
                  : 'text-text-tertiary active:text-text-secondary'
              }`}
            >
              {tab.icon}
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          ))}
        </nav>
      }
    >
      {activeTab === 'streams' && (
        <MobileStreamView tasks={tasks} projectId={projectId} />
      )}
      {activeTab === 'board' && (
        <MobileBoardView tasks={tasks} />
      )}
      {activeTab === 'chat' && (
        <MobileChat projectId={projectId} />
      )}
    </MobileShell>
  );
}
