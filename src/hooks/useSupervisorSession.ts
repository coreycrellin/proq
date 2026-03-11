'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { AgentBlock, AgentWsServerMsg, TaskAttachment } from '@/lib/types';

function getWsPort(): string {
  return (typeof window !== 'undefined' && (window as unknown as { __PROQ_WS_PORT?: string }).__PROQ_WS_PORT) || '42069';
}

interface UseSupervisorSessionResult {
  blocks: AgentBlock[];
  streamingText: string;
  connected: boolean;
  sessionDone: boolean;
  hasHistory: boolean;
  sendMessage: (text: string, attachments?: TaskAttachment[]) => void;
  stop: () => void;
  clear: () => Promise<void>;
}

export function useSupervisorSession(): UseSupervisorSessionResult {
  const [blocks, setBlocks] = useState<AgentBlock[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [connected, setConnected] = useState(false);
  const [sessionDone, setSessionDone] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // ── Smooth streaming buffer ──
  // Incoming deltas are buffered and drained at a steady rate
  // to avoid the jerky burst-then-pause feel of raw token delivery.
  const bufferRef = useRef('');
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(0);

  const startDrain = useCallback(() => {
    if (rafRef.current !== null) return;
    lastFrameRef.current = performance.now();
    const drain = (now: number) => {
      const elapsed = now - lastFrameRef.current;
      lastFrameRef.current = now;
      const buf = bufferRef.current;
      if (!buf) {
        rafRef.current = null;
        return;
      }
      // Target ~60 chars/sec base, scale up when buffer grows to avoid falling behind
      const baseRate = 60;
      const catchUp = Math.max(0, buf.length - 120) * 0.5;
      const charsThisFrame = Math.max(1, Math.round((baseRate + catchUp) * (elapsed / 1000)));
      const chunk = buf.slice(0, charsThisFrame);
      bufferRef.current = buf.slice(charsThisFrame);
      setStreamingText((prev) => prev + chunk);
      rafRef.current = requestAnimationFrame(drain);
    };
    rafRef.current = requestAnimationFrame(drain);
  }, []);

  const flushBuffer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (bufferRef.current) {
      const remaining = bufferRef.current;
      bufferRef.current = '';
      setStreamingText((prev) => prev + remaining);
    }
  }, []);

  const clearBuffer = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    bufferRef.current = '';
    setStreamingText('');
  }, []);

  useEffect(() => {
    const wsHost = window.location.hostname;
    const url = `ws://${wsHost}:${getWsPort()}/ws/supervisor`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg: AgentWsServerMsg = JSON.parse(event.data);

        if (msg.type === 'replay') {
          setBlocks(msg.blocks);
          clearBuffer();
          // Determine session done state
          const statusBlocks = msg.blocks.filter(
            (b) => b.type === 'status' && ['complete', 'error', 'abort', 'init'].includes(b.subtype)
          );
          const lastStatus = statusBlocks[statusBlocks.length - 1];
          const lastStatusIdx = lastStatus ? msg.blocks.lastIndexOf(lastStatus) : -1;
          const hasUserAfter = msg.blocks.slice(lastStatusIdx + 1).some((b) => b.type === 'user');
          const isDone = !lastStatus || (lastStatus.type === 'status' && lastStatus.subtype !== 'init' && !hasUserAfter);
          setSessionDone(isDone);
        } else if (msg.type === 'stream_delta') {
          bufferRef.current += msg.text;
          startDrain();
        } else if (msg.type === 'block') {
          if (msg.block.type === 'text' || msg.block.type === 'user') {
            flushBuffer();
            setStreamingText('');
          }
          setBlocks((prev) => [...prev, msg.block]);
          if (msg.block.type === 'status' && msg.block.subtype === 'init' || msg.block.type === 'user') {
            setSessionDone(false);
          } else if (msg.block.type === 'status' && (msg.block.subtype === 'complete' || msg.block.subtype === 'error' || msg.block.subtype === 'abort')) {
            setSessionDone(true);
          }
        } else if (msg.type === 'error') {
          console.log('[useSupervisorSession] server error:', msg.error);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    return () => {
      ws.close();
      wsRef.current = null;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const sendMessage = useCallback((text: string, attachments?: TaskAttachment[]) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'followup', text, attachments }));
    }
  }, []);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'stop' }));
    }
  }, []);

  const clear = useCallback(async () => {
    await fetch('/api/supervisor', { method: 'DELETE' });
    setBlocks([]);
    setSessionDone(true);
  }, []);

  const hasHistory = blocks.length > 0;

  return { blocks, streamingText, connected, sessionDone, hasHistory, sendMessage, stop, clear };
}

export type { UseSupervisorSessionResult };
