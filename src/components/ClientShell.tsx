'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ProjectsProvider } from './ProjectsProvider';
import { TerminalTabsProvider } from './TerminalTabsProvider';
import { Sidebar } from './Sidebar';
import { MissingPathModal } from './MissingPathModal';
import { useProjects } from './ProjectsProvider';
import type { Project } from '@/lib/types';

const SIDEBAR_OPEN_KEY = 'proq-sidebar-open';

function ShellInner({ children }: { children: React.ReactNode }) {
  const { refreshProjects, isLoaded } = useProjects();
  const [missingProject, setMissingProject] = useState<Project | null>(null);

  // ── Collapsible sidebar ────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Hydrate from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (stored !== null) setSidebarOpen(stored !== 'false');
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      return next;
    });
  }, []);

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
      {sidebarOpen && (
        <Sidebar
          onAddProject={handleAddProject}
          onMissingPath={setMissingProject}
          onCollapse={toggleSidebar}
        />
      )}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="flex-shrink-0 w-7 h-full flex items-start pt-[18px] justify-center bg-surface-secondary border-r border-border-default hover:bg-surface-hover transition-colors group"
          title="Open sidebar"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/proq-logo-vector.svg" alt="proq" width={12} height={12} className="opacity-40 group-hover:opacity-80 transition-opacity" />
        </button>
      )}
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
