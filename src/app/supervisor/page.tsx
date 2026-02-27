'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  SquareChevronUpIcon,
  Trash2Icon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  SendIcon,
  PaperclipIcon,
  SquareIcon,
  XIcon,
  FileIcon,
} from 'lucide-react';
import type { ChatLogEntry, TaskAttachment } from '@/lib/types';
import {
  type RenderBlock,
  type ContentBlock,
  normalizeToolResult,
  TextBlock,
  ToolBlock,
  ThinkingBlock,
  UserMessageBlock,
  SimpleToolBlock,
  ContextWindowIndicator,
} from '@/components/AgentBlocks';
import { ScrambleText } from '@/components/ScrambleText';

export default function SupervisorPage() {
  const [historyBlocks, setHistoryBlocks] = useState<RenderBlock[]>([]);
  const [streamBlocks, setStreamBlocks] = useState<RenderBlock[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [contextTokens, setContextTokens] = useState(0);
  const [collapseSignal, setCollapseSignal] = useState(1);
  const isCollapsed = collapseSignal > 0;
  const abortRef = useRef<AbortController | null>(null);
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoScrollRef = useRef(true);
  const blockIdCounter = useRef(0);
  const toolBlockMap = useRef<Map<string, string>>(new Map());

  const nextBlockId = useCallback(() => {
    blockIdCounter.current += 1;
    return `sv-block-${blockIdCounter.current}`;
  }, []);

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

  // Load history + draft on mount
  useEffect(() => {
    fetch('/api/supervisor')
      .then((res) => res.json())
      .then((data) => {
        if (data.chatLog) setHistoryBlocks(convertHistoryToBlocks(data.chatLog));
        if (data.draft) setInputValue(data.draft);
      })
      .catch(console.error);
  }, [convertHistoryToBlocks]);

  const handleDraftChange = useCallback((value: string) => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      fetch('/api/supervisor', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft: value }),
      }).catch(console.error);
    }, 500);
  }, []);

  const handleStop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const processStreamEvent = useCallback((event: Record<string, unknown>) => {
    const eventType = event.type as string;

    if (eventType === 'assistant' && event.message) {
      const msg = event.message as { content?: ContentBlock[]; usage?: { input_tokens?: number } };
      // Track context window usage
      if (msg.usage?.input_tokens) {
        setContextTokens(msg.usage.input_tokens);
      }
      if (!msg.content) return;

      const newBlocks: RenderBlock[] = [];
      for (const block of msg.content) {
        if (block.type === 'text' && block.text) {
          newBlocks.push({ id: nextBlockId(), type: 'text', text: block.text, status: 'complete' });
        } else if (block.type === 'thinking' && block.thinking) {
          newBlocks.push({ id: nextBlockId(), type: 'thinking', thinking: block.thinking, status: 'complete' });
        } else if (block.type === 'tool_use' && block.name && block.id) {
          const blockId = nextBlockId();
          toolBlockMap.current.set(block.id, blockId);
          newBlocks.push({
            id: blockId, type: 'tool', toolName: block.name,
            toolInput: (block.input as Record<string, unknown>) || {},
            toolUseId: block.id, status: 'active',
          });
        }
      }
      if (newBlocks.length > 0) setStreamBlocks(prev => [...prev, ...newBlocks]);
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
            setStreamBlocks(prev => prev.map(b =>
              b.id === blockId ? { ...b, toolResult: resultStr, toolError: isError, status: 'complete' as const } : b
            ));
          }
        }
      }
    }

    // Skip 'result' events — supervisor chats are ongoing streams, not discrete tasks
  }, [nextBlockId]);

  const addFiles = useCallback((files: FileList | File[]) => {
    Array.from(files).forEach((f) => {
      const att: TaskAttachment = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: f.name, size: f.size, type: f.type,
      };
      if (f.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => { att.dataUrl = e.target?.result as string; setAttachments(prev => [...prev, att]); };
        reader.readAsDataURL(f);
      } else {
        setAttachments(prev => [...prev, att]);
      }
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  }, []);

  const handleSendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text && attachments.length === 0) return;
    if (isLoading) return;

    const atts = attachments.length > 0 ? [...attachments] : undefined;
    const imageUrls = (atts || []).filter(a => a.type?.startsWith('image/') && a.dataUrl).map(a => a.dataUrl!);

    setHistoryBlocks(prev => [...prev, ...streamBlocks]);
    setStreamBlocks([]);
    toolBlockMap.current.clear();

    setHistoryBlocks(prev => [...prev, {
      id: nextBlockId(), type: 'user-message', userMessage: text,
      userImages: imageUrls.length > 0 ? imageUrls : undefined, status: 'complete',
    }]);

    setInputValue('');
    setAttachments([]);
    setIsLoading(true);
    setIsStreaming(true);

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    handleDraftChange('');

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const payload: Record<string, unknown> = { message: text };
      if (atts && atts.length > 0) payload.attachments = atts;

      const res = await fetch('/api/supervisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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
              setStreamBlocks(prev => [...prev, { id: nextBlockId(), type: 'text', text: `Error: ${event.error}`, status: 'complete' }]);
              continue;
            }
            processStreamEvent(event);
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setStreamBlocks(prev => [...prev, { id: nextBlockId(), type: 'text', text: `Error: ${err}`, status: 'complete' }]);
      }
    } finally {
      setIsStreaming(false);
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [inputValue, attachments, isLoading, streamBlocks, nextBlockId, processStreamEvent, handleDraftChange]);

  const handleClear = useCallback(async () => {
    await fetch('/api/supervisor', { method: 'DELETE' });
    setHistoryBlocks([]);
    setStreamBlocks([]);
    blockIdCounter.current = 0;
    toolBlockMap.current.clear();
  }, []);

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
          setAttachments(prev => [...prev, {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: img.name, size: img.size, type: img.type, dataUrl: img.dataUrl,
          }]);
        })
        .catch(err => console.error('[/atr] failed:', err));
      return;
    }
    setInputValue(val);
    handleDraftChange(val);
  }, [handleDraftChange]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [inputValue]);

  const allBlocks = useMemo(() => [...historyBlocks, ...streamBlocks], [historyBlocks, streamBlocks]);

  useEffect(() => {
    if (!autoScrollRef.current || !containerRef.current) return;
    requestAnimationFrame(() => { containerRef.current!.scrollTop = containerRef.current!.scrollHeight; });
  }, [allBlocks]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    autoScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }, []);

  const renderedBlocks = useMemo(() => {
    return allBlocks.map((block) => {
      if (block.type === 'tool' && block.toolInput && '_summary' in block.toolInput) {
        return <SimpleToolBlock key={block.id} action={block.toolName || ''} detail={block.toolInput._summary as string} collapseSignal={collapseSignal} />;
      }
      switch (block.type) {
        case 'text': return <TextBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'tool': return <ToolBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'thinking': return <ThinkingBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'result': return null; // Supervisor chats are ongoing — skip result blocks
        case 'user-message': return <UserMessageBlock key={block.id} block={block} />;
        default: return null;
      }
    });
  }, [allBlocks, collapseSignal]);

  return (
    <>
      <header className="h-16 bg-bronze-50 dark:bg-zinc-950 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <SquareChevronUpIcon className="w-5 h-5 text-bronze-500" />
          <h1 className="text-lg font-semibold text-bronze-900 dark:text-zinc-100 leading-tight">Supervisor</h1>
        </div>
        <div className="flex items-center gap-2">
          {allBlocks.length > 0 && (
            <>
              <button
                onClick={() => setCollapseSignal(prev => prev > 0 ? -Math.abs(prev) - 1 : Math.abs(prev) + 1)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                title={isCollapsed ? 'Expand all' : 'Collapse all'}
              >
                {isCollapsed ? <ChevronsUpDownIcon className="w-3.5 h-3.5" /> : <ChevronsDownUpIcon className="w-3.5 h-3.5" />}
                {isCollapsed ? 'Expand' : 'Collapse'}
              </button>
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Clear chat history"
              >
                <Trash2Icon className="w-3.5 h-3.5" />
                Clear
              </button>
            </>
          )}
        </div>
      </header>
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col bg-surface-base">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
          >
            {allBlocks.length === 0 && !isStreaming && (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm text-text-chrome">Send a message to get started</span>
              </div>
            )}
            <div className="max-w-4xl">
              {renderedBlocks}
            </div>
            {isStreaming && (() => {
              const lastBlock = allBlocks[allBlocks.length - 1];
              if (lastBlock?.type === 'user-message' || allBlocks.length === 0 || (streamBlocks.length === 0 && isLoading)) {
                return <div className="max-w-4xl py-3 pl-5"><ScrambleText text="Thinking..." /></div>;
              }
              if (lastBlock?.status === 'complete' && lastBlock?.type !== 'result') {
                return <div className="max-w-4xl py-3 pl-5"><ScrambleText text="Working..." /></div>;
              }
              return null;
            })()}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border-default bg-surface-base px-6 py-4">
            {attachments.length > 0 && (
              <div className="max-w-4xl flex flex-wrap gap-2 mb-2">
                {attachments.map((att) => {
                  const isImage = att.type?.startsWith('image/') || false;
                  return isImage && att.dataUrl ? (
                    <div key={att.id} className="relative group rounded-md overflow-hidden border border-border-default bg-surface-primary">
                      <img src={att.dataUrl} alt={att.name} className="h-16 w-auto max-w-[100px] object-cover block" />
                      <button onClick={() => removeAttachment(att.id)} className="absolute top-0.5 right-0.5 p-0.5 rounded bg-black/60 text-white/80 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
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
                      <button onClick={() => removeAttachment(att.id)} className="text-text-chrome hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                        <XIcon className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="max-w-4xl flex gap-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder={isLoading ? "Waiting for response..." : "Message supervisor... (/att to attach, /atr for screenshot)"}
                rows={1}
                className="flex-1 bg-surface-primary border border-border-default rounded-md px-3 py-2 text-sm text-bronze-800 dark:text-zinc-200 placeholder-text-chrome focus:outline-none focus:border-steel/50 resize-none"
              />
              <button onClick={() => fileInputRef.current?.click()} title="Attach file (/att)" className="shrink-0 px-2 py-2 rounded-md text-text-chrome hover:text-text-secondary hover:bg-surface-primary transition-colors">
                <PaperclipIcon className="w-4 h-4" />
              </button>
              {contextTokens > 0 && (
                <ContextWindowIndicator tokens={contextTokens} />
              )}
              {isLoading && (
                <button onClick={handleStop} title="Stop" className="shrink-0 px-2 py-2 rounded-md text-red-400 hover:bg-red-400/10 transition-colors">
                  <SquareIcon className="w-4 h-4 fill-current" />
                </button>
              )}
              <button
                onClick={handleSendMessage}
                disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
                className="shrink-0 px-3 py-2 rounded-md bg-steel/20 text-steel hover:bg-steel/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <SendIcon className="w-4 h-4" />
              </button>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files && e.target.files.length > 0) { addFiles(e.target.files); e.target.value = ''; } }} />
          </div>
        </div>
      </main>
    </>
  );
}
