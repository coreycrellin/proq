'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProjectsProvider } from './ProjectsProvider';
import { TerminalTabsProvider } from './TerminalTabsProvider';
import { Sidebar } from './Sidebar';
import { MissingPathModal } from './MissingPathModal';
import { useProjects } from './ProjectsProvider';
import type { Project } from '@/lib/types';

const SIDEBAR_MIN = 40;
const SIDEBAR_MAX = 480;
const SIDEBAR_DEFAULT = 260;
const SIDEBAR_STORAGE_KEY = 'proq-sidebar-width';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { refreshProjects, isLoaded } = useProjects();
  const [missingProject, setMissingProject] = useState<Project | null>(null);

  // ── Resizable sidebar ────────────────────────────────────
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const isDragging = useRef(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored) {
      const w = parseInt(stored, 10);
      if (w >= SIDEBAR_MIN && w <= SIDEBAR_MAX) setSidebarWidth(w);
    }
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;

    function onMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const newW = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startW + (ev.clientX - startX)));
      setSidebarWidth(newW);
    }

    function onUp() {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      // Persist
      setSidebarWidth((w) => {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(w));
        return w;
      });
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  const handleAddProject = useCallback(async () => {
    const res = await fetch('/api/folder-picker', { method: 'POST' });
    const data = await res.json();
    if (data.cancelled) return;

    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: data.name, path: data.path }),
    });
    await refreshProjects();
  }, [refreshProjects]);

  const handleRelocate = useCallback(async (project: Project, newPath: string) => {
    const newName = newPath.split('/').pop() || project.name;
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName, path: newPath }),
    });
    setMissingProject(null);
    await refreshProjects();
  }, [refreshProjects]);

  const handleRemoveProject = useCallback(async (project: Project) => {
    await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
    setMissingProject(null);
    await refreshProjects();
  }, [refreshProjects]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full bg-surface-base text-bronze-900 dark:text-zinc-100 items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-surface-base text-bronze-900 dark:text-zinc-100 overflow-hidden font-sans">
      <Sidebar
        onAddProject={handleAddProject}
        onMissingPath={setMissingProject}
        width={sidebarWidth}
      />
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="w-[3px] flex-shrink-0 cursor-col-resize"
      />
      <div className="flex-1 flex flex-col min-w-0">
        {children}
      </div>
      {missingProject && (
        <MissingPathModal
          project={missingProject}
          onClose={() => setMissingProject(null)}
          onRelocate={handleRelocate}
          onRemove={handleRemoveProject}
        />
      )}
    </div>
  );
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <ProjectsProvider>
      <TerminalTabsProvider>
        <ShellInner>{children}</ShellInner>
      </TerminalTabsProvider>
    </ProjectsProvider>
  );
}
