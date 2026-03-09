'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for text-to-speech using the Web Speech API.
 * Reads new text blocks aloud as they arrive from the agent.
 * Persists the enabled state to localStorage.
 */
export function useTTS() {
  const [enabled, setEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  const spokenTextsRef = useRef(new Set<string>());
  const queueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  // Check support and restore persisted state
  useEffect(() => {
    const hasSupport = typeof window !== 'undefined' && 'speechSynthesis' in window;
    setSupported(hasSupport);
    if (hasSupport) {
      const stored = localStorage.getItem('proq-tts-enabled');
      if (stored === 'true') setEnabled(true);
    }
  }, []);

  // Persist enabled state
  useEffect(() => {
    localStorage.setItem('proq-tts-enabled', String(enabled));
    // Stop speaking when disabled
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      queueRef.current = [];
      speakingRef.current = false;
      setSpeaking(false);
    }
  }, [enabled]);

  const processQueue = useCallback(() => {
    if (speakingRef.current || queueRef.current.length === 0) return;

    const text = queueRef.current.shift()!;
    speakingRef.current = true;
    setSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    // Try to pick a high-quality voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(
      (v) => v.name.includes('Samantha') || v.name.includes('Karen') || v.name.includes('Daniel')
    ) || voices.find((v) => v.lang.startsWith('en') && v.localService) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      speakingRef.current = false;
      setSpeaking(queueRef.current.length > 0);
      processQueue();
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      setSpeaking(queueRef.current.length > 0);
      processQueue();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  /** Strip markdown syntax for cleaner speech */
  const stripMarkdown = useCallback((md: string): string => {
    return md
      .replace(/```[\s\S]*?```/g, ' code block ')  // code blocks
      .replace(/`([^`]+)`/g, '$1')                  // inline code
      .replace(/\*\*([^*]+)\*\*/g, '$1')            // bold
      .replace(/\*([^*]+)\*/g, '$1')                // italic
      .replace(/__([^_]+)__/g, '$1')                // bold alt
      .replace(/_([^_]+)_/g, '$1')                  // italic alt
      .replace(/#{1,6}\s+/g, '')                    // headings
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')      // links
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')     // images
      .replace(/^\s*[-*+]\s+/gm, '')                // list markers
      .replace(/^\s*\d+\.\s+/gm, '')                // numbered lists
      .replace(/>\s+/g, '')                         // blockquotes
      .replace(/\n{2,}/g, '. ')                     // paragraph breaks
      .replace(/\n/g, ' ')                          // newlines
      .trim();
  }, []);

  /** Queue a text block for speaking. Deduplicates by content. */
  const speak = useCallback((text: string) => {
    if (!enabled || !supported) return;

    // Deduplicate — don't re-read the same text
    const key = text.slice(0, 200);
    if (spokenTextsRef.current.has(key)) return;
    spokenTextsRef.current.add(key);

    const cleaned = stripMarkdown(text);
    if (!cleaned || cleaned.length < 3) return;

    // Split long texts into chunks at sentence boundaries for responsiveness
    const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
    const chunks: string[] = [];
    let current = '';
    for (const s of sentences) {
      if ((current + s).length > 200) {
        if (current) chunks.push(current.trim());
        current = s;
      } else {
        current += s;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    queueRef.current.push(...chunks);
    processQueue();
  }, [enabled, supported, stripMarkdown, processQueue]);

  /** Stop all speech and clear queue */
  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    queueRef.current = [];
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  /** Toggle enabled state */
  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  /** Reset the spoken texts set (e.g., when switching tasks) */
  const reset = useCallback(() => {
    spokenTextsRef.current.clear();
    stop();
  }, [stop]);

  return { enabled, speaking, supported, toggle, speak, stop, reset };
}
