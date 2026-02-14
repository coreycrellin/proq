import React, { useEffect, useState, useRef } from 'react';
import {
  CornerDownLeftIcon,
  TerminalIcon,
  ChevronRightIcon } from
'lucide-react';
import { Message } from '../types';
interface ChatPanelProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  style?: React.CSSProperties;
}
export function ChatPanel({ messages, onSendMessage, style }: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({
      behavior: 'instant'
    });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue('');
  };
  return (
    <div
      className="w-full flex flex-col bg-black/40 flex-shrink-0 font-mono"
      style={{
        minHeight: 0,
        ...style
      }}>

      {/* Terminal Header */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-zinc-800/60 bg-zinc-900/20">
        <div className="flex items-center gap-2 text-zinc-500">
          <TerminalIcon className="w-3.5 h-3.5" />
          <span className="text-xs tracking-wide">activity</span>
        </div>
        <span className="text-[10px] text-zinc-600">
          {messages.length} events
        </span>
      </div>

      {/* Terminal Output */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, idx) =>
        <div key={msg.id} className="group">
            {/* Role line */}
            <div className="flex items-baseline gap-2">
              <span
              className={`text-xs font-bold ${msg.role === 'twin' ? 'text-blue-400' : 'text-green-400'}`}>

                {msg.role === 'twin' ? '◆' : '❯'}
              </span>
              <span
              className={`text-xs font-semibold ${msg.role === 'twin' ? 'text-blue-400' : 'text-green-400'}`}>

                {msg.role === 'twin' ? 'Twin' : 'Brian'}
              </span>
              <span className="text-[10px] text-zinc-700 ml-auto opacity-0 group-hover:opacity-100">
                {msg.timestamp}
              </span>
            </div>

            {/* Message content */}
            <div className="pl-5 mt-0.5">
              {/* Work log entries */}
              {msg.role === 'twin' &&
            msg.logEntries &&
            msg.logEntries.length > 0 &&
            <div className="mb-2 space-y-0.5 border-l border-zinc-800 ml-0.5 pl-3">
                    {msg.logEntries.map((entry, i) =>
              <div
                key={i}
                className="flex items-start gap-1.5 text-[11px] text-zinc-600 leading-snug">

                        <span className="text-zinc-700 mt-px shrink-0">⎿</span>
                        <span>{entry}</span>
                      </div>
              )}
                  </div>
            }

              <p className="text-[13px] leading-relaxed text-zinc-400">
                {msg.content}
              </p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Terminal Input */}
      <div className="px-4 py-3 border-t border-zinc-800/60 bg-black/20 pt-[20px] pb-[20px]">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <span className="text-green-400 text-sm font-bold select-none">
            ❯
          </span>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="message..."
            className="flex-1 bg-transparent text-[13px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none caret-green-400" />

          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="text-zinc-600 hover:text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed">

            <CornerDownLeftIcon className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>);

}