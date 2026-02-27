'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Trash2Icon } from 'lucide-react';
import { ChatPanel, type StreamingMessage } from './ChatPanel';
import type { ChatLogEntry, ToolCall, TaskAttachment } from '@/lib/types';

interface ProjectSupervisorPaneProps {
  projectId: string;
  visible: boolean;
  onTaskCreated?: () => void;
}

export function ProjectSupervisorPane({ projectId, visible, onTaskCreated }: ProjectSupervisorPaneProps) {
  const [messages, setMessages] = useState<ChatLogEntry[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null);
  const loadedRef = useRef<string | null>(null);

  // Load history on mount / project change
  useEffect(() => {
    if (loadedRef.current === projectId) return;
    loadedRef.current = projectId;
    setMessages([]);
    setDraft('');

    fetch(`/api/projects/${projectId}/supervisor`)
      .then((res) => res.json())
      .then((data) => {
        if (data.chatLog) setMessages(data.chatLog);
        if (data.draft) setDraft(data.draft);
      })
      .catch(console.error);
  }, [projectId]);

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

  const handleSendMessage = useCallback(async (text: string, attachments?: TaskAttachment[]) => {
    // Optimistic user message
    const userEntry: ChatLogEntry = {
      role: 'user',
      message: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userEntry]);
    setIsLoading(true);
    setStreamingMessage({ toolCalls: [], text: '' });

    // Clear persisted draft immediately
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    fetch(`/api/projects/${projectId}/supervisor`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: '' }),
    }).catch(console.error);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const payload: Record<string, unknown> = { message: text };
      if (attachments && attachments.length > 0) {
        payload.attachments = attachments;
      }

      const res = await fetch(`/api/projects/${projectId}/supervisor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accText = '';
      const accToolCalls: ToolCall[] = [];
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
            const chunk = JSON.parse(line);
            if (chunk.type === 'text_delta') {
              accText += chunk.text;
              setStreamingMessage({ toolCalls: [...accToolCalls], text: accText });
            } else if (chunk.type === 'tool_call') {
              accToolCalls.push({ action: chunk.action, detail: chunk.detail });
              setStreamingMessage({ toolCalls: [...accToolCalls], text: accText });
              // Detect task creation via API call
              if (chunk.action === 'Bash' && chunk.detail?.includes('/tasks')) {
                didCreateTask = true;
              }
            } else if (chunk.type === 'result' && !accText) {
              accText = chunk.text;
              setStreamingMessage({ toolCalls: [...accToolCalls], text: accText });
            } else if (chunk.type === 'error') {
              accText += (accText ? '\n' : '') + `Error: ${chunk.error}`;
              setStreamingMessage({ toolCalls: [...accToolCalls], text: accText });
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      // Commit final message
      const finalEntry: ChatLogEntry = {
        role: 'proq',
        message: accText || '(no response)',
        timestamp: new Date().toISOString(),
        toolCalls: accToolCalls.length > 0 ? accToolCalls : undefined,
      };
      setMessages((prev) => [...prev, finalEntry]);

      // Notify parent to refresh tasks if a task was created
      if (didCreateTask) {
        onTaskCreated?.();
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        const errorEntry: ChatLogEntry = {
          role: 'proq',
          message: `Error: ${err}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorEntry]);
      }
    } finally {
      setStreamingMessage(null);
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [projectId, onTaskCreated]);

  const handleClear = useCallback(async () => {
    await fetch(`/api/projects/${projectId}/supervisor`, { method: 'DELETE' });
    setMessages([]);
  }, [projectId]);

  if (!visible) return null;

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Clear button */}
      {messages.length > 0 && (
        <div className="absolute top-2 right-3 z-10">
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
      <ChatPanel
        messages={messages}
        onSendMessage={handleSendMessage}
        streamingMessage={streamingMessage}
        isLoading={isLoading}
        initialValue={draft}
        onDraftChange={handleDraftChange}
        onStop={handleStop}
        style={{ flex: 1 }}
      />
    </div>
  );
}
