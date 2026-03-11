'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseStreamingBufferResult {
  streamingText: string;
  appendDelta: (text: string) => void;
  flushBuffer: () => void;
  clearBuffer: () => void;
}

export function useStreamingBuffer(): UseStreamingBufferResult {
  const [streamingText, setStreamingText] = useState('');
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

  const appendDelta = useCallback((text: string) => {
    bufferRef.current += text;
    startDrain();
  }, [startDrain]);

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

  // Cancel RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { streamingText, appendDelta, flushBuffer, clearBuffer };
}
