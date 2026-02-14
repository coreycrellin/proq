import React, { Fragment } from 'react';
import {
  PlusIcon,
  LayoutGridIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  XCircleIcon,
  MessageSquareIcon } from
'lucide-react';
import { Project, TaskStatus } from '../types';
interface SidebarProps {
  projects: Project[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  isChatActive: boolean;
  onSelectChat: () => void;
  chatPreview?: string;
}
function TaskStatusSummary({ project }: {project: Project;}) {
  const counts: Partial<Record<TaskStatus, number>> = {};
  for (const task of project.tasks) {
    counts[task.status] = (counts[task.status] || 0) + 1;
  }
  const segments: React.ReactNode[] = [];
  if (project.status === 'error') {
    segments.push(
      <span key="error" className="flex items-center gap-1">
        <XCircleIcon className="w-3 h-3 text-red-400" />
        <span className="text-red-400">Error</span>
      </span>
    );
  }
  if (counts['in-progress']) {
    segments.push(
      <span key="ip" className="flex items-center gap-1">
        <RefreshCwIcon className="w-3 h-3 text-blue-400 animate-[spin_3s_linear_infinite]" />
        <span className="text-zinc-400">
          {counts['in-progress']} in progress
        </span>
      </span>
    );
  }
  if (counts['verify']) {
    segments.push(
      <span key="v" className="flex items-center gap-1">
        <CheckCircle2Icon className="w-3 h-3 text-green-400" />
        <span className="text-zinc-400">{counts['verify']} to verify</span>
      </span>
    );
  }
  if (segments.length === 0) {
    return <span className="text-zinc-600 text-[11px]">No active tasks</span>;
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {segments.map((seg, i) =>
      <Fragment key={i}>
          {i > 0 && <span className="text-zinc-700">·</span>}
          {seg}
        </Fragment>
      )}
    </div>);

}
function StatusIcon({ status }: {status: Project['status'];}) {
  switch (status) {
    case 'active':
      return <RefreshCwIcon className="w-3.5 h-3.5 text-blue-400" />;
    case 'review':
      return <CheckCircle2Icon className="w-3.5 h-3.5 text-green-400" />;
    case 'error':
      return <XCircleIcon className="w-3.5 h-3.5 text-red-400" />;
    case 'idle':
      return <CircleIcon className="w-3.5 h-3.5 text-zinc-600" />;
  }
}
function getStatusLabel(status: Project['status']): string {
  switch (status) {
    case 'active':
      return 'Working';
    case 'review':
      return 'Needs review';
    case 'error':
      return 'Error';
    case 'idle':
      return 'Idle';
  }
}
function getStatusLabelColor(status: Project['status']): string {
  switch (status) {
    case 'active':
      return 'text-blue-400';
    case 'review':
      return 'text-green-400';
    case 'error':
      return 'text-red-400';
    case 'idle':
      return 'text-zinc-500';
  }
}
export function Sidebar({
  projects,
  activeProjectId,
  onSelectProject,
  isChatActive,
  onSelectChat,
  chatPreview
}: SidebarProps) {
  return (
    <aside className="w-[260px] h-full bg-zinc-800/30 border-r border-zinc-800 flex flex-col flex-shrink-0">
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-zinc-800/50 pl-[16px] pr-[16px]">
        <LayoutGridIcon className="w-5 h-5 text-zinc-400 mr-3" />
        <span className="text-sm font-bold tracking-wide text-zinc-100 uppercase">
          Claude Queued
        </span>
      </div>

      {/* Main Chat Item */}
      <button
        onClick={onSelectChat}
        className={`w-full text-left p-3 px-4 relative group pt-[16px] pb-[16px] border-b border-zinc-800/60
          ${isChatActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/40'}`}>

        {isChatActive &&
        <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-500" />
        }
        <div className="flex items-center gap-2.5">
          <MessageSquareIcon
            className={`w-4 h-4 ${isChatActive ? 'text-blue-400' : 'text-zinc-500 group-hover:text-zinc-300'}`} />

          <span
            className={`text-sm font-medium ${isChatActive ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-100'}`}>

            Big Claude
          </span>
        </div>
        {chatPreview &&
        <div className="text-[11px] text-zinc-600 mt-1 truncate pl-[26px]">
            {chatPreview}
          </div>
        }
      </button>

      {/* Project List */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 text-[10px] font-medium text-zinc-500 uppercase tracking-widest">
          Projects
        </div>
        {projects.map((project, index) => {
          const isActive = !isChatActive && project.id === activeProjectId;
          return (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`w-full text-left p-3 px-4 relative group
                ${isActive ? 'bg-zinc-800' : 'hover:bg-zinc-800/40'}
                ${index > 0 ? 'border-t border-zinc-800/60' : ''}
                pt-[16px] pb-[16px]`}>

              {/* Active indicator */}
              {isActive &&
              <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-blue-500" />
              }

              {/* Project Name */}
              <div
                className={`text-sm font-medium leading-tight ${isActive ? 'text-zinc-100' : 'text-zinc-300 group-hover:text-zinc-100'}`}>

                {project.name}
              </div>

              {/* Path */}
              <div className="text-[11px] font-mono text-zinc-600 mt-1 truncate">
                {project.path}
              </div>

              {/* Task Summary */}
              <div className="mt-2.5 text-[11px]">
                <TaskStatusSummary project={project} />
              </div>
            </button>);

        })}
      </div>

      {/* Footer Action */}
      <div className="p-3 border-t border-zinc-800 pt-[11px] pb-[11px]">
        <button className="w-full flex items-center justify-center space-x-2 py-2 px-3 rounded-md border border-zinc-700 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-400 hover:text-zinc-200 text-sm">
          <PlusIcon className="w-4 h-4" />
          <span>Add Project</span>
        </button>
      </div>
    </aside>);

}