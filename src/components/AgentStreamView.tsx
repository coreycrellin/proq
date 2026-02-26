'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  Loader2Icon,
  TerminalIcon,
  FileTextIcon,
  SearchIcon,
  FolderIcon,
  PenIcon,
  FileIcon,
  GlobeIcon,
  BrainIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  CopyIcon,
  CheckIcon,
  LayersIcon,
  SendIcon,
  UserIcon,
} from 'lucide-react';

/* ─── Types for stream-json events ─── */

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}

interface StreamMessage {
  type: 'system' | 'assistant' | 'user' | 'result';
  subtype?: string;
  message?: {
    role?: string;
    content?: ContentBlock[];
    model?: string;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  session_id?: string;
  // result fields
  cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  result?: string;
  is_error?: boolean;
}

/* ─── Render block model ─── */

interface RenderBlock {
  id: string;
  type: 'text' | 'tool' | 'thinking' | 'result' | 'user-message';
  // text
  text?: string;
  // tool
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
  toolResult?: string;
  toolError?: boolean;
  // thinking
  thinking?: string;
  // result
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  resultText?: string;
  isError?: boolean;
  // user-message
  userMessage?: string;
  // status
  status: 'active' | 'complete';
}

/* ─── Tool display helpers ─── */

function getToolIcon(name: string) {
  switch (name) {
    case 'Bash': return TerminalIcon;
    case 'Read': return FileTextIcon;
    case 'Write': return FileIcon;
    case 'Edit': return PenIcon;
    case 'Grep': return SearchIcon;
    case 'Glob': return FolderIcon;
    case 'WebFetch':
    case 'WebSearch': return GlobeIcon;
    case 'Task': return LayersIcon;
    default: return TerminalIcon;
  }
}

function getToolDescription(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Bash':
      return (input.description as string) || truncate(input.command as string, 80) || 'Run command';
    case 'Read':
      return truncate(input.file_path as string, 80) || 'Read file';
    case 'Write':
      return truncate(input.file_path as string, 80) || 'Write file';
    case 'Edit':
      return truncate(input.file_path as string, 80) || 'Edit file';
    case 'Grep':
      return `"${truncate(input.pattern as string, 40)}"${input.path ? ` in ${truncate(input.path as string, 40)}` : ''}`;
    case 'Glob':
      return truncate(input.pattern as string, 60) || 'Find files';
    case 'WebFetch':
      return truncate(input.url as string, 80) || 'Fetch URL';
    case 'WebSearch':
      return `"${truncate(input.query as string, 60)}"`;
    case 'Task':
      return truncate(input.description as string, 60) || truncate(input.prompt as string, 60) || 'Run sub-agent';
    case 'NotebookEdit':
      return truncate(input.notebook_path as string, 60) || 'Edit notebook';
    default:
      return name;
  }
}

function getToolInputDisplay(name: string, input: Record<string, unknown>): string | null {
  switch (name) {
    case 'Bash':
      return (input.command as string) || null;
    case 'Read':
      return (input.file_path as string) || null;
    case 'Write':
      return (input.file_path as string) || null;
    case 'Edit': {
      const fp = input.file_path as string;
      const old = input.old_string as string;
      const nw = input.new_string as string;
      if (!old && !nw) return fp || null;
      const lines: string[] = [];
      if (fp) lines.push(fp);
      if (old) lines.push(`- ${truncateLines(old, 8)}`);
      if (nw) lines.push(`+ ${truncateLines(nw, 8)}`);
      return lines.join('\n');
    }
    case 'Grep':
      return `pattern: ${input.pattern || ''}${input.path ? `\npath: ${input.path}` : ''}${input.glob ? `\nglob: ${input.glob}` : ''}`;
    case 'Glob':
      return `pattern: ${input.pattern || ''}${input.path ? `\npath: ${input.path}` : ''}`;
    case 'Task':
      return truncateLines(input.prompt as string, 5) || null;
    default:
      return null;
  }
}

function truncate(str: string | undefined | null, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function truncateLines(str: string | undefined | null, maxLines: number): string {
  if (!str) return '';
  const lines = str.split('\n');
  if (lines.length <= maxLines) return str;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
}

function normalizeToolResult(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block: ContentBlock) => {
        if (block.type === 'text') return block.text || '';
        return JSON.stringify(block);
      })
      .join('\n');
  }
  return content ? JSON.stringify(content) : '';
}

/* ─── Inline text rendering with basic formatting ─── */

function renderFormattedText(text: string) {
  // Split by lines, then process inline formatting
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Process inline formatting
    const parts = processInlineFormatting(line);
    return (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {parts}
      </React.Fragment>
    );
  });
}

function processInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match **bold**, `code`, and regular text
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      // Bold
      parts.push(<strong key={match.index} className="font-semibold text-zinc-200">{match[2]}</strong>);
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-zinc-800 text-amber-300/80 text-[11px] font-mono">
          {match[3]}
        </code>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ─── Collapsible output block ─── */

function CollapsibleOutput({
  label,
  content,
  defaultOpen = true,
  maxLines = 30,
  isError = false,
}: {
  label: string;
  content: string;
  defaultOpen?: boolean;
  maxLines?: number;
  isError?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const lines = content.split('\n');
  const truncated = lines.length > maxLines;
  const displayContent = truncated ? lines.slice(0, maxLines).join('\n') : content;

  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-400 transition-colors uppercase tracking-wider"
        >
          {open ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
          {label}
        </button>
        {open && (
          <button
            onClick={() => {
              navigator.clipboard.writeText(content);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="ml-auto text-zinc-600 hover:text-zinc-400 transition-colors p-0.5"
          >
            {copied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <CopyIcon className="w-3 h-3" />}
          </button>
        )}
      </div>
      {open && (
        <pre className={`mt-1 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all ${isError ? 'text-red-400/80' : 'text-zinc-400'}`}>
          {displayContent}
          {truncated && (
            <span className="text-zinc-600 italic">{`\n... ${lines.length - maxLines} more lines`}</span>
          )}
        </pre>
      )}
    </div>
  );
}

/* ─── Individual block renderers ─── */

function TextBlock({ block, collapseSignal }: { block: RenderBlock; collapseSignal: number }) {
  const [collapsed, setCollapsed] = useState(collapseSignal > 0);
  const text = block.text || '';
  const lineCount = text.split('\n').length;
  const isLong = lineCount > 8;

  // Sync with global collapse toggle
  useEffect(() => {
    if (collapseSignal > 0 && isLong) setCollapsed(true);
    else if (collapseSignal < 0) setCollapsed(false);
  }, [collapseSignal, isLong]);

  return (
    <div className="flex gap-3 py-2.5">
      <div className="shrink-0 mt-1.5">
        <div className={`w-2 h-2 rounded-full ${block.status === 'active' ? 'bg-blue-400 animate-pulse' : 'bg-emerald-400'}`} />
      </div>
      <div className="min-w-0 flex-1">
        {isLong && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors mb-1 flex items-center gap-1"
          >
            {collapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
            {collapsed ? 'Show more' : 'Collapse'}
          </button>
        )}
        <div className="text-[13px] text-zinc-300 leading-relaxed">
          {collapsed
            ? renderFormattedText(text.split('\n').slice(0, 3).join('\n') + '...')
            : renderFormattedText(text)
          }
        </div>
      </div>
    </div>
  );
}

function ToolBlock({ block, collapseSignal }: { block: RenderBlock; collapseSignal: number }) {
  const [collapsed, setCollapsed] = useState(collapseSignal > 0);

  // Sync with global collapse toggle
  useEffect(() => {
    if (collapseSignal > 0) setCollapsed(true);
    else if (collapseSignal < 0) setCollapsed(false);
  }, [collapseSignal]);
  const Icon = getToolIcon(block.toolName || '');
  const description = getToolDescription(block.toolName || '', block.toolInput || {});
  const inputDisplay = getToolInputDisplay(block.toolName || '', block.toolInput || {});
  const hasResult = block.toolResult !== undefined;
  const isActive = block.status === 'active' && !hasResult;

  return (
    <div className="flex gap-3 py-2.5">
      <div className="shrink-0 mt-1">
        {isActive ? (
          <Loader2Icon className="w-3.5 h-3.5 text-blue-400 animate-spin" />
        ) : block.toolError ? (
          <AlertCircleIcon className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <div className="w-3.5 h-3.5 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {/* Tool header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 group w-full text-left"
        >
          <Icon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="text-[13px] font-semibold text-zinc-200">{block.toolName}</span>
          <span className="text-[12px] text-zinc-500 truncate">{description}</span>
          <span className="ml-auto shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors">
            {collapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
          </span>
        </button>

        {/* Tool details (collapsible) */}
        {!collapsed && (
          <div className="mt-2 rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            {inputDisplay && (
              <div className="px-3 py-2 border-b border-zinc-800/60">
                <span className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider mr-2">IN</span>
                <pre className="mt-1 text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">
                  {inputDisplay}
                </pre>
              </div>
            )}
            {hasResult && (
              <div className="px-3 py-2">
                <CollapsibleOutput
                  label="OUT"
                  content={block.toolResult || ''}
                  defaultOpen={true}
                  maxLines={25}
                  isError={block.toolError}
                />
              </div>
            )}
            {isActive && (
              <div className="px-3 py-2 flex items-center gap-2">
                <Loader2Icon className="w-3 h-3 text-blue-400 animate-spin" />
                <span className="text-[11px] text-blue-400/80">Running...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBlock({ block, collapseSignal }: { block: RenderBlock; collapseSignal: number }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = block.status === 'active';

  // Sync with global collapse toggle
  useEffect(() => {
    if (collapseSignal > 0) setExpanded(false);
    else if (collapseSignal < 0) setExpanded(true);
  }, [collapseSignal]);

  return (
    <div className="flex gap-3 py-2">
      <div className="shrink-0 mt-1">
        {isActive ? (
          <Loader2Icon className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
        ) : (
          <BrainIcon className="w-3.5 h-3.5 text-zinc-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          {expanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
          <span className="italic">{isActive ? 'Thinking...' : 'Thinking'}</span>
        </button>
        {expanded && block.thinking && (
          <pre className="mt-1.5 text-[11px] font-mono text-zinc-600 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {block.thinking}
          </pre>
        )}
      </div>
    </div>
  );
}

function ResultBlock({ block }: { block: RenderBlock }) {
  const duration = block.durationMs ? `${(block.durationMs / 1000).toFixed(1)}s` : null;
  const cost = block.costUsd ? `$${block.costUsd.toFixed(4)}` : null;

  return (
    <div className="flex gap-3 py-2.5 border-t border-zinc-800/50 mt-1">
      <div className="shrink-0 mt-1">
        {block.isError ? (
          <AlertCircleIcon className="w-3.5 h-3.5 text-red-400" />
        ) : (
          <CheckCircle2Icon className="w-3.5 h-3.5 text-emerald-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className={`text-[12px] font-medium ${block.isError ? 'text-red-400' : 'text-emerald-400'}`}>
          {block.isError ? 'Failed' : 'Complete'}
        </span>
        <div className="flex items-center gap-3 mt-0.5">
          {duration && <span className="text-[11px] text-zinc-600">{duration}</span>}
          {block.numTurns != null && <span className="text-[11px] text-zinc-600">{block.numTurns} turns</span>}
          {cost && <span className="text-[11px] text-zinc-600">{cost}</span>}
        </div>
      </div>
    </div>
  );
}

function UserMessageBlock({ block }: { block: RenderBlock }) {
  return (
    <div className="flex gap-3 py-2.5 border-t border-zinc-800/50 mt-1">
      <div className="shrink-0 mt-1">
        <UserIcon className="w-3.5 h-3.5 text-steel" />
      </div>
      <div className="text-[13px] text-zinc-200 leading-relaxed">
        {renderFormattedText(block.userMessage || '')}
      </div>
    </div>
  );
}

/* ─── Main component ─── */

interface AgentStreamViewProps {
  tabId: string;
  visible: boolean;
  /** If provided, render static JSON lines instead of connecting to WebSocket */
  staticData?: string;
  /** 'pretty' renders parsed blocks (default), 'raw' shows raw text */
  mode?: 'pretty' | 'raw';
  /** Called when user sends a follow-up message after agent exits */
  onSendFollowUp?: (message: string) => Promise<void>;
}

export function AgentStreamView({ tabId, visible, staticData, mode = 'pretty', onSendFollowUp }: AgentStreamViewProps) {
  const [blocks, setBlocks] = useState<RenderBlock[]>([]);
  const [rawText, setRawText] = useState('');
  const [connected, setConnected] = useState(false);
  const [exited, setExited] = useState(false);
  const [followUpInput, setFollowUpInput] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  // Collapse signal: positive = collapse all, negative = expand all, 0 = initial (auto-collapsed)
  // Default is 1 so blocks start collapsed (auto-collapse)
  const [collapseSignal, setCollapseSignal] = useState(1);
  const isCollapsed = collapseSignal > 0;
  const containerRef = useRef<HTMLDivElement>(null);
  const rawContainerRef = useRef<HTMLDivElement>(null);
  const followUpRef = useRef<HTMLTextAreaElement>(null);
  const bufferRef = useRef('');
  const blockIdCounter = useRef(0);
  const toolBlockMap = useRef<Map<string, string>>(new Map()); // toolUseId → blockId
  const autoScrollRef = useRef(true);
  const rawAutoScrollRef = useRef(true);
  const gotValidEventRef = useRef(false);

  const nextBlockId = useCallback(() => {
    blockIdCounter.current += 1;
    return `block-${blockIdCounter.current}`;
  }, []);

  const handleSendFollowUp = useCallback(async () => {
    if (!followUpInput.trim() || !onSendFollowUp || sendingFollowUp) return;
    const msg = followUpInput.trim();
    setFollowUpInput('');
    setSendingFollowUp(true);

    // Add user message block
    setBlocks(prev => [...prev, {
      id: nextBlockId(),
      type: 'user-message',
      userMessage: msg,
      status: 'complete',
    }]);

    // Reset exited so we show loading for the follow-up
    setExited(false);

    try {
      await onSendFollowUp(msg);
    } catch (err) {
      console.error('[AgentStreamView] follow-up failed:', err);
    } finally {
      setSendingFollowUp(false);
    }
  }, [followUpInput, onSendFollowUp, sendingFollowUp, nextBlockId]);

  // Process a single stream-json event
  const processEvent = useCallback((event: StreamMessage) => {
    if (event.type === 'system') {
      // System init — we could show model info but let's keep it clean
      return;
    }

    if (event.type === 'assistant' && event.message?.content) {
      const content = event.message.content;
      const newBlocks: RenderBlock[] = [];

      for (const block of content) {
        if (block.type === 'text' && block.text) {
          newBlocks.push({
            id: nextBlockId(),
            type: 'text',
            text: block.text,
            status: event.message.stop_reason === 'end_turn' ? 'complete' : 'complete',
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
        setBlocks(prev => [...prev, ...newBlocks]);
      }
    }

    if (event.type === 'user' && event.message?.content) {
      const content = event.message.content;
      for (const block of content) {
        if (block.type === 'tool_result' && block.tool_use_id) {
          const blockId = toolBlockMap.current.get(block.tool_use_id);
          if (blockId) {
            const resultStr = normalizeToolResult(block.content);
            const isError = block.is_error === true;
            setBlocks(prev => prev.map(b =>
              b.id === blockId
                ? { ...b, toolResult: resultStr, toolError: isError, status: 'complete' }
                : b
            ));
          }
        }
      }
    }

    if (event.type === 'result') {
      setBlocks(prev => [...prev, {
        id: nextBlockId(),
        type: 'result',
        resultText: event.result || '',
        costUsd: event.cost_usd,
        durationMs: event.duration_ms,
        numTurns: event.num_turns,
        isError: event.is_error,
        status: 'complete',
      }]);
    }
  }, [nextBlockId]);

  // Process raw data buffer into events
  const processBuffer = useCallback((data: string) => {
    setRawText(prev => prev + data);
    bufferRef.current += data;

    // Split by newlines and process complete lines
    const lines = bufferRef.current.split('\n');
    // Keep the last (potentially incomplete) line in the buffer
    bufferRef.current = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed) as StreamMessage;
        gotValidEventRef.current = true;

        // Handle bridge exit event
        if ((event as unknown as { type: string; code?: number }).type === 'exit') {
          setExited(true);
          continue;
        }

        processEvent(event);
      } catch {
        // Not valid JSON — ignore (could be stderr noise)
      }
    }
  }, [processEvent]);

  // Static data mode
  useEffect(() => {
    if (!staticData) return;
    // Reset state
    setBlocks([]);
    blockIdCounter.current = 0;
    toolBlockMap.current.clear();
    bufferRef.current = '';
    setExited(true);
    processBuffer(staticData + '\n');
  }, [staticData, processBuffer]);

  // WebSocket connection (live mode) with auto-reconnect
  useEffect(() => {
    if (staticData) return; // Skip WS in static mode

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    const MAX_RETRIES = 12; // ~30s total with backoff

    function connect() {
      if (cancelled) return;

      const wsUrl = `ws://${window.location.hostname}:42069/ws/terminal?id=${encodeURIComponent(tabId)}`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setConnected(true);
        ws!.send(JSON.stringify({ type: 'resize', cols: 200, rows: 50 }));
      };

      ws.onmessage = (event) => {
        attempt = 0; // reset retries on successful data
        processBuffer(event.data);
      };

      ws.onclose = () => {
        setConnected(false);
        if (cancelled) return;

        // If we never got a valid JSON event and haven't exhausted retries, reconnect
        // (bridge socket may not be ready yet, or pty-server sent an ANSI error and closed)
        if (!gotValidEventRef.current && attempt < MAX_RETRIES) {
          attempt++;
          const delay = Math.min(1000 + attempt * 500, 5000);
          reconnectTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    };
  }, [tabId, staticData, processBuffer]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!autoScrollRef.current || !containerRef.current) return;
    const el = containerRef.current;
    // Use requestAnimationFrame to ensure DOM has updated
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [blocks]);

  // Auto-scroll raw view
  useEffect(() => {
    if (mode !== 'raw' || !rawAutoScrollRef.current || !rawContainerRef.current) return;
    const el = rawContainerRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [rawText, mode]);

  // Track scroll position for auto-scroll behavior
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    autoScrollRef.current = atBottom;
  }, []);

  const handleRawScroll = useCallback(() => {
    const el = rawContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    rawAutoScrollRef.current = atBottom;
  }, []);

  // Memoize the rendered blocks to avoid re-rendering unchanged blocks
  const renderedBlocks = useMemo(() => {
    return blocks.map((block) => {
      switch (block.type) {
        case 'text': return <TextBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'tool': return <ToolBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'thinking': return <ThinkingBlock key={block.id} block={block} collapseSignal={collapseSignal} />;
        case 'result': return <ResultBlock key={block.id} block={block} />;
        case 'user-message': return <UserMessageBlock key={block.id} block={block} />;
        default: return null;
      }
    });
  }, [blocks, collapseSignal]);

  if (!visible) return null;

  if (mode === 'raw') {
    const hasData = rawText.length > 0;
    return (
      <div
        ref={rawContainerRef}
        onScroll={handleRawScroll}
        className="absolute inset-0 overflow-y-auto bg-black p-4"
      >
        {!hasData && !exited && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2.5">
              <Loader2Icon className="w-4 h-4 text-zinc-600 animate-spin" />
              <span className="text-sm text-zinc-600">
                {connected ? 'Waiting for agent output...' : 'Connecting...'}
              </span>
            </div>
          </div>
        )}
        {!hasData && exited && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-zinc-600">No output captured</span>
          </div>
        )}
        {hasData && (
          <pre className="text-[12px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed break-all">
            {rawText}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0A0A0A]">
      {/* Collapse-all toggle */}
      {blocks.length > 0 && (
        <div className="absolute top-2 right-5 z-10">
          <button
            onClick={() => setCollapseSignal(prev => prev > 0 ? -Math.abs(prev) - 1 : Math.abs(prev) + 1)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] text-zinc-500 hover:text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 backdrop-blur-sm transition-colors"
            title={isCollapsed ? 'Expand all' : 'Collapse all'}
          >
            {isCollapsed ? (
              <><ChevronsUpDownIcon className="w-3 h-3" /> Expand</>
            ) : (
              <><ChevronsDownUpIcon className="w-3 h-3" /> Collapse</>
            )}
          </button>
        </div>
      )}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
      >
        {blocks.length === 0 && !exited && (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2.5">
              <Loader2Icon className="w-4 h-4 text-zinc-600 animate-spin" />
              <span className="text-sm text-zinc-600">
                {connected ? 'Waiting for agent output...' : 'Connecting...'}
              </span>
            </div>
          </div>
        )}
        {blocks.length === 0 && exited && (
          <div className="flex items-center justify-center h-full">
            <span className="text-sm text-zinc-600">No output captured</span>
          </div>
        )}
        <div className="max-w-4xl">
          {renderedBlocks}
        </div>
        {/* Processing indicator — shows agent is still alive */}
        {blocks.length > 0 && !exited && (() => {
          const lastBlock = blocks[blocks.length - 1];
          // After a follow-up message, show "thinking"
          if (lastBlock?.type === 'user-message') {
            return (
              <div className="max-w-4xl flex items-center gap-2 py-3 pl-5">
                <Loader2Icon className="w-3.5 h-3.5 text-zinc-600 animate-spin" />
                <span className="text-xs text-zinc-600">Agent thinking...</span>
              </div>
            );
          }
          // For all other cases where the last block is complete, show a subtle "still working" indicator
          if (lastBlock?.status === 'complete') {
            return (
              <div className="max-w-4xl flex items-center gap-1.5 py-3 pl-5">
                <span className="flex items-center gap-[3px]">
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }} />
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }} />
                  <span className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.2s' }} />
                </span>
              </div>
            );
          }
          return null;
        })()}
      </div>
      {/* Follow-up input — shown whenever callback is available (even mid-stream) */}
      {onSendFollowUp && !staticData && (
        <div className="shrink-0 border-t border-zinc-800 bg-[#0A0A0A] px-4 py-3">
          <div className="max-w-4xl flex gap-2">
            <textarea
              ref={followUpRef}
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendFollowUp();
                }
              }}
              placeholder={exited ? "Reply to the agent..." : "Send a message..."}
              rows={1}
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-steel/50 resize-none"
            />
            <button
              onClick={handleSendFollowUp}
              disabled={!followUpInput.trim() || sendingFollowUp}
              className="shrink-0 px-3 py-2 rounded-md bg-steel/20 text-steel hover:bg-steel/30 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              <SendIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
