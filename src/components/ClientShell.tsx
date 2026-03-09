'use client';

import React, { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ProjectsProvider } from './ProjectsProvider';
import { WorkbenchTabsProvider } from './WorkbenchTabsProvider';
import { Sidebar } from './Sidebar';
import { MissingPathModal } from './MissingPathModal';
import { useProjects } from './ProjectsProvider';
import type { Project } from '@/lib/types';

const STANDALONE_ROUTES = ['/design', '/experiments'];
const STANDALONE_PREFIXES = ['/mobile'];

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone = STANDALONE_ROUTES.includes(pathname) || STANDALONE_PREFIXES.some((p) => pathname.startsWith(p));
  const { refreshProjects, isLoaded } = useProjects();
  const [missingProject, setMissingProject] = useState<Project | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const isMobile = pathname.startsWith('/mobile');

  // Lock body scroll on mobile routes to prevent iOS elastic scroll
  React.useEffect(() => {
    if (!isMobile) return;
    const html = document.documentElement;
    const body = document.body;
    html.style.overflow = 'hidden';
    html.style.height = '100%';
    body.style.overflow = 'hidden';
    body.style.height = '100%';
    body.style.position = 'fixed';
    body.style.width = '100%';
    return () => {
      html.style.overflow = '';
      html.style.height = '';
      body.style.overflow = '';
      body.style.height = '';
      body.style.position = '';
      body.style.width = '';
    };
  }, [isMobile]);

  if (isStandalone) {
    return (
      <div className={`h-screen w-full font-sans ${isMobile ? 'overflow-hidden' : 'overflow-y-auto'} overflow-x-hidden`}>
        {children}
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-full bg-surface-base text-text-primary items-center justify-center">
        <div className="text-text-tertiary text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-surface-base text-text-primary overflow-hidden font-sans">
      <Sidebar
        onAddProject={handleAddProject}
        onMissingPath={setMissingProject}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
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
      <WorkbenchTabsProvider>
        <ShellInner>{children}</ShellInner>
      </WorkbenchTabsProvider>
    </ProjectsProvider>
  );
}
