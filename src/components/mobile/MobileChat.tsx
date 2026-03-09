'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SendIcon, MicIcon, LoaderIcon } from 'lucide-react';
import type { ChatLogEntry } from '@/lib/types';

interface MobileChatProps {
  projectId: string;
}

export function MobileChat({ projectId }: MobileChatProps) {
  const [messages, setMessages] = useState<ChatLogEntry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recognitionSupported, setRecognitionSupported] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    setRecognitionSupported(!!SR);
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
      // Fetch updated messages
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
    const SR = (window as unknown as Record<string, typeof SpeechRecognition>).SpeechRecognition || (window as unknown as Record<string, typeof SpeechRecognition>).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        sendMessage(transcript);
      }
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
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

      {/* Input bar */}
      <form
        onSubmit={handleSubmit}
        className="flex-shrink-0 border-t border-border-default bg-surface-topbar px-3 py-2 flex items-end gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message..."
          className="flex-1 bg-surface-inset border border-border-default rounded-full px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-bronze-600"
          disabled={sending}
        />
        {recognitionSupported && (
          <button
            type="button"
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            className={`p-2.5 rounded-full flex-shrink-0 transition-colors ${
              recording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-surface-hover text-text-secondary active:bg-surface-hover/80'
            }`}
          >
            <MicIcon className="w-5 h-5" />
          </button>
        )}
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
    </div>
  );
}
