'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SendIcon, MicIcon, LoaderIcon, ShieldAlertIcon } from 'lucide-react';
import { HttpsSetupSheet } from './HttpsSetupSheet';
import type { ChatLogEntry } from '@/lib/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRef = any;

interface MobileChatProps {
  projectId: string;
}

export function MobileChat({ projectId }: MobileChatProps) {
  const [messages, setMessages] = useState<ChatLogEntry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [needsHttps, setNeedsHttps] = useState(false);
  const [unsupportedMsg, setUnsupportedMsg] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<AnyRef>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const hasSR = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    setSupported(hasSR);
    if (!hasSR) {
      const isSecure = w.location?.protocol === 'https:' || w.location?.hostname === 'localhost';
      if (!isSecure) {
        setNeedsHttps(true);
      } else {
        setUnsupportedMsg('Not supported in this browser');
      }
    }
  }, []);

  // Fetch messages
  useEffect(() => {
    fetch(`/api/projects/${projectId}/chat`)
      .then((res) => res.json())
      .then((data) => setMessages(Array.isArray(data) ? data : data.chatLog || []))
      .catch(console.error);
  }, [projectId]);

  // Poll for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/projects/${projectId}/chat`)
        .then((res) => res.json())
        .then((data) => setMessages(Array.isArray(data) ? data : data.chatLog || []))
        .catch(console.error);
    }, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', message: text.trim() }),
      });
      setInput('');
      const res = await fetch(`/api/projects/${projectId}/chat`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : data.chatLog || []);
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
    }
  }, [projectId]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  }, [input, sendMessage]);

  const startRecording = useCallback(() => {
    setRecordError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      return;
    }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) {
        sendMessage(transcript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (e: any) => {
      setRecording(false);
      if (e.error === 'not-allowed') {
        setRecordError('Microphone access denied');
      } else {
        setRecordError('Speech recognition failed');
      }
      setTimeout(() => setRecordError(null), 3000);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setRecording(true);
    } catch {
      setRecordError('Speech recognition not available');
      setTimeout(() => setRecordError(null), 3000);
    }
  }, [sendMessage]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-text-tertiary text-sm">No messages yet</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3.5 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-bronze-700 dark:bg-bronze-600 text-white'
                  : 'bg-surface-hover text-text-primary'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.message}</p>
              <p className={`text-[10px] mt-1 ${
                msg.role === 'user' ? 'text-white/50' : 'text-text-tertiary'
              }`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 border-t border-border-default bg-surface-topbar px-3 py-2 space-y-2">
        {/* Text input + send */}
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message..."
            style={{ fontSize: '16px' }}
            className="flex-1 bg-surface-inset border border-border-default rounded-full px-4 py-2.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-bronze-600"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-full bg-bronze-700 dark:bg-bronze-600 text-white flex-shrink-0 disabled:opacity-40 active:opacity-80"
          >
            {sending ? (
              <LoaderIcon className="w-5 h-5 animate-spin" />
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </button>
        </form>

        {/* Full-width record button */}
        {needsHttps ? (
          <button
            type="button"
            onClick={() => setShowSetup(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full transition-colors select-none bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80"
          >
            <ShieldAlertIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Tap to enable voice dictation</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!supported}
            onTouchStart={(e) => { e.preventDefault(); if (supported) startRecording(); }}
            onTouchEnd={(e) => { e.preventDefault(); if (supported) stopRecording(); }}
            onMouseDown={() => { if (supported) startRecording(); }}
            onMouseUp={() => { if (supported) stopRecording(); }}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-full transition-colors select-none ${
              !supported
                ? 'bg-surface-hover border border-border-default text-text-tertiary opacity-60 cursor-not-allowed'
                : recording
                ? 'bg-red-500 text-white'
                : recordError
                ? 'bg-surface-hover border border-red-500/50 text-red-400'
                : 'bg-surface-hover border border-border-default text-text-secondary active:bg-surface-hover/80'
            }`}
          >
            <MicIcon className={`w-5 h-5 ${recording ? 'animate-pulse' : ''}`} />
            <span className="text-sm font-medium">
              {!supported ? (unsupportedMsg || 'Dictation not available') : recording ? 'Recording... release to send' : recordError ? recordError : 'Hold to dictate'}
            </span>
          </button>
        )}
        <HttpsSetupSheet open={showSetup} onClose={() => setShowSetup(false)} />
      </div>
    </div>
  );
}
