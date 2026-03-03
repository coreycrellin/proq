'use client';

import React from 'react';
import { Modal } from '@/components/Modal';

interface GitDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  type: 'diff' | 'log';
}

function colorDiffLine(line: string): string | null {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'text-green-400';
  if (line.startsWith('-') && !line.startsWith('---')) return 'text-red-400';
  if (line.startsWith('@@')) return 'text-blue-400';
  if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) return 'text-zinc-500';
  return null;
}

function colorLogLine(line: string): string | null {
  if (line.startsWith('commit ')) return 'text-bronze-500';
  if (line.startsWith('Author:')) return 'text-zinc-400';
  if (line.startsWith('Date:')) return 'text-zinc-500';
  if (line.startsWith('    ')) return 'text-zinc-200';
  return null;
}

export function GitDetailModal({ isOpen, onClose, title, content, type }: GitDetailModalProps) {
  const colorFn = type === 'diff' ? colorDiffLine : colorLogLine;
  const lines = content.split('\n');

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-[700px] max-w-[90vw] max-h-[80vh] flex flex-col">
      <div className="px-5 pt-4 pb-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
          {lines.map((line, i) => {
            const color = colorFn(line);
            return (
              <div key={i} className={color || 'text-zinc-400'}>
                {line || '\u00A0'}
              </div>
            );
          })}
        </pre>
      </div>
    </Modal>
  );
}
