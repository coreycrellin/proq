'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { CornerDownLeftIcon, TerminalSquareIcon, GlobeIcon, FileTextIcon, SearchIcon, PencilIcon, CodeIcon, WrenchIcon, ChevronUpIcon, PaperclipIcon, SquareIcon, XIcon, FileIcon } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatLogEntry, ToolCall, TaskAttachment } from '@/lib/types';
import { ScrambleText } from './ScrambleText';

export interface StreamingMessage {
  toolCalls: ToolCall[];
  text: string;
}

interface ChatPanelProps {
  messages: ChatLogEntry[];
  onSendMessage: (content: string, attachments?: TaskAttachment[]) => void;
  style?: React.CSSProperties;
  streamingMessage?: StreamingMessage | null;
  isLoading?: boolean;
  initialValue?: string;
  onDraftChange?: (value: string) => void;
  /** Called when the user clicks the stop button to abort the running request */
  onStop?: () => void;
}

// Tool call icon + label mapping
function toolCallInfo(tc: ToolCall): { icon: React.ReactNode; label: string; detail: string } {
  const iconClass = "w-3 h-3 shrink-0";
  const action = tc.action || '';
  const detail = tc.detail || '';

  switch (action) {
    case 'Bash':
      return { icon: <TerminalSquareIcon className={iconClass} />, label: 'Ran command', detail };
    case 'Read':
      return { icon: <FileTextIcon className={iconClass} />, label: 'Read file', detail: detail.split('/').pop() || detail };
    case 'Write':
      return { icon: <PencilIcon className={iconClass} />, label: 'Wrote file', detail: detail.split('/').pop() || detail };
    case 'Edit':
      return { icon: <PencilIcon className={iconClass} />, label: 'Edited file', detail: detail.split('/').pop() || detail };
    case 'Glob':
      return { icon: <SearchIcon className={iconClass} />, label: 'Searched files', detail };
    case 'Grep':
      return { icon: <SearchIcon className={iconClass} />, label: 'Searched code', detail };
    case 'WebFetch':
    case 'WebSearch':
      return { icon: <GlobeIcon className={iconClass} />, label: action === 'WebFetch' ? 'Fetched URL' : 'Web search', detail };
    default:
      return { icon: <WrenchIcon className={iconClass} />, label: action || 'Tool call', detail };
  }
}

function ToolCallPill({ tc }: { tc: ToolCall }) {
  const { icon, label, detail } = toolCallInfo(tc);
  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/40 text-[11px] text-zinc-400 leading-snug">
      {icon}
      <span className="text-zinc-500">{label}</span>
      {detail && (
        <span className="text-zinc-400 font-mono text-[10px] truncate max-w-[240px]">{detail}</span>
      )}
    </div>
  );
}

function MessageContent({ text }: { text: string }) {
  return (
    <div className="prose-chat text-sm leading-relaxed text-zinc-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold text-zinc-200">{children}</strong>,
          em: ({ children }) => <em className="text-zinc-300">{children}</em>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return <code className={`${className} block bg-zinc-900 rounded px-3 py-2 text-[12px] font-mono text-zinc-300 overflow-x-auto my-2`}>{children}</code>;
            }
            return <code className="bg-zinc-800/70 text-zinc-300 rounded px-1 py-0.5 text-[12px] font-mono">{children}</code>;
          },
          pre: ({ children }) => <pre className="bg-zinc-900 rounded-md overflow-x-auto my-2">{children}</pre>,
          ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-zinc-300">{children}</li>,
          a: ({ href, children }) => <a href={href} className="text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">{children}</a>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-zinc-700 pl-3 text-zinc-400 italic my-2">{children}</blockquote>,
          h1: ({ children }) => <h1 className="text-base font-semibold text-zinc-200 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold text-zinc-200 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-zinc-300 mb-1">{children}</h3>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}


export function ChatPanel({ messages, onSendMessage, style, streamingMessage, isLoading, initialValue, onDraftChange, onStop }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState(initialValue || '');
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync when initialValue changes (e.g. restored from persistence)
  const initialValueApplied = useRef(false);
  useEffect(() => {
    if (initialValue && !initialValueApplied.current) {
      setInputValue(initialValue);
      initialValueApplied.current = true;
    }
  }, [initialValue]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [inputValue]);

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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!inputValue.trim() && attachments.length === 0) || isLoading) return;
    const atts = attachments.length > 0 ? [...attachments] : undefined;
    onSendMessage(inputValue, atts);
    setInputValue('');
    setAttachments([]);
    onDraftChange?.('');
  };

  const handleInputChange = useCallback((val: string, cursorPos: number) => {
    // Detect /att shortcut
    const before = cursorPos - 4;
    if (before >= 0 && val.substring(before, cursorPos) === '/att' && (before === 0 || /\s/.test(val[before - 1]))) {
      setInputValue(val.substring(0, before) + val.substring(cursorPos));
      setTimeout(() => fileInputRef.current?.click(), 0);
      return;
    }
    // Detect /atr shortcut — attach most recent desktop image
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
    onDraftChange?.(val);
  }, [onDraftChange]);

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div
      className="w-full flex flex-col bg-bronze-100 dark:bg-black/40 flex-shrink-0"
      style={{ minHeight: 0, ...style }}
    >
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className="group">
            {msg.role === 'proq' ? (
              <div>
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {msg.toolCalls.map((tc, i) => (
                      <ToolCallPill key={i} tc={tc} />
                    ))}
                  </div>
                )}
                <MessageContent text={msg.message} />
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <div className="inline-flex items-baseline gap-2 bg-zinc-800/50 rounded px-2.5 py-1">
                  <span className="text-xs font-bold text-bronze-500 shrink-0">{'\u276F'}</span>
                  <p className="text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{msg.message}</p>
                </div>
                <span className="text-[10px] text-bronze-500 dark:text-zinc-700 ml-auto opacity-0 group-hover:opacity-100 shrink-0">
                  {formatTimestamp(msg.timestamp)}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <div>
            {isLoading && !streamingMessage.text && streamingMessage.toolCalls.length === 0 && (
              <ScrambleText text="Thinking..." />
            )}

            {streamingMessage.toolCalls.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {streamingMessage.toolCalls.map((tc, i) => (
                  <ToolCallPill key={i} tc={tc} />
                ))}
              </div>
            )}

            {streamingMessage.text ? (
              <div className="relative">
                <MessageContent text={streamingMessage.text} />
                <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse ml-0.5 align-text-bottom" />
              </div>
            ) : isLoading && streamingMessage.toolCalls.length > 0 ? (
              <ScrambleText text="Working..." />
            ) : null}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-bronze-300/60 dark:border-zinc-800/60 bg-bronze-200/20 dark:bg-black/20">
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {attachments.map((att) => {
              const isImage = att.type?.startsWith('image/') || false;
              return isImage && att.dataUrl ? (
                <div key={att.id} className="relative group rounded-md overflow-hidden border border-zinc-700/40 bg-zinc-800/60">
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
                <div key={att.id} className="flex items-center gap-1.5 bg-zinc-800/60 border border-zinc-700/40 rounded-md px-2 py-1.5 group">
                  <FileIcon className="w-3 h-3 text-zinc-500 shrink-0" />
                  <span className="text-[11px] text-zinc-400 truncate max-w-[100px]">{att.name}</span>
                  <button
                    onClick={() => removeAttachment(att.id)}
                    className="text-zinc-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <span className="text-bronze-500 text-sm font-bold select-none py-1.5">{'\u276F'}</span>
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => {
              handleInputChange(e.target.value, e.target.selectionStart ?? e.target.value.length);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={isLoading ? "waiting for response..." : "message... (/att to attach, /atr for screenshot)"}
            rows={1}
            className="flex-1 bg-transparent text-sm text-bronze-800 dark:text-zinc-200 placeholder:text-bronze-500 dark:placeholder:text-zinc-700 focus:outline-none caret-steel resize-none leading-relaxed py-1"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file (/att)"
            className="text-zinc-500 dark:text-zinc-600 hover:text-zinc-400 dark:hover:text-zinc-400 transition-colors py-1.5 shrink-0"
          >
            <PaperclipIcon className="w-3.5 h-3.5" />
          </button>
          {isLoading && onStop && (
            <button
              type="button"
              onClick={onStop}
              title="Stop"
              className="text-red-400 hover:bg-red-400/10 rounded transition-colors py-1.5 shrink-0"
            >
              <SquareIcon className="w-3.5 h-3.5 fill-current" />
            </button>
          )}
          <button
            type="submit"
            disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
            className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed py-1.5 shrink-0"
          >
            <CornerDownLeftIcon className="w-3.5 h-3.5" />
          </button>
        </form>
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
