'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRightIcon,
  ChevronDownIcon,
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
  UserIcon,
  WrenchIcon,
  HelpCircleIcon,
} from 'lucide-react';

/* ─── Types for stream-json events ─── */

export interface ContentBlock {
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

export interface StreamMessage {
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
  cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
  num_turns?: number;
  result?: string;
  is_error?: boolean;
}

/* ─── Render block model ─── */

export interface RenderBlock {
  id: string;
  type: 'text' | 'tool' | 'thinking' | 'result' | 'user-message';
  text?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolUseId?: string;
  toolResult?: string;
  toolError?: boolean;
  thinking?: string;
  costUsd?: number;
  durationMs?: number;
  numTurns?: number;
  resultText?: string;
  isError?: boolean;
  userMessage?: string;
  /** Image data URLs attached to a user message */
  userImages?: string[];
  status: 'active' | 'complete';
}

/* ─── Tool display helpers ─── */

export function getToolIcon(name: string) {
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
    case 'AskUserQuestion': return HelpCircleIcon;
    default: return WrenchIcon;
  }
}

export function getToolDescription(name: string, input: Record<string, unknown>): string {
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
    case 'AskUserQuestion': {
      const qs = input.questions as Array<{ question: string }> | undefined;
      return qs?.[0]?.question ? truncate(qs[0].question, 60) : 'Asking a question';
    }
    default:
      return name;
  }
}

export function getToolInputDisplay(name: string, input: Record<string, unknown>): string | null {
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
    case 'AskUserQuestion':
      return null; // Custom rendering handled in ToolBlock
    default:
      return null;
  }
}

export function truncate(str: string | undefined | null, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export function truncateLines(str: string | undefined | null, maxLines: number): string {
  if (!str) return '';
  const lines = str.split('\n');
  if (lines.length <= maxLines) return str;
  return lines.slice(0, maxLines).join('\n') + `\n... (${lines.length - maxLines} more lines)`;
}

export function normalizeToolResult(content: unknown): string {
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

export function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
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
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold text-bronze-800 dark:text-zinc-200">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code key={match.index} className="px-1 py-0.5 rounded bg-bronze-200 dark:bg-zinc-800 text-amber-700 dark:text-amber-300/80 text-[11px] font-mono">
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

export function CollapsibleOutput({
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
          className="flex items-center gap-1 text-[10px] font-medium text-text-chrome hover:text-text-chrome-hover transition-colors uppercase tracking-wider"
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
            className="ml-auto text-text-chrome hover:text-text-chrome-hover transition-colors p-0.5"
          >
            {copied ? <CheckIcon className="w-3 h-3 text-patina dark:text-green-400" /> : <CopyIcon className="w-3 h-3" />}
          </button>
        )}
      </div>
      {open && (
        <pre className={`mt-1 text-[11px] font-mono leading-relaxed whitespace-pre-wrap break-all ${isError ? 'text-crimson dark:text-red-400/80' : 'text-bronze-600 dark:text-zinc-400'}`}>
          {displayContent}
          {truncated && (
            <span className="text-text-chrome italic">{`\n... ${lines.length - maxLines} more lines`}</span>
          )}
        </pre>
      )}
    </div>
  );
}

/* ─── Individual block renderers ─── */

export function TextBlock({ block, collapseSignal, neverCollapse }: { block: RenderBlock; collapseSignal: number; neverCollapse?: boolean }) {
  const [collapsed, setCollapsed] = useState(neverCollapse ? false : collapseSignal > 0);
  const text = block.text || '';
  const lineCount = text.split('\n').length;
  const isLong = lineCount > 8;

  useEffect(() => {
    if (neverCollapse) { setCollapsed(false); return; }
    if (collapseSignal > 0 && isLong) setCollapsed(true);
    else if (collapseSignal < 0) setCollapsed(false);
  }, [collapseSignal, isLong, neverCollapse]);

  return (
    <div className="flex gap-3 py-2.5">
      <div className="shrink-0 mt-1">
        <div className="w-3.5 h-3.5 flex items-center justify-center">
          <div className={`w-2 h-2 rounded-full ${block.status === 'active' ? 'bg-steel dark:bg-blue-400 animate-pulse' : 'bg-patina dark:bg-emerald-400'}`} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        {isLong && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-[10px] text-text-chrome hover:text-text-chrome-hover transition-colors mb-1 flex items-center gap-1"
          >
            {collapsed ? <ChevronRightIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
            {collapsed ? 'Show more' : 'Collapse'}
          </button>
        )}
        <div className="text-[13px] text-bronze-700 dark:text-zinc-300 leading-relaxed">
          {collapsed
            ? renderFormattedText(text.split('\n').slice(0, 3).join('\n') + '...')
            : renderFormattedText(text)
          }
        </div>
      </div>
    </div>
  );
}

export function AskUserQuestionContent({ input, result }: { input: Record<string, unknown>; result?: string }) {
  const questions = (input.questions as Array<{
    question: string;
    header?: string;
    options: Array<{ label: string; description?: string; markdown?: string }>;
    multiSelect?: boolean;
  }>) || [];

  // Try to parse answers from the result JSON
  let answers: Record<string, string> = {};
  if (result) {
    try {
      const parsed = JSON.parse(result);
      if (parsed.answers) answers = parsed.answers;
    } catch {
      // result might be plain text
    }
  }

  return (
    <div className="space-y-3 px-3 py-2.5">
      {questions.map((q, i) => {
        const answer = answers[q.question];
        return (
          <div key={i}>
            {q.header && (
              <span className="text-[10px] font-medium text-text-chrome uppercase tracking-wider">{q.header}</span>
            )}
            <p className="text-[12px] text-bronze-800 dark:text-zinc-200 font-medium mt-0.5">{q.question}</p>
            <div className="mt-1.5 space-y-1">
              {q.options.map((opt, j) => {
                const isSelected = answer === opt.label;
                return (
                  <div
                    key={j}
                    className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md text-[12px] ${
                      isSelected
                        ? 'bg-steel/10 border border-steel/30 text-steel dark:text-blue-300'
                        : 'text-bronze-600 dark:text-zinc-400'
                    }`}
                  >
                    <span className="shrink-0 mt-px">{isSelected ? '\u25CF' : '\u25CB'}</span>
                    <div>
                      <span className={isSelected ? 'font-medium' : ''}>{opt.label}</span>
                      {opt.description && (
                        <span className="ml-1.5 text-text-chrome">{opt.description}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {result && !Object.keys(answers).length && (
        <div className="text-[11px] text-text-chrome italic">{result}</div>
      )}
    </div>
  );
}

export function ToolBlock({ block, collapseSignal }: { block: RenderBlock; collapseSignal: number }) {
  const [collapsed, setCollapsed] = useState(collapseSignal > 0);

  useEffect(() => {
    if (collapseSignal > 0) setCollapsed(true);
    else if (collapseSignal < 0) setCollapsed(false);
  }, [collapseSignal]);

  const Icon = getToolIcon(block.toolName || '');
  const description = getToolDescription(block.toolName || '', block.toolInput || {});
  const inputDisplay = getToolInputDisplay(block.toolName || '', block.toolInput || {});
  const hasResult = block.toolResult !== undefined;
  const isActive = block.status === 'active' && !hasResult;
  const isAskQuestion = block.toolName === 'AskUserQuestion';

  return (
    <div className="flex gap-3 py-2.5">
      <div className="shrink-0 mt-1">
        {isActive ? (
          <Loader2Icon className="w-3.5 h-3.5 text-steel dark:text-blue-400 animate-spin" />
        ) : block.toolError ? (
          <AlertCircleIcon className="w-3.5 h-3.5 text-crimson dark:text-red-400" />
        ) : (
          <div className="w-3.5 h-3.5 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-patina dark:bg-emerald-400" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 group w-full text-left"
        >
          <Icon className="w-3.5 h-3.5 text-text-chrome shrink-0" />
          <span className="text-[13px] font-semibold text-bronze-800 dark:text-zinc-200">{isAskQuestion ? 'Question' : block.toolName}</span>
          <span className="text-[12px] text-text-chrome truncate">{description}</span>
          <span className="ml-auto shrink-0 text-text-chrome group-hover:text-text-chrome-hover transition-colors">
            {collapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
          </span>
        </button>

        {!collapsed && (
          <div className="mt-2 rounded-md border border-border-default bg-surface-secondary overflow-hidden">
            {isAskQuestion ? (
              <AskUserQuestionContent input={block.toolInput || {}} result={block.toolResult} />
            ) : (
              <>
                {inputDisplay && (
                  <div className="px-3 py-2 border-b border-border-subtle">
                    <span className="text-[10px] font-medium text-text-chrome uppercase tracking-wider mr-2">IN</span>
                    <pre className="mt-1 text-[11px] font-mono text-bronze-600 dark:text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">
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
              </>
            )}
            {isActive && (
              <div className="px-3 py-2 flex items-center gap-2">
                <Loader2Icon className="w-3 h-3 text-steel dark:text-blue-400 animate-spin" />
                <span className="text-[11px] text-steel dark:text-blue-400/80">{isAskQuestion ? 'Waiting for answer...' : 'Running...'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ThinkingBlock({ block, collapseSignal }: { block: RenderBlock; collapseSignal: number }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = block.status === 'active';

  useEffect(() => {
    if (collapseSignal > 0) setExpanded(false);
    else if (collapseSignal < 0) setExpanded(true);
  }, [collapseSignal]);

  return (
    <div className="flex gap-3 py-2">
      <div className="shrink-0 mt-1">
        {isActive ? (
          <Loader2Icon className="w-3.5 h-3.5 text-text-chrome animate-spin" />
        ) : (
          <BrainIcon className="w-3.5 h-3.5 text-text-chrome" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[12px] text-text-chrome hover:text-text-chrome-hover transition-colors"
        >
          {expanded ? <ChevronDownIcon className="w-3 h-3" /> : <ChevronRightIcon className="w-3 h-3" />}
          <span className="italic">{isActive ? 'Thinking...' : 'Thinking'}</span>
        </button>
        {expanded && block.thinking && (
          <pre className="mt-1.5 text-[11px] font-mono text-text-chrome whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
            {block.thinking}
          </pre>
        )}
      </div>
    </div>
  );
}

export function ResultBlock({ block }: { block: RenderBlock }) {
  const duration = block.durationMs ? `${(block.durationMs / 1000).toFixed(1)}s` : null;
  const cost = block.costUsd ? `$${block.costUsd.toFixed(4)}` : null;

  return (
    <div className="flex gap-3 py-2.5 border-t border-border-subtle mt-1">
      <div className="shrink-0 mt-1">
        {block.isError ? (
          <AlertCircleIcon className="w-3.5 h-3.5 text-crimson dark:text-red-400" />
        ) : (
          <CheckCircle2Icon className="w-3.5 h-3.5 text-patina dark:text-emerald-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span className={`text-[12px] font-medium ${block.isError ? 'text-crimson dark:text-red-400' : 'text-patina dark:text-emerald-400'}`}>
          {block.isError ? 'Failed' : 'Complete'}
        </span>
        <div className="flex items-center gap-3 mt-0.5">
          {duration && <span className="text-[11px] text-text-chrome">{duration}</span>}
          {block.numTurns != null && <span className="text-[11px] text-text-chrome">{block.numTurns} turns</span>}
          {cost && <span className="text-[11px] text-text-chrome">{cost}</span>}
        </div>
      </div>
    </div>
  );
}

export function UserMessageBlock({ block }: { block: RenderBlock }) {
  return (
    <div className="flex gap-3 py-2.5 border-t border-border-subtle mt-1">
      <div className="shrink-0 mt-1">
        <UserIcon className="w-3.5 h-3.5 text-steel" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-bronze-800 dark:text-zinc-200 leading-relaxed">
          {renderFormattedText(block.userMessage || '')}
        </div>
        {block.userImages && block.userImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {block.userImages.map((url, i) => (
              <div key={i} className="rounded-md overflow-hidden border border-border-default bg-surface-primary">
                <img src={url} alt="Attached image" className="h-24 w-auto max-w-[200px] object-cover block" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Simplified tool block for history (no full I/O detail) ─── */

export function SimpleToolBlock({ action, detail, collapseSignal }: { action: string; detail: string; collapseSignal: number }) {
  const Icon = getToolIcon(action);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (collapseSignal > 0) setCollapsed(true);
    else if (collapseSignal < 0) setCollapsed(false);
  }, [collapseSignal]);

  return (
    <div className="flex gap-3 py-1.5">
      <div className="shrink-0 mt-1">
        <div className="w-3.5 h-3.5 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-patina dark:bg-emerald-400" />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 group w-full text-left"
        >
          <Icon className="w-3.5 h-3.5 text-text-chrome shrink-0" />
          <span className="text-[13px] font-semibold text-bronze-800 dark:text-zinc-200">{action}</span>
          <span className="text-[12px] text-text-chrome truncate">{detail}</span>
          <span className="ml-auto shrink-0 text-text-chrome group-hover:text-text-chrome-hover transition-colors">
            {collapsed ? <ChevronRightIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
          </span>
        </button>
        {!collapsed && detail && (
          <div className="mt-2 rounded-md border border-border-default bg-surface-secondary overflow-hidden">
            <div className="px-3 py-2">
              <pre className="text-[11px] font-mono text-bronze-600 dark:text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">
                {detail}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
