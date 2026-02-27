'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { XIcon, PaperclipIcon, FileIcon, PlayIcon, Loader2Icon } from 'lucide-react';
import type { Task, TaskAttachment, TaskMode, TaskOutputMode } from '@/lib/types';

interface TaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: (isEmpty: boolean, data?: { title: string; description: string }) => void;
  onSave: (taskId: string, updates: Partial<Task>) => void;
  onMoveToInProgress?: (taskId: string, currentData: Partial<Task>) => Promise<void>;
  initialDescription?: string;
}

function openDataUrl(dataUrl: string) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: mime });
  window.open(URL.createObjectURL(blob), '_blank');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskModal({ task, isOpen, onClose, onSave, onMoveToInProgress, initialDescription }: TaskModalProps) {
  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description);
  const [mode, setMode] = useState<TaskMode>(task.mode || 'code');
  const [outputMode, setOutputMode] = useState<TaskOutputMode>(task.outputMode || 'pretty');
  const [attachments, setAttachments] = useState<TaskAttachment[]>(
    task.attachments || [],
  );
  const [isDragOver, setIsDragOver] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCursor = useRef<number | null>(null);

  useEffect(() => {
    setTitle(task.title || '');
    setDescription(initialDescription ?? task.description);
    setMode(task.mode || 'code');
    setOutputMode(task.outputMode || 'pretty');
    setAttachments(task.attachments || []);
  }, [task.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const wasOpen = useRef(false);
  useEffect(() => {
    if (isOpen && !wasOpen.current) {
      setTimeout(() => {
        const el = descriptionRef.current;
        if (el) {
          el.focus();
          const len = el.value.length;
          if (len > 0) el.setSelectionRange(len, len);
        }
      }, 50);
    }
    wasOpen.current = isOpen;
  }, [isOpen, task.id]);

  const autosave = useCallback(
    (newTitle: string, newDesc: string, newAttachments: TaskAttachment[], newMode?: TaskMode, newOutputMode?: TaskOutputMode) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        onSave(task.id, {
          title: newTitle,
          description: newDesc,
          attachments: newAttachments,
          mode: newMode,
          outputMode: newOutputMode,
        });
      }, 400);
    },
    [task.id, onSave],
  );

  const handleClose = useCallback(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    const isEmpty = !title.trim() && !description.trim();
    if (!isEmpty) {
      onSave(task.id, {
        title,
        description,
        attachments,
        mode,
      });
    }
    onClose(isEmpty, { title, description });
  }, [task.id, title, description, attachments, mode, onSave, onClose]);

  useEscapeKey(handleClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  // Set cursor position after description state updates (for bullet list manipulation)
  useEffect(() => {
    if (pendingCursor.current !== null && descriptionRef.current) {
      descriptionRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [description]);

  // Cmd+Enter to trigger "Start Now", Cmd+Shift+A to attach file
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && e.metaKey && onMoveToInProgress && description.trim() && !dispatching) {
        e.preventDefault();
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        setDispatching(true);
        onMoveToInProgress(task.id, { title, description, attachments, mode });
      }
      if (e.key === 'a' && e.metaKey && e.shiftKey) {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onMoveToInProgress, title, description, attachments, mode, dispatching, task.id]);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    autosave(val, description, attachments, mode, outputMode);
  };

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    autosave(title, val, attachments, mode, outputMode);
  };

  const handleModeChange = (newMode: TaskMode) => {
    setMode(newMode);
    autosave(title, description, attachments, newMode, outputMode);
  };

  const addFiles = (files: FileList | File[]) => {
    Array.from(files).forEach((f) => {
      const att: TaskAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name,
        size: f.size,
        type: f.type,
      };
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          att.dataUrl = e.target?.result as string;
          setAttachments((prev) => {
            const updated = [...prev, att];
            autosave(title, description, updated, mode, outputMode);
            return updated;
          });
        };
        reader.readAsDataURL(f);
      } else {
        setAttachments((prev) => {
          const updated = [...prev, att];
          autosave(title, description, updated, mode, outputMode);
          return updated;
        });
      }
    });
  };

  const removeAttachment = (id: string) => {
    const updated = attachments.filter((a) => a.id !== id);
    setAttachments(updated);
    autosave(title, description, updated, mode, outputMode);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-none"
        onClick={handleClose}
      />

      <div
        className={`relative w-full max-w-2xl bg-bronze-50 dark:bg-zinc-900 border rounded-lg shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 transition-colors overflow-hidden ${isDragOver ? 'border-steel/50' : 'border-bronze-300 dark:border-zinc-800'}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <button
          onClick={handleClose}
          className="absolute top-3 right-3 text-zinc-400 dark:text-zinc-600 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors p-1 z-10"
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 pt-5">
          {/* Mode selector */}
          <div className="bg-surface-secondary p-0.5 rounded-md flex items-center border border-border-default w-fit mb-3">
            {([
              ['auto', 'Auto', 'Auto mode. Claude decides the approach.'],
              ['code', 'Code', 'Coding mode. Bypass permissions.'],
              ['plan', 'Plan', 'Planning mode. Agent proposes, you approve.'],
              ['answer', 'Answer', 'Answer mode. Research only, no code changes.'],
            ] as const).map(([value, label, tooltip]) => (
              <button
                key={value}
                onClick={() => handleModeChange(value)}
                title={tooltip}
                className={`relative px-3 py-1 text-xs font-medium rounded transition-colors z-10 ${
                  mode === value
                    ? 'text-text-chrome-active'
                    : 'text-text-chrome hover:text-text-chrome-hover'
                }`}
              >
                {mode === value && (
                  <div
                    className="absolute inset-0 bg-bronze-50 dark:bg-zinc-800/60 rounded border border-bronze-400/50 dark:border-bronze-800/50 shadow-sm"
                    style={{ zIndex: -1 }}
                  />
                )}
                {label}
              </button>
            ))}
          </div>

          <input
            ref={titleRef}
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                descriptionRef.current?.focus();
              }
            }}
            className="w-full bg-transparent text-xl font-semibold text-bronze-900 dark:text-zinc-100 placeholder-bronze-500 dark:placeholder-zinc-700 focus:outline-none mb-4 pr-8"
            placeholder="Untitled"
          />
          <textarea
            ref={descriptionRef}
            value={description}
            onChange={(e) => {
              const val = e.target.value;
              const cursor = e.target.selectionStart ?? val.length;
              // Detect /att slash command right before cursor to trigger file picker
              const before = cursor - 4;
              if (before >= 0 && val.substring(before, cursor) === '/att' && (before === 0 || /\s/.test(val[before - 1]))) {
                const cleaned = val.substring(0, before) + val.substring(cursor);
                pendingCursor.current = before;
                handleDescriptionChange(cleaned);
                setTimeout(() => fileInputRef.current?.click(), 0);
                return;
              }
              // Detect /atr slash command to attach most recent desktop image
              if (before >= 0 && val.substring(before, cursor) === '/atr' && (before === 0 || /\s/.test(val[before - 1]))) {
                const cleaned = val.substring(0, before) + val.substring(cursor);
                pendingCursor.current = before;
                handleDescriptionChange(cleaned);
                fetch('/api/recent-desktop-image')
                  .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
                  .then((img: { name: string; size: number; type: string; dataUrl: string }) => {
                    const att: TaskAttachment = {
                      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                      name: img.name,
                      size: img.size,
                      type: img.type,
                      dataUrl: img.dataUrl,
                    };
                    setAttachments(prev => {
                      const updated = [...prev, att];
                      autosave(title, description, updated, mode, outputMode);
                      return updated;
                    });
                  })
                  .catch(err => console.error('[/atr] failed to fetch recent desktop image:', err));
                return;
              }
              handleDescriptionChange(val);
            }}
            onKeyDown={(e) => {
              const textarea = descriptionRef.current;
              if (!textarea) return;

              const { selectionStart, selectionEnd, value } = textarea;
              const noSelection = selectionStart === selectionEnd;

              // Find current line boundaries
              const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
              const lineEndIdx = value.indexOf('\n', selectionStart);
              const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
              const currentLine = value.substring(lineStart, lineEnd);
              const bulletMatch = currentLine.match(/^(\s*)- /);

              // Enter on a bullet line
              if (e.key === 'Enter' && !e.metaKey && !e.shiftKey && !e.ctrlKey && bulletMatch && noSelection) {
                e.preventDefault();
                const indent = bulletMatch[1];
                const bulletPrefixEnd = lineStart + bulletMatch[0].length;
                const contentAfterBullet = value.substring(bulletPrefixEnd, lineEnd).trim();

                if (!contentAfterBullet) {
                  // Empty bullet — remove it (exit list mode)
                  const newValue = value.substring(0, lineStart) + value.substring(lineEnd);
                  pendingCursor.current = lineStart;
                  handleDescriptionChange(newValue);
                } else {
                  // Continue list — split at cursor
                  const insertion = `\n${indent}- `;
                  const newValue = value.substring(0, selectionStart) + insertion + value.substring(selectionStart);
                  pendingCursor.current = selectionStart + insertion.length;
                  handleDescriptionChange(newValue);
                }
                return;
              }

              // Tab / Shift+Tab on bullet line — indent/outdent
              if (e.key === 'Tab' && bulletMatch && noSelection) {
                e.preventDefault();
                if (e.shiftKey) {
                  // Outdent — remove up to 2 spaces
                  if (bulletMatch[1].length >= 2) {
                    const newValue = value.substring(0, lineStart) + currentLine.substring(2) + value.substring(lineEnd);
                    pendingCursor.current = Math.max(lineStart, selectionStart - 2);
                    handleDescriptionChange(newValue);
                  }
                } else {
                  // Indent — add 2 spaces
                  const newValue = value.substring(0, lineStart) + '  ' + currentLine + value.substring(lineEnd);
                  pendingCursor.current = selectionStart + 2;
                  handleDescriptionChange(newValue);
                }
                return;
              }

              // Backspace at start of bullet content — outdent or remove bullet
              if (e.key === 'Backspace' && bulletMatch && noSelection) {
                const indent = bulletMatch[1];
                const bulletPrefixEnd = lineStart + bulletMatch[0].length;

                if (selectionStart === bulletPrefixEnd) {
                  e.preventDefault();
                  if (indent.length >= 2) {
                    // Outdent first
                    const newValue = value.substring(0, lineStart) + currentLine.substring(2) + value.substring(lineEnd);
                    pendingCursor.current = selectionStart - 2;
                    handleDescriptionChange(newValue);
                  } else {
                    // Remove bullet entirely
                    const newValue = value.substring(0, lineStart) + currentLine.substring(bulletMatch[0].length) + value.substring(lineEnd);
                    pendingCursor.current = lineStart;
                    handleDescriptionChange(newValue);
                  }
                  return;
                }
              }

              // Backspace on empty description — focus title
              if (e.key === 'Backspace' && description === '') {
                e.preventDefault();
                const input = titleRef.current;
                if (input) {
                  input.focus();
                  input.setSelectionRange(input.value.length, input.value.length);
                }
              }
            }}
            className="w-full min-h-[280px] bg-transparent text-sm text-bronze-700 dark:text-zinc-400 placeholder-bronze-500 dark:placeholder-zinc-700 focus:outline-none resize-none leading-relaxed"
            placeholder="Write something..."
          />
        </div>

        {/* Drag overlay hint */}
        {isDragOver && (
          <div className="absolute inset-0 bg-steel/5 rounded-lg flex items-center justify-center pointer-events-none z-20">
            <div className="text-sm text-steel font-medium">
              Drop files here
            </div>
          </div>
        )}

        {/* Attachments — float above footer inside the content area */}
        {attachments.length > 0 && (
          <div className="px-6 pb-4 flex flex-wrap gap-2 shrink-0">
            {attachments.map((att) => {
              const isImage = att.type?.startsWith('image/') || false;
              return isImage && att.dataUrl ? (
                <div
                  key={att.id}
                  className="relative group rounded-md overflow-hidden border border-bronze-400/50 dark:border-zinc-700/50 bg-bronze-200/60 dark:bg-zinc-800/60 cursor-pointer min-w-[2.5rem]"
                  onClick={() => openDataUrl(att.dataUrl!)}
                >
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="h-20 w-auto max-w-[120px] object-cover block mx-auto"
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                    className="absolute top-1 right-1 p-0.5 rounded bg-black/60 text-white/80 hover:text-crimson opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 py-1">
                    <span className="text-[10px] text-zinc-300 truncate block">
                      {att.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  key={att.id}
                  className="flex items-center gap-2 bg-bronze-200/60 dark:bg-zinc-800/60 border border-bronze-400/50 dark:border-zinc-700/50 rounded-md px-3 py-2.5 group cursor-pointer"
                  onClick={() => att.dataUrl && openDataUrl(att.dataUrl)}
                >
                  <FileIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[11px] text-zinc-700 dark:text-zinc-300 truncate max-w-[140px] leading-tight">
                      {att.name}
                    </span>
                    <span className="text-[10px] text-zinc-600 leading-tight">
                      {formatSize(att.size)}
                    </span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAttachment(att.id); }}
                    className="text-zinc-600 hover:text-crimson transition-colors ml-1 opacity-0 group-hover:opacity-100"
                  >
                    <XIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer toolbar */}
        <div className="border-t border-bronze-300/60 dark:border-zinc-800/60 flex items-stretch shrink-0">
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach file (⌘⇧A)"
            className="flex items-center gap-1.5 text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors text-xs px-4 py-3"
          >
            <PaperclipIcon className="w-3.5 h-3.5" />
            <span>Attach file</span>
          </button>

          {/* Output mode toggle */}
          <div className="flex items-center gap-0.5 px-2 border-l border-bronze-300/60 dark:border-zinc-800/60">
            <button
              onClick={() => { setOutputMode('pretty'); autosave(title, description, attachments, mode, 'pretty'); }}
              className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                outputMode === 'pretty'
                  ? 'bg-bronze-300/80 text-bronze-800 dark:bg-zinc-700 dark:text-zinc-200'
                  : 'text-bronze-500 hover:text-bronze-700 dark:text-zinc-500 dark:hover:text-zinc-400'
              }`}
            >
              Pretty
            </button>
            <button
              onClick={() => { setOutputMode('raw'); autosave(title, description, attachments, mode, 'raw'); }}
              className={`px-1.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                outputMode === 'raw'
                  ? 'bg-bronze-300/80 text-bronze-800 dark:bg-zinc-700 dark:text-zinc-200'
                  : 'text-bronze-500 hover:text-bronze-700 dark:text-zinc-500 dark:hover:text-zinc-400'
              }`}
            >
              Raw
            </button>
          </div>

          <div className="flex-1" />

          {onMoveToInProgress && (
            <button
              onClick={async () => {
                if (saveTimeout.current) clearTimeout(saveTimeout.current);
                setDispatching(true);
                await onMoveToInProgress(task.id, { title, description, attachments, mode, outputMode });
              }}
              disabled={!description.trim() || dispatching}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium text-steel/80 border-l border-border-default transition-colors ${dispatching ? 'pointer-events-none' : 'hover:text-steel hover:border-steel/50 hover:bg-steel/10 disabled:opacity-30 disabled:pointer-events-none'}`}
            >
              {dispatching ? (
                <Loader2Icon className="w-3 h-3 animate-spin" />
              ) : (
                <PlayIcon className="w-3 h-3" />
              )}
              {dispatching ? 'Starting...' : 'Start Now'}
            </button>
          )}

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFiles(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
