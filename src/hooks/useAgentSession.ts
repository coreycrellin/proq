'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentBlock, AgentWsServerMsg, TaskAttachment } from '@/lib/types';
import { useStreamingBuffer } from './useStreamingBuffer';

function getWsPort(): string {
  return (typeof window !== 'undefined' && (window as unknown as { __PROQ_WS_PORT?: string }).__PROQ_WS_PORT) || '42069';
}
const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

// After this many consecutive WS failures, switch to HTTP polling
const WS_FAIL_THRESHOLD = 3;
const HTTP_POLL_INTERVAL = 2000;

interface UseAgentSessionResult {
  blocks: AgentBlock[];
  streamingText: string;
  connected: boolean;
  sessionDone: boolean;
  sendFollowUp: (text: string, attachments?: TaskAttachment[]) => boolean;
  approvePlan: (text: string) => void;
  stop: () => void;
  /** Force a WS reconnection (e.g. after HTTP fallback dispatches a task) */
  reconnect: () => void;
}

export function useAgentSession(
  taskId: string,
  projectId: string,
  staticLog?: AgentBlock[],
): UseAgentSessionResult {
  const [blocks, setBlocks] = useState<AgentBlock[]>(staticLog || []);
  const [connected, setConnected] = useState(false);
  const [sessionDone, setSessionDone] = useState(!!staticLog);
  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<(() => void) | null>(null);
  const { streamingText, appendDelta, clearBuffer } = useStreamingBuffer();

  // If static log, just use it directly
  useEffect(() => {
    if (staticLog) {
      setBlocks(staticLog);
      setSessionDone(true);
      return;
    }

    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let wsFailCount = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // ── HTTP polling fallback ──
    function startHttpPolling() {
      if (cancelled || pollTimer) return;
      let lastTotal = 0;

      pollTimer = setInterval(async () => {
        if (cancelled) { if (pollTimer) clearInterval(pollTimer); return; }
        try {
          const res = await fetch(
            `/api/projects/${projectId}/tasks/${taskId}/blocks?after=${lastTotal}`
          );
          if (!res.ok) return;
          const data = await res.json();

          if (data.blocks && data.blocks.length > 0) {
            setBlocks((prev) => {
              // If this is a full replay (lastTotal was 0), replace
              if (lastTotal === 0) return data.blocks;
              return [...prev, ...data.blocks];
            });
            // Don't set connected=true here — connected means WebSocket is open.
            // StructuredPane's sendRef uses connected to decide WS vs HTTP fallback.
          }
          lastTotal = data.total || lastTotal;

          if (data.done) {
            setSessionDone(true);
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
          }
        } catch {
          // Retry next interval
        }
      }, HTTP_POLL_INTERVAL);
    }

    // ── WebSocket connection ──
    function connect() {
      if (cancelled) return;

      // Check if WS port is likely reachable: if we're on a tunnel domain (not a local IP/localhost),
      // the separate WS port won't be forwarded. Skip WS and go straight to polling.
      const hostname = window.location.hostname;
      const isLocalAccess = hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        /^192\.168\./.test(hostname) ||
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

      if (!isLocalAccess) {
        // Tunnel/remote access — WS port won't work, use HTTP polling
        startHttpPolling();
        return;
      }

      const wsHost = window.location.hostname;
      const url = `ws://${wsHost}:${getWsPort()}/ws/agent?taskId=${taskId}&projectId=${projectId}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        wsFailCount = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: AgentWsServerMsg = JSON.parse(event.data);

          if (msg.type === 'replay') {
            retryCount = 0; // successful — reset retries
            clearBuffer();
            setBlocks(msg.blocks);
            // Check if session is done — look at last status block and user blocks
            // A user block after the last complete/error/abort means a follow-up is pending
            const statusBlocks = msg.blocks.filter(
              (b) => b.type === 'status' && ['complete', 'error', 'abort', 'init'].includes(b.subtype)
            );
            const lastStatus = statusBlocks[statusBlocks.length - 1];
            const lastStatusIdx = lastStatus ? msg.blocks.lastIndexOf(lastStatus) : -1;
            const hasUserAfter = msg.blocks.slice(lastStatusIdx + 1).some((b) => b.type === 'user');
            const isDone = lastStatus?.type === 'status' && lastStatus.subtype !== 'init' && !hasUserAfter;
            setSessionDone(isDone);
          } else if (msg.type === 'stream_delta') {
            appendDelta(msg.text);
          } else if (msg.type === 'block') {
            retryCount = 0;
            if (msg.block.type === 'text' || msg.block.type === 'user') {
              clearBuffer();
            }
            setBlocks((prev) => {
              // Dedup: if a tool_use block with the same toolId already exists, replace it
              // (e.g. server may re-broadcast an enriched ExitPlanMode block)
              if (msg.block.type === 'tool_use' && msg.block.toolId) {
                const blockToolId = msg.block.toolId;
                const existingIdx = prev.findIndex(
                  (b) => b.type === 'tool_use' && 'toolId' in b && b.toolId === blockToolId
                );
                if (existingIdx !== -1) {
                  const updated = [...prev];
                  updated[existingIdx] = msg.block;
                  return updated;
                }
              }
              // Dedup text/thinking: scan recent blocks for identical content
              if (msg.block.type === 'text' || msg.block.type === 'thinking') {
                const key = msg.block.type === 'text' ? 'text' : 'thinking';
                const val = (msg.block as Record<string, unknown>)[key];
                for (let i = prev.length - 1; i >= 0 && i >= prev.length - 30; i--) {
                  const p = prev[i];
                  if (p.type === msg.block.type && (p as Record<string, unknown>)[key] === val) return prev;
                  if (p.type === 'status' || p.type === 'user') break;
                }
              }
              return [...prev, msg.block];
            });
            if (msg.block.type === 'status' && msg.block.subtype === 'init' || msg.block.type === 'user') {
              // New turn starting (follow-up or initial) — reset done state
              setSessionDone(false);
            } else if (msg.block.type === 'status' && (msg.block.subtype === 'complete' || msg.block.subtype === 'error' || msg.block.subtype === 'abort')) {
              setSessionDone(true);
            }
          } else if (msg.type === 'error') {
            // Session not ready yet — retry with backoff
            console.log('[useAgentSession] server error:', msg.error);
            if (retryCount < MAX_RETRIES && !cancelled) {
              retryCount++;
              ws.close();
              retryTimer = setTimeout(connect, RETRY_DELAY_MS);
            } else {
              // Max retries exhausted — no active session, allow input
              setSessionDone(true);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        wsRef.current = null;
        // Reconnect automatically unless the effect was cleaned up or we
        // intentionally closed (code 1000 = normal closure).
        // This covers idle timeouts, network blips, and server restarts.
        if (!cancelled && event.code !== 1000) {
          retryTimer = setTimeout(connect, RETRY_DELAY_MS);
        }
      };

      ws.onerror = () => {
        setConnected(false);
        wsFailCount++;
        // If WS consistently fails, switch to HTTP polling
        if (wsFailCount >= WS_FAIL_THRESHOLD && !pollTimer) {
          console.log('[useAgentSession] WebSocket unreachable, switching to HTTP polling');
          startHttpPolling();
        }
      };
    }

    // Expose connect for imperative reconnection (e.g. after HTTP fallback)
    connectRef.current = () => {
      if (cancelled) return;
      // Reset retry state so the new connection gets fresh attempts
      retryCount = 0;
      wsFailCount = 0;
      // Close existing WS if any (use 1000 to prevent onclose from also reconnecting)
      if (wsRef.current) {
        wsRef.current.close(1000);
        wsRef.current = null;
      }
      connect();
    };

    connect();

    return () => {
      cancelled = true;
      connectRef.current = null;
      if (retryTimer) clearTimeout(retryTimer);
      if (pollTimer) clearInterval(pollTimer);
      if (wsRef.current) wsRef.current.close();
      wsRef.current = null;
    };
  }, [taskId, projectId, staticLog]);

  const sendFollowUp = useCallback((text: string, attachments?: TaskAttachment[]): boolean => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'followup', text, attachments }));
      return true;
    }
    return false;
  }, []);

  const approvePlan = useCallback((text: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'plan-approve', text }));
    }
  }, []);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  const reconnect = useCallback(() => {
    connectRef.current?.();
  }, []);

  return { blocks, streamingText, connected, sessionDone, sendFollowUp, approvePlan, stop, reconnect };
}
