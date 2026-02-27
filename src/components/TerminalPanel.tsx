'use client';

import React, {
  useEffect,
  useRef,
  useCallback,
  useState,
} from 'react';
import { Plus, TerminalIcon, ChevronUp, ChevronDown, MoreHorizontal, PencilIcon, Trash2, SquareChevronUpIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useTerminalTabs, type TerminalTab } from './TerminalTabsProvider';
import { TerminalPane } from './TerminalPane';
import { ProjectSupervisorPane } from './ProjectSupervisorPane';

type DrawerView = 'supervisor' | 'terminal';

interface TerminalPanelProps {
  projectId: string;
  projectName?: string;
  projectPath?: string;
  style?: React.CSSProperties;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onExpand?: () => void;
  cleanupTimes?: Record<string, number>;
  onResizeStart?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  onTaskCreated?: () => void;
}

/* -------------------------------------------------------------------------- */
/*  Cleanup countdown helper                                                   */
/* -------------------------------------------------------------------------- */

function useCleanupCountdown(expiresAt: number | undefined): string | null {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt) return null;

  const remaining = expiresAt - now;
  if (remaining <= 0) return 'process will be terminated shortly';

  const mins = Math.ceil(remaining / 60_000);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return `process will be terminated in ${hrs}h ${m}m`;
  }
  return `process will be terminated in ${mins}m`;
}

export default function TerminalPanel({ projectId, projectName, projectPath, style, collapsed, onToggleCollapsed, onExpand, cleanupTimes, onResizeStart, isDragging, onTaskCreated }: TerminalPanelProps) {
  const { getTabs, getActiveTabId, setActiveTabId, openTab, closeTab, renameTab, hydrateProject } = useTerminalTabs();
  const panelRef = useRef<HTMLDivElement>(null);
  const [menuTabId, setMenuTabId] = useState<string | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [drawerView, setDrawerView] = useState<DrawerView>('supervisor');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Hydrate persisted shell tabs on mount
  useEffect(() => { hydrateProject(projectId); }, [projectId, hydrateProject]);

  const tabs = getTabs(projectId);
  const activeTabId = getActiveTabId(projectId);

  const isSupervisorActive = drawerView === 'supervisor';

  // Find cleanup expiry for the active task tab
  const activeTab = tabs.find((t) => t.id === activeTabId);
  let activeCleanupExpiresAt: number | undefined;
  if (!isSupervisorActive && activeTab?.type === 'task' && cleanupTimes) {
    const shortId = activeTab.id.replace('task-', '');
    const matchingKey = Object.keys(cleanupTimes).find((k) => k.startsWith(shortId));
    if (matchingKey) activeCleanupExpiresAt = cleanupTimes[matchingKey];
  }
  const countdownText = useCleanupCountdown(activeCleanupExpiresAt);

  // Load xterm CSS once
  useEffect(() => {
    const linkId = 'xterm-css';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = '/xterm.css';
      document.head.appendChild(link);
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuTabId && !showNewMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuTabId && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuTabId(null);
      }
      if (showNewMenu && newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuTabId, showNewMenu]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingTabId) renameInputRef.current?.focus();
  }, [renamingTabId]);

  const submitRename = useCallback(() => {
    if (renamingTabId && renameValue.trim()) {
      renameTab(projectId, renamingTabId, renameValue.trim());
    }
    setRenamingTabId(null);
    setRenameValue('');
  }, [renamingTabId, renameValue, renameTab, projectId]);

  const addShellTab = useCallback(async () => {
    const id = `shell-${uuidv4().slice(0, 8)}`;
    const shellCount = tabs.filter((t) => t.type === 'shell').length + 1;

    await fetch('/api/terminal/spawn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabId: id, cwd: projectPath }),
    });

    openTab(projectId, id, `Terminal ${shellCount}`, 'shell');
  }, [tabs, openTab, projectId, projectPath]);

  const addSupervisorTab = useCallback(() => {
    const id = `supervisor-${uuidv4().slice(0, 8)}`;
    const supCount = tabs.filter((t) => t.type === 'supervisor').length + 1;
    openTab(projectId, id, `Supervisor ${supCount}`, 'supervisor');
  }, [tabs, openTab, projectId]);

  const removeTab = useCallback(
    (tabId: string) => {
      closeTab(projectId, tabId);
    },
    [closeTab, projectId]
  );

  const tabAccentColor = (tab: TerminalTab) =>
    tab.type === 'task' ? 'text-steel' : tab.type === 'supervisor' ? 'text-bronze-600 dark:text-bronze-400' : 'text-bronze-500';

  return (
    <div
      ref={panelRef}
      className="w-full flex flex-col bg-bronze-200 dark:bg-black/40 flex-shrink-0 font-mono"
      style={{ minHeight: 0, ...(collapsed ? {} : style) }}
    >
      {/* Tab Bar — also serves as the resize drag handle */}
      <div className="relative shrink-0">
        {/* Edge resize strip — sits over the top border */}
        {!collapsed && (
          <div
            onMouseDown={(e) => onResizeStart?.(e)}
            className="absolute inset-x-0 top-0 h-[5px] -translate-y-1/2 cursor-row-resize z-20 group/edge"
          >
            <div className="absolute inset-x-0 top-1/2 h-px bg-transparent group-hover/edge:bg-bronze-800 transition-colors" />
          </div>
        )}
        <div
          className={`h-12 flex items-stretch bg-bronze-300/20 dark:bg-zinc-900/20 overflow-visible border-t border-zinc-200 dark:border-zinc-800 ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          onMouseDown={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('button') || target.closest('[data-clickable]')) return;
            onResizeStart?.(e);
          }}
        >
        <button
          onClick={onToggleCollapsed}
          className="flex items-center justify-center w-12 self-stretch text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-bronze-300/30 dark:hover:bg-zinc-800/30 shrink-0"
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* ── Supervisor tab (always first, pinned) ── */}
        <button
          onClick={() => {
            setDrawerView('supervisor');
            if (collapsed) (onExpand ?? onToggleCollapsed)();
          }}
          className={`relative flex items-center gap-1.5 px-3 self-stretch text-xs transition-colors min-w-[100px] ${
            isSupervisorActive
              ? 'bg-bronze-300/60 dark:bg-zinc-800/60 text-bronze-600 dark:text-bronze-400'
              : 'text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-bronze-300/30 dark:hover:bg-zinc-800/30'
          }`}
        >
          <SquareChevronUpIcon className="w-3 h-3" />
          <span className="max-w-[200px] truncate block">{projectName ? `${projectName} Supervisor` : 'Project Supervisor'}</span>
        </button>

        {/* ── Separator ── */}
        {tabs.length > 0 && (
          <div className="w-px h-5 self-center bg-bronze-400/30 dark:bg-zinc-700/50 mx-0.5" />
        )}

        {/* ── Terminal/task tabs ── */}
        {tabs.map((tab) => (
          <div key={tab.id} className="group/tab flex items-stretch shrink-0 relative">
            <button
              onClick={() => {
                setDrawerView('terminal');
                setActiveTabId(projectId, tab.id);
                if (collapsed) (onExpand ?? onToggleCollapsed)();
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenamingTabId(tab.id);
                setRenameValue(tab.label);
              }}
              className={`relative flex items-center gap-1.5 px-3 self-stretch text-xs transition-colors min-w-[100px] ${
                !isSupervisorActive && activeTabId === tab.id
                  ? 'bg-bronze-300/60 dark:bg-zinc-800/60 ' + tabAccentColor(tab)
                  : 'text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-bronze-300/30 dark:hover:bg-zinc-800/30'
              }`}
            >
              {tab.type === 'supervisor' ? <SquareChevronUpIcon className="w-3 h-3" /> : <TerminalIcon className="w-3 h-3" />}
              <span className="relative">
                <span className={`max-w-[120px] truncate block ${renamingTabId === tab.id ? 'invisible' : ''}`}>
                  {tab.status === 'done' ? '\u2705 ' : ''}
                  {tab.label}
                </span>
                {renamingTabId === tab.id && (
                  <input
                    ref={renameInputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename();
                      if (e.key === 'Escape') { setRenamingTabId(null); setRenameValue(''); }
                    }}
                    onBlur={submitRename}
                    onClick={(e) => e.stopPropagation()}
                    className="absolute inset-0 bg-transparent border border-bronze-400 dark:border-zinc-600 rounded px-1 text-xs outline-none focus:border-bronze-600 dark:focus:border-zinc-400"
                  />
                )}
              </span>
              {/* Dots overlay — hidden until hover */}
              <span
                data-clickable
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuTabId(menuTabId === tab.id ? null : tab.id);
                }}
                className="absolute right-0 inset-y-0 flex items-center pl-4 pr-2 opacity-0 group-hover/tab:opacity-100 transition-opacity cursor-pointer text-bronze-500 hover:text-bronze-700 dark:text-zinc-500 dark:hover:text-zinc-300 bg-gradient-to-l from-bronze-300/90 dark:from-zinc-900/90 from-50% to-transparent"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </span>
            </button>
            {menuTabId === tab.id && (
              <div
                ref={menuRef}
                className="absolute left-0 top-full mt-1 w-40 bg-bronze-50 dark:bg-zinc-800 border border-bronze-400 dark:border-zinc-700 rounded-md shadow-lg z-50 py-1"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuTabId(null);
                    setRenamingTabId(tab.id);
                    setRenameValue(tab.label);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-bronze-700 dark:text-zinc-300 hover:bg-bronze-200 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <PencilIcon className="w-3.5 h-3.5" />
                  Rename
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuTabId(null);
                    removeTab(tab.id);
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-crimson hover:bg-bronze-200 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {tab.type === 'supervisor' ? 'Close' : 'Kill Terminal'}
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="relative flex items-stretch shrink-0">
          <button
            onClick={() => setShowNewMenu((v) => !v)}
            className="flex items-center justify-center w-12 self-stretch text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-bronze-300/30 dark:hover:bg-zinc-800/30"
            title="New tab"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          {showNewMenu && (
            <div
              ref={newMenuRef}
              className="absolute left-0 top-full mt-1 w-44 bg-bronze-50 dark:bg-zinc-800 border border-bronze-400 dark:border-zinc-700 rounded-md shadow-lg z-50 py-1"
            >
              <button
                onClick={() => {
                  setShowNewMenu(false);
                  setDrawerView('terminal');
                  addShellTab();
                  if (collapsed) (onExpand ?? onToggleCollapsed)();
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-bronze-700 dark:text-zinc-300 hover:bg-bronze-200 dark:hover:bg-zinc-700 flex items-center gap-2"
              >
                <TerminalIcon className="w-3.5 h-3.5" />
                New Terminal
              </button>
              <button
                onClick={() => {
                  setShowNewMenu(false);
                  setDrawerView('terminal');
                  addSupervisorTab();
                  if (collapsed) (onExpand ?? onToggleCollapsed)();
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-bronze-700 dark:text-zinc-300 hover:bg-bronze-200 dark:hover:bg-zinc-700 flex items-center gap-2"
              >
                <SquareChevronUpIcon className="w-3.5 h-3.5" />
                {projectName ? `${projectName} Supervisor` : 'Project Supervisor'}
              </button>
            </div>
          )}
        </div>

        {/* Spacer — fills remaining space for grab target */}
        <div className="flex-1" />
        </div>
      </div>

      {/* Content area — supervisor pane or terminal panes */}
      {!collapsed && (
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          {/* Supervisor pane */}
          <ProjectSupervisorPane
            projectId={projectId}
            visible={isSupervisorActive}
            onTaskCreated={onTaskCreated}
          />

          {/* Terminal + supervisor panes (always mounted to preserve state, visibility toggled) */}
          {tabs.map((tab) =>
            tab.type === 'supervisor' ? (
              <ProjectSupervisorPane
                key={tab.id}
                projectId={projectId}
                visible={!isSupervisorActive && activeTabId === tab.id}
                onTaskCreated={onTaskCreated}
              />
            ) : (
              <TerminalPane
                key={tab.id}
                tabId={tab.id}
                visible={!isSupervisorActive && activeTabId === tab.id}
                cwd={projectPath}
                enableDrop
              />
            )
          )}
        </div>
      )}

      {/* Cleanup countdown footer */}
      {!collapsed && !isSupervisorActive && countdownText && (
        <div className="px-3 py-1 text-xs text-zinc-600 dark:text-zinc-600 font-mono shrink-0">
          {countdownText}
        </div>
      )}
    </div>
  );
}
