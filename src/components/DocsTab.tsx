'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import 'highlight.js/styles/github-dark.css';
import dynamic from 'next/dynamic';
import {
  Eye,
  Code,
  Loader2,
  Check,
  Plus,
  Sparkles,
  FileText,
  Search,
  ChevronDown,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { TreeNode } from './FileTree';
import type { Project } from '@/lib/types';
import WorkbenchPanel from '@/components/WorkbenchPanel';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="flex-1 bg-[#1e1e1e]" />,
});

interface DocsTabProps {
  project: Project;
}

interface MdFile {
  name: string;
  path: string;
  relativePath: string;
  isAiFile: boolean;
}

const AI_FILE_NAMES = new Set([
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  'CONVENTIONS.md',
  'CONTRIBUTING.md',
  'DEVELOPMENT.md',
  'ARCHITECTURE.md',
  '.cursorrules',
]);

// Priority order for AI files (lower = higher priority)
const AI_FILE_PRIORITY: Record<string, number> = {
  'CLAUDE.md': 0,
  'AGENTS.md': 1,
  'README.md': 2,
  'CONVENTIONS.md': 3,
  'CONTRIBUTING.md': 4,
  'ARCHITECTURE.md': 5,
  'DEVELOPMENT.md': 6,
  '.cursorrules': 7,
};

const TEMPLATES: Record<string, { filename: string; content: string }> = {
  claude: {
    filename: 'CLAUDE.md',
    content: `# Project Instructions for Claude

## Overview

## Code Style

## Important Notes
`,
  },
  agents: {
    filename: 'AGENTS.md',
    content: `# AGENTS.md

## Agent Guidelines

## Task Conventions

## Testing Requirements
`,
  },
  readme: {
    filename: 'README.md',
    content: `# Project Name

## Getting Started

## Development

## Architecture
`,
  },
};

const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 160;
const MAX_SIDEBAR_WIDTH = 500;
const SAVE_DEBOUNCE_MS = 1000;

type SaveStatus = 'idle' | 'saving' | 'saved';

function flattenMdFiles(nodes: TreeNode[], projectPath: string): MdFile[] {
  const files: MdFile[] = [];
  const walk = (items: TreeNode[]) => {
    for (const node of items) {
      if (node.type === 'file') {
        const ext = node.name.split('.').pop()?.toLowerCase();
        if (ext === 'md' || ext === 'mdx' || node.name === '.cursorrules') {
          const relativePath = node.path.replace(projectPath + '/', '');
          const isAiFile = AI_FILE_NAMES.has(node.name);
          files.push({ name: node.name, path: node.path, relativePath, isAiFile });
        }
      } else if (node.children) {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return files;
}

export function DocsTab({ project }: DocsTabProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewMenu, setShowNewMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);

  // Workbench panel state
  const [wbCollapsed, setWbCollapsed] = useState(false);
  const [wbHidden, setWbHidden] = useState(false);
  const [wbPercent, setWbPercent] = useState(40);
  const [wbDragging, setWbDragging] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const newMenuRef = useRef<HTMLDivElement>(null);
  const autoSelectedRef = useRef(false);

  // Flatten tree into md files
  const mdFiles = useMemo(() => flattenMdFiles(tree, project.path), [tree, project.path]);

  const { aiFiles, otherFiles } = useMemo(() => {
    const filter = searchFilter.toLowerCase();
    const filtered = filter
      ? mdFiles.filter((f) => f.relativePath.toLowerCase().includes(filter))
      : mdFiles;

    const ai = filtered
      .filter((f) => f.isAiFile)
      .sort((a, b) => (AI_FILE_PRIORITY[a.name] ?? 99) - (AI_FILE_PRIORITY[b.name] ?? 99));
    const other = filtered
      .filter((f) => !f.isAiFile)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    return { aiFiles: ai, otherFiles: other };
  }, [mdFiles, searchFilter]);

  // Sidebar resize drag handling
  useEffect(() => {
    if (!isSidebarDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, x)));
    };
    const handleMouseUp = () => setIsSidebarDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isSidebarDragging]);

  // Workbench panel callbacks
  const toggleWbCollapsed = useCallback(() => setWbCollapsed(p => !p), []);
  const expandWb = useCallback(() => {
    setWbCollapsed(false);
    setWbPercent(p => Math.max(p, 25));
  }, []);
  const handleWbResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setWbDragging(true);
  }, []);

  // Workbench resize drag handling
  useEffect(() => {
    if (!wbDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!outerRef.current) return;
      const rect = outerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = ((rect.height - y) / rect.height) * 100;
      if (wbCollapsed && percent > 5) setWbCollapsed(false);
      setWbPercent(Math.min(100, Math.max(3, percent)));
    };
    const handleMouseUp = (e: MouseEvent) => {
      if (outerRef.current) {
        const rect = outerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const pixelHeight = rect.height - y;
        if (pixelHeight < 200) {
          setWbCollapsed(true);
          setWbPercent(40);
        }
      }
      setWbDragging(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [wbDragging, wbCollapsed]);

  // Close new menu on outside click
  useEffect(() => {
    if (!showNewMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [showNewMenu]);

  // Load file tree
  useEffect(() => {
    if (!project.path) return;
    autoSelectedRef.current = false;
    fetch(`/api/files/tree?path=${encodeURIComponent(project.path)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTree(data);
      })
      .catch(console.error);
  }, [project.path]);

  // Auto-select first AI file on mount
  useEffect(() => {
    if (autoSelectedRef.current || mdFiles.length === 0) return;
    autoSelectedRef.current = true;
    const claude = mdFiles.find((f) => f.name === 'CLAUDE.md');
    const first = claude || mdFiles.find((f) => f.isAiFile) || mdFiles[0];
    if (first) loadFile(first.path);
  }, [mdFiles]);

  // Save file
  const saveFile = useCallback(async (filePath: string, content: string) => {
    setSaveStatus('saving');
    try {
      await fetch('/api/files/write', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath, content }),
      });
      lastSavedContentRef.current = content;
      setSaveStatus('saved');
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('idle');
    }
  }, []);

  // Debounced auto-save
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined || !selectedPath) return;
      setFileContent(value);
      if (value !== lastSavedContentRef.current) {
        setSaveStatus('saving');
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (value !== lastSavedContentRef.current) {
          saveFile(selectedPath, value);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [selectedPath, saveFile]
  );

  // Load file content
  const loadFile = useCallback(async (filePath: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveStatus('idle');
    setSelectedPath(filePath);
    setEditMode(false);
    try {
      const res = await fetch(`/api/files/read?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      if (data.error) {
        setFileContent(`<!-- Error: ${data.error} -->`);
        lastSavedContentRef.current = '';
      } else {
        setFileContent(data.content);
        lastSavedContentRef.current = data.content;
      }
    } catch {
      setFileContent('<!-- Failed to load file -->');
      lastSavedContentRef.current = '';
    }
  }, []);

  // Create file from template
  const handleCreateFromTemplate = useCallback(
    async (key: string) => {
      setShowNewMenu(false);
      const template = TEMPLATES[key];
      if (!template) return;
      const filePath = `${project.path}/${template.filename}`;
      try {
        await fetch('/api/files/write', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: filePath, content: template.content }),
        });
        // Refresh tree then select new file
        const res = await fetch(`/api/files/tree?path=${encodeURIComponent(project.path)}`);
        const data = await res.json();
        if (Array.isArray(data)) setTree(data);
        loadFile(filePath);
      } catch (e) {
        console.error('Failed to create file:', e);
      }
    },
    [project.path, loadFile]
  );

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const selectedFile = mdFiles.find((f) => f.path === selectedPath);

  return (
    <div ref={outerRef} className="flex-1 flex flex-col h-full overflow-hidden bg-surface-deep">
      {/* Docs content area */}
      <div
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        style={wbCollapsed ? undefined : { flexBasis: `${100 - wbPercent}%` }}
      >
      {/* Toolbar */}
      <div className="h-10 flex-shrink-0 flex items-center justify-between px-3 border-b border-border-default bg-surface-base/80">
        <div className="flex items-center gap-2">
          {/* Edit/Preview toggle */}
          {selectedPath && (
            <div className="flex items-center bg-surface-hover rounded-md p-0.5 border border-border-strong">
              <button
                onClick={() => setEditMode(false)}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                  !editMode
                    ? 'bg-border-strong text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
              <button
                onClick={() => setEditMode(true)}
                className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${
                  editMode
                    ? 'bg-border-strong text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                <Code className="w-3 h-3" />
                Edit
              </button>
            </div>
          )}

          {/* File path breadcrumb */}
          {selectedFile && (
            <span className="text-xs text-text-tertiary font-mono truncate max-w-md">
              {selectedFile.relativePath}
            </span>
          )}

          {/* Save status */}
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-1 text-xs text-text-tertiary">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* New file dropdown */}
          <div className="relative" ref={newMenuRef}>
            <button
              onClick={() => setShowNewMenu(!showNewMenu)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-text-secondary bg-surface-hover hover:bg-border-strong rounded-md border border-border-strong"
            >
              <Plus className="w-3 h-3" />
              New
              <ChevronDown className="w-3 h-3" />
            </button>
            {showNewMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-surface-base border border-border-strong rounded-md shadow-xl z-50 py-1">
                {Object.entries(TEMPLATES).map(([key, template]) => {
                  const exists = mdFiles.some((f) => f.name === template.filename);
                  return (
                    <button
                      key={key}
                      onClick={() => !exists && handleCreateFromTemplate(key)}
                      disabled={exists}
                      className={`w-full text-left px-3 py-1.5 text-xs ${
                        exists
                          ? 'text-text-tertiary/50 cursor-not-allowed'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <span className="font-medium">{template.filename}</span>
                      {exists && <span className="ml-2 text-text-tertiary/40">(exists)</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content: sidebar + content */}
      <div ref={containerRef} className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar */}
        <div
          className="h-full overflow-y-auto border-r border-border-default bg-surface-base/50 flex-shrink-0"
          style={{ width: sidebarWidth }}
        >
          {/* Search */}
          <div className="p-2 border-b border-border-default">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-hover rounded-md border border-border-strong">
              <Search className="w-3 h-3 text-text-tertiary flex-shrink-0" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter docs..."
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none"
              />
            </div>
          </div>

          {mdFiles.length === 0 ? (
            <div className="p-4 text-center text-text-tertiary text-xs">
              No markdown files found
            </div>
          ) : (
            <div className="py-1">
              {/* AI Instructions section */}
              {aiFiles.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    AI Instructions
                  </div>
                  {aiFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => loadFile(file.path)}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${
                        selectedPath === file.path
                          ? 'bg-lazuli/15 text-lazuli border-r-2 border-lazuli'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <Sparkles className="w-3 h-3 flex-shrink-0 text-amber-400/70" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{file.name}</div>
                        {file.relativePath !== file.name && (
                          <div className="text-[10px] text-text-tertiary truncate">
                            {file.relativePath}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}

              {/* Other docs section */}
              {otherFiles.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5 mt-1">
                    <FileText className="w-3 h-3" />
                    Project Docs
                  </div>
                  {otherFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => loadFile(file.path)}
                      className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs transition-colors ${
                        selectedPath === file.path
                          ? 'bg-lazuli/15 text-lazuli border-r-2 border-lazuli'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      <FileText className="w-3 h-3 flex-shrink-0 text-text-tertiary" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{file.name}</div>
                        {file.relativePath !== file.name && (
                          <div className="text-[10px] text-text-tertiary truncate">
                            {file.relativePath}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsSidebarDragging(true);
          }}
          className={`w-[5px] flex-shrink-0 cursor-col-resize transition-colors ${
            isSidebarDragging ? 'bg-lazuli-dark' : 'bg-border-default hover:bg-border-hover'
          }`}
        />

        {/* Content area */}
        <div className="flex-1 min-w-0 h-full overflow-hidden">
          {!selectedPath ? (
            <div className="h-full flex flex-col items-center justify-center text-text-tertiary text-sm gap-2">
              <FileText className="w-8 h-8 text-text-tertiary/50" />
              <span>Select a document to view</span>
            </div>
          ) : editMode ? (
            <MonacoEditor
              height="100%"
              language="markdown"
              value={fileContent}
              theme="vs-dark"
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                fontFamily: 'Geist Mono, monospace',
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 12 },
                renderLineHighlight: 'line',
                lineHeight: 1.6,
              }}
            />
          ) : (
            <div className="h-full overflow-y-auto p-6">
              <div className="prose prose-zinc dark:prose-invert prose-sm max-w-none prose-pre:bg-surface-hover prose-pre:text-text-primary prose-code:text-lazuli prose-headings:text-text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                  {fileContent}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar drag overlay */}
      {isSidebarDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
      </div>

      <WorkbenchPanel
        projectId={project.id}
        projectPath={project.path}
        scope="docs"
        agentContext="project"
        style={{ flexBasis: `${wbPercent}%` }}
        collapsed={wbCollapsed}
        onToggleCollapsed={toggleWbCollapsed}
        onExpand={expandWb}
        onResizeStart={handleWbResizeStart}
        isDragging={wbDragging}
        hidden={wbHidden}
        onToggleHidden={() => setWbHidden(h => !h)}
      />

      {/* Workbench drag overlay */}
      {wbDragging && <div className="fixed inset-0 z-50 cursor-grabbing" />}
    </div>
  );
}
