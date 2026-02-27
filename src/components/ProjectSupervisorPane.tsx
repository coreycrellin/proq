'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Trash2Icon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  SendIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
  FileIcon,
} from 'lucide-react';
import type { ChatLogEntry, ToolCall, TaskAttachment } from '@/lib/types';
import {
  type RenderBlock,
  type ContentBlock,
  normalizeToolResult,
  TextBlock,
  ToolBlock,
  ThinkingBlock,
  ResultBlock,
  UserMessageBlock,
  SimpleToolBlock,
} from './AgentBlocks';
import { ScrambleText } from './ScrambleText';

interface ProjectSupervisorPaneProps {
  projectId: string;
  visible: boolean;
  onTaskCreated?: () => void;
}

export function ProjectSupervisorPane({ projectId, visible, onTaskCreated }: ProjectSupervisorPaneProps) {
  const [historyBlocks, setHistoryBlocks] = useState<RenderBlock[]>([]);
  const [streamBlocks, setStreamBlocks] = useState<RenderBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [draft, setDraft] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [collapseSignal, setCollapseSignal] = useState(1);
  const isCollapsed = collapseSignal > 0;
  const abortRef = useRef<AbortController | null>(null);
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);
  const blockIdCounter = useRef(0);
  const toolBlockMap = useRef<Map<string, string>>(new Map());
  const messageQueueRef = useRef<Array<{text: string, atts: TaskAttachment[]}>>([]);
  const isLoadingRef = useRef(false);
  const streamBlocksRef = useRef<RenderBlock[]>([]);
  const executeSendRef = useRef<(text: string, atts: TaskAttachment[]) => Promise<void>>(() => Promise.resolve());

  const nextBlockId = useCallback(() => {
    blockIdCounter.current += 1;
    return `sv-block-${blockIdCounter.current}`;
  }, []);

  // Convert ChatLogEntry[] to RenderBlock[] for loaded history
  const convertHistoryToBlocks = useCallback((messages: ChatLogEntry[]): RenderBlock[] => {
    const blocks: RenderBlock[] = [];
    let counter = 0;
    for (const msg of messages) {
      if (msg.role === 'user') {
        blocks.push({
          id: `hist-${counter++}`,
          type: 'user-message',
          userMessage: msg.message,
          status: 'complete',
        });
      } else {
        // proq message — show tool calls then text
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            blocks.push({
              id: `hist-${counter++}`,
              type: 'tool',
              toolName: tc.action,
              toolInput: { _summary: tc.detail },
              status: 'complete',
            });
          }
        }
        if (msg.message && msg.message !== '(tool calls only)') {
          blocks.push({
            id: `hist-${counter++}`,
            type: 'text',
            text: msg.message,
            status: 'complete',
          });
        }
      }
    }
    return blocks;
  }, []);

  // Load history on mount / project change
  useEffect(() => {
    if (loadedRef.current === projectId) return;
    loadedRef.current = projectId;
    setHistoryBlocks([]);
    setStreamBlocks([]);
    streamBlocksRef.current = [];
    messageQueueRef.current = [];
    setQueueLength(0);
    setDraft('');
    setInputValue('');
    blockIdCounter.current = 0;
    toolBlockMap.current.clear();

    fetch(`/api/projects/${projectId}/supervisor`)
      .then((res) => res.json())
      .then((data) => {
        if (data.chatLog) {
          setHistoryBlocks(convertHistoryToBlocks(data.chatLog));
        }
        if (data.draft) {
          setDraft(data.draft);
          setInputValue(data.draft);
        }
      })
      .catch(console.error);
  }, [projectId, convertHistoryToBlocks]);

  // Debounced draft persistence
  const handleDraftChange = useCallback((value: string) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      fetch(`/api/projects/${projectId}/supervisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: value }),
      }).catch(console.error);
    }, 500);
  }, [projectId]);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  }, []);

  // Process a raw stream-json event into blocks (same logic as AgentStreamView)
  const processStreamEvent = useCallback((event: Record<string, unknown>) => {
    const eventType = event.type as string;

    if (eventType === 'assistant' && event.message) {
      const msg = event.message as { content?: ContentBlock[] };
      if (!msg.content) return;

      const newBlocks: RenderBlock[] = [];
      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          newBlocks.push({
            id: nextBlockId(),
            type: 'text',
            text: block.text,
            status: 'complete',
          });
        } else if (block.type === 'thinking' && block.thinking) {
          newBlocks.push({
            id: nextBlockId(),
            type: 'thinking',
            thinking: block.thinking,
            status: 'complete',
          });
        } else if (block.type === 'tool_use' && block.name && block.id) {
          const blockId = nextBlockId();
          toolBlockMap.current.set(block.id, blockId);
          newBlocks.push({
            id: blockId,
            type: 'tool',
            toolName: block.name,
            toolInput: (block.input as Record<string, unknown>) || {},
            toolUseId: block.id,
            status: 'active',
          });
        }
      }

      if (newBlocks.length > 0) {
        setStreamBlocks(prev => { const next = [...prev, ...newBlocks]; streamBlocksRef.current = next; return next; });
      }
    }

    if (eventType === 'user' && event.message) {
      const msg = event.message as { content?: ContentBlock[] };
      if (!msg.content) return;

      for (const block of msg.content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const blockId = toolBlockMap.current.get(block.tool_use_id);
          if (blockId) {
            const resultStr = normalizeToolResult(block.content);
            const isError = block.is_error === true;
            setStreamBlocks(prev => {
              const next = prev.map(b =>
                b.id === blockId
                  ? { ...b, toolResult: resultStr, toolError: isError, status: 'complete' as const }
                  : b
              );
              streamBlocksRef.current = next;
              return next;
            });
          }
        }
      }
    }

    if (eventType === 'result') {
      setStreamBlocks(prev => {
        const next = [...prev, {
          id: nextBlockId(),
          type: 'result' as const,
          resultText: (event.result as string) || '',
          costUsd: event.cost_usd as number | undefined,
          durationMs: event.duration_ms as number | undefined,
          numTurns: event.num_turns as number | undefined,
          isError: event.is_error as boolean | undefined,
          status: 'complete' as const,
        }];
        streamBlocksRef.current = next;
        return next;
      });
    }
  }, [nextBlockId]);

  // File attachment helpers
  const addFiles = useCallback((files: FileList | File[]) => {
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
          setAttachments((prev) => [...prev, att]);
        };
        reader.readAsDataURL(f);
      } else {
        setAttachments((prev) => [...prev, att]);
      }
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Core send logic — always takes text/atts directly to avoid stale closures
  const executeSend = useCallback(async (text: string, atts: TaskAttachment[]) => {
    isLoadingRef.current = true;

    const imageUrls = atts
      .filter(a => a.type?.startsWith('image/') && a.dataUrl)
      .map(a => a.dataUrl!);

    // Flush any stream blocks from previous turn into history, then add user message
    const currentStreamBlocks = streamBlocksRef.current;
    setHistoryBlocks(prev => [
      ...prev,
      ...currentStreamBlocks,
      {
        id: nextBlockId(),
        type: 'user-message' as const,
        userMessage: text,
        userImages: imageUrls.length > 0 ? imageUrls : undefined,
        status: 'complete' as const,
      },
    ]);
    setStreamBlocks([]);
    streamBlocksRef.current = [];
    toolBlockMap.current.clear();

    setIsLoading(true);
    setIsStreaming(true);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const payload: Record<string, unknown> = { message: text };
      if (atts.length > 0) payload.attachments = atts;

      const res = await fetch(`/api/projects/${projectId}/supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let didCreateTask = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as Record<string, unknown>;

            if (event.type === 'error') {
              const errBlock: RenderBlock = { id: nextBlockId(), type: 'text', text: `Error: ${event.error}`, status: 'complete' };
              setStreamBlocks(prev => { const next = [...prev, errBlock]; streamBlocksRef.current = next; return next; });
              continue;
            }

            processStreamEvent(event);

            if (event.type === 'assistant') {
              const msg = event.message as { content?: Array<Record<string, unknown>> } | undefined;
              if (msg?.content) {
                for (const block of msg.content) {
                  if (block.type === 'tool_use' && block.name === 'Bash') {
                    const input = block.input as Record<string, unknown> | undefined;
                    if (input?.command && String(input.command).includes('/tasks')) {
                      didCreateTask = true;
                    }
                  }
                }
              }
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (didCreateTask) onTaskCreated?.();
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errBlock: RenderBlock = { id: nextBlockId(), type: 'text', text: `Error: ${err}`, status: 'complete' };
        setStreamBlocks(prev => { const next = [...prev, errBlock]; streamBlocksRef.current = next; return next; });
      }
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
      isLoadingRef.current = false;
      abortRef.current = null;

      // Process next queued message
      const next = messageQueueRef.current.shift();
      if (next) {
        setQueueLength(messageQueueRef.current.length);
        setTimeout(() => executeSendRef.current(next.text, next.atts), 0);
      } else {
        setQueueLength(0);
      }
    }
  }, [projectId, nextBlockId, processStreamEvent, onTaskCreated]);

  // Keep ref up to date so queue processor always calls latest version
  executeSendRef.current = executeSend;

  const handleSendMessage = useCallback(() => {
    const text = inputValue.trim();
    const atts = attachments.length > 0 ? [...attachments] : [];
    if (!text && atts.length === 0) return;

    setInputValue('');
    setAttachments([]);
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    handleDraftChange('');

    if (isLoadingRef.current) {
      // Queue for after current response finishes
      messageQueueRef.current.push({ text, atts });
      setQueueLength(messageQueueRef.current.length);
      return;
    }

    executeSend(text, atts);
  }, [inputValue, attachments, handleDraftChange, executeSend]);

  const handleClear = useCallback(async () => {
    await fetch(`/api/projects/${projectId}/supervisor`, { method: 'DELETE' });
    setHistoryBlocks([]);
    setStreamBlocks([]);
    streamBlocksRef.current = [];
    messageQueueRef.current = [];
    setQueueLength(0);
    blockIdCounter.current = 0;
    toolBlockMap.current.clear();
  }, [projectId]);

  // Handle input changes (with /att and /atr shortcuts)
  const handleInputChange = useCallback((val: string, cursorPos: number) => {
    const before = cursorPos - 4;
    if (before >= 0 && val.substring(before, cursorPos) === '/att' && (before === 0 || /\s/.test(val[before - 1]))) {
      setInputValue(val.substring(0, before) + val.substring(cursorPos));
      setTimeout(() => fileInputRef.current?.click(), 0);
      return;
    }
    if (before >= 0 && val.substring(before, cursorPos) === '/atr' && (before === 0 || /\s/.test(val[before - 1]))) {
      setInputValue(val.substring(0, before) + val.substring(cursorPos));
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
          setAttachments(prev => [...prev, att]);
        })
        .catch(err => console.error('[/atr] failed to fetch recent desktop image:', err));
      return;
    }
    setInputValue(val);
    handleDraftChange(val);
  }, [handleDraftChange]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [inputValue]);

  // All blocks combined for rendering
  const allBlocks = useMemo(() => [...historyBlocks, ...streamBlocks], [historyBlocks, streamBlocks]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScrollRef.current || !containerRef.current) return;
    const el = containerRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [allBlocks]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  }, []);

  // Memoize rendered blocks
  const renderedBlocks = useMemo(() => {
    // Find the last text block before a result block — never collapse it
    let lastTextBeforeResult: string | null = null;
    for (let i = allBlocks.length - 1; i >= 0; i--) {
      if (allBlocks[i].type === 'result') {
        for (let j = i - 1; j >= 0; j--) {
          if (allBlocks[j].type === 'text') { lastTextBeforeResult = allBlocks[j].id; break; }
          if (allBlocks[j].type === 'tool' || allBlocks[j].type === 'user-message') break;
        }
        break;
      }
    }

    return allBlocks.map((block) => {
      // For history tool blocks that only have a summary (no full input), use simplified rendering
      if (block.type === 'tool' && block.toolInput && '_summary' in block.toolInput) {
        return (
          <SimpleToolBlock
            key={block.id}
            action={block.toolName || ''}
            detail={block.toolInput._summary as string}
            collapseSignal={collapseSignal}
          />
        );
      }
      switch (block.type) {
        case 'text': return <TextBlock key={block.id} block={block} collapseSignal={collapseSignal} neverCollapse={block.id === lastTextBeforeResult} />;
        case 'tool': return <ToolBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'thinking': return <ThinkingBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'result': return <ResultBlock key={block.id} block={block} />;
        case 'user-message': return <UserMessageBlock key={block.id} block={block} />;
        default: return null;
      }
    });
  }, [allBlocks, collapseSignal]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex flex-col bg-surface-base">
      {/* Top bar with collapse/expand + clear */}
      {allBlocks.length > 0 && (
        <div className="absolute top-2 right-3 z-10 flex items-center gap-2">
          <button
            onClick={() => setCollapseSignal(prev => prev > 0 ? -Math.abs(prev) - 1 : Math.abs(prev) + 1)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-text-chrome hover:text-text-chrome-active bg-surface-primary/80 hover:bg-surface-hover/80 border border-border-default backdrop-blur-sm transition-colors"
            title={isCollapsed ? 'Expand all' : 'Collapse all'}
          >
            {isCollapsed ? (
              <><ChevronsUpDownIcon className="w-3 h-3" /> Expand</>
            ) : (
              <><ChevronsDownUpIcon className="w-3 h-3" /> Collapse</>
            )}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-text-chrome hover:text-text-chrome-active bg-surface-primary/80 hover:bg-surface-hover/80 border border-border-default backdrop-blur-sm transition-colors"
            title="Clear chat history"
          >
            <Trash2Icon className="w-3 h-3" />
            Clear
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
      >
        {allBlocks.length === 0 && !isStreaming && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-text-chrome">Send a message to get started</span>
          </div>
        )}
        <div>
          {renderedBlocks}
        </div>
        {/* Processing indicator */}
        {isStreaming && (() => {
          const lastBlock = allBlocks[allBlocks.length - 1];
          if (lastBlock?.type === 'user-message' || allBlocks.length === 0 || (streamBlocks.length === 0 && isLoading)) {
            return (
              <div className="py-3 pl-5">
                <ScrambleText text="Thinking..." />
              </div>
            );
          }
          if (lastBlock?.status === 'complete' && lastBlock?.type !== 'result') {
            return (
              <div className="py-3 pl-5">
                <ScrambleText text="Working..." />
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border-default bg-surface-base px-4 py-3">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att) => {
              const isImage = att.type?.startsWith('image/') || false;
              return isImage && att.dataUrl ? (
                <div key={att.id} className="relative group rounded-md overflow-hidden border border-border-default bg-surface-primary">
                  <img src={att.dataUrl} alt={att.name} className="h-16 w-auto max-w-[100px] object-cover block" />
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white/80 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                    <span className="text-[9px] text-zinc-300 truncate block">{att.name}</span>
                  </div>
                </div>
              ) : (
                <div key={att.id} className="flex items-center gap-1.5 bg-surface-primary border border-border-default rounded-md px-2 py-1.5 group">
                  <FileIcon className="w-3 h-3 text-text-chrome shrink-0" />
                  <span className="text-[11px] text-text-secondary truncate max-w-[100px]">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-text-chrome hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData.items);
              const imageItems = items.filter(item => item.type.startsWith('image/'));
              if (imageItems.length > 0) {
                e.preventDefault();
                const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[];
                addFiles(files);
              }
            }}
            placeholder={isLoading ? `Queue message... (${queueLength} queued)` : "Message supervisor... (/att to attach, /atr for screenshot)"}
            rows={1}
            className="flex-1 bg-surface-primary border border-border-default rounded-md px-3 py-2 text-sm text-bronze-800 dark:text-zinc-200 placeholder-text-chrome focus:outline-none focus:border-steel/50 resize-none"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Attach file (/att)"
            className="shrink-0 px-2 py-2 rounded-md text-text-chrome hover:text-text-secondary hover:bg-surface-primary transition-colors"
          >
            <PaperclipIcon className="w-4 h-4" />
          </button>
          {isLoading && (
            <button
              onClick={handleStop}
              title="Stop"
              className="shrink-0 px-2 py-2 rounded-md text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <SquareIcon className="w-4 h-4 fill-current" />
            </button>
          )}
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() && attachments.length === 0}
            className="shrink-0 px-3 py-2 rounded-md bg-steel/20 text-steel hover:bg-steel/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <SendIcon className="w-4 h-4" />
          </button>
        </div>
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
  );
}
