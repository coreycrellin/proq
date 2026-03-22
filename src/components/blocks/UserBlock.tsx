'use client';

import React from 'react';
import { FileIcon } from 'lucide-react';
import type { TaskAttachment } from '@/lib/types';
import { attachmentUrl } from '@/lib/upload';

export function UserBlock({ text, attachments, fontSize }: { text: string; attachments?: TaskAttachment[]; fontSize?: number }) {
  return (
    <div className="flex items-baseline gap-2 my-3">
      <div className="inline-flex flex-col bg-surface-hover rounded px-2.5 py-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-bold text-text-chrome shrink-0">{'\u276F'}</span>
          <p className="text-sm leading-relaxed text-text-primary whitespace-pre-wrap" style={fontSize ? { fontSize: `${fontSize}px` } : undefined}>{text}</p>
        </div>
        {attachments && attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5 ml-4">
            {attachments.map((att) => {
              const url = att.filePath ? attachmentUrl(att.filePath) : undefined;
              const isImage = att.type?.startsWith('image/') && url;
              return isImage ? (
                <div key={att.id} className="rounded overflow-hidden border border-border-strong/50 bg-surface-hover/60">
                  <img src={url} alt={att.name} className="h-16 w-auto max-w-[100px] object-cover block" />
                </div>
              ) : (
                <div key={att.id} className="flex items-center gap-1.5 bg-surface-hover/60 border border-border-strong/50 rounded px-2 py-1">
                  <FileIcon className="w-3 h-3 text-text-tertiary shrink-0" />
                  <span className="text-[10px] text-text-secondary truncate max-w-[100px]">{att.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
