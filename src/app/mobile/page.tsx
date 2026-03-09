'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FolderIcon, CircleIcon } from 'lucide-react';
import { MobileShell } from '@/components/mobile/MobileShell';
import type { Project } from '@/lib/types';

const statusColors: Record<string, string> = {
  active: 'text-green-400',
  review: 'text-amber-400',
  idle: 'text-text-tertiary',
  error: 'text-red-400',
};

export default function MobileProjectSelector() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/projects')
      .then((res) => res.json())
      .then((data) => {
        setProjects(data);
        setLoading(false);
      })
      .catch((e) => {
        console.error(e);
        setLoading(false);
      });
  }, []);

  // Check for last-used project
  useEffect(() => {
    const last = localStorage.getItem('proq-mobile-project');
    if (last && projects.some((p) => p.id === last)) {
      router.replace(`/mobile/${last}`);
    }
  }, [projects, router]);

  return (
    <MobileShell title="proq">
      <div className="h-full overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-text-tertiary text-sm">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="flex items-center justify-center h-full p-6">
            <div className="text-center">
              <p className="text-text-tertiary text-sm">No projects</p>
              <p className="text-text-tertiary/60 text-xs mt-1">Create a project on the desktop to get started</p>
            </div>
          </div>
        ) : (
          <div className="py-2">
            <p className="px-4 py-2 text-xs text-text-tertiary uppercase tracking-wider font-semibold">
              Select a project
            </p>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  localStorage.setItem('proq-mobile-project', project.id);
                  router.push(`/mobile/${project.id}`);
                }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-surface-hover active:bg-surface-hover/80 border-b border-border-default/50 transition-colors"
              >
                <FolderIcon className="w-5 h-5 text-text-tertiary flex-shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-text-primary truncate">{project.name}</p>
                  <p className="text-xs text-text-tertiary truncate">{project.path}</p>
                </div>
                <CircleIcon className={`w-2.5 h-2.5 fill-current ${statusColors[project.status || 'idle']}`} />
              </button>
            ))}
          </div>
        )}
      </div>
    </MobileShell>
  );
}
