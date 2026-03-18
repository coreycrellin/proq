'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SquareIcon, ArrowDownIcon, SendIcon, PaperclipIcon, XIcon, FileIcon, Loader2Icon, SettingsIcon } from 'lucide-react';
import type { AgentBlock, TaskAttachment, FollowUpDraft } from '@/lib/types';
import { uploadFiles, attachmentUrl } from '@/lib/upload';
import { handleChatCommand } from '@/lib/chat-commands';
import { useAgentSession } from '@/hooks/useAgentSession';
import { ScrambleText } from './ScrambleText';
import { TextBlock } from './blocks/TextBlock';
import { ThinkingBlock } from './blocks/ThinkingBlock';
import { ToolBlock } from './blocks/ToolBlock';
import { ToolGroupBlock } from './blocks/ToolGroupBlock';
import type { ToolGroupItem } from './blocks/ToolGroupBlock';
import { StatusBlock } from './blocks/StatusBlock';
import { TaskUpdateBlock } from './blocks/TaskUpdateBlock';
import { UserBlock } from './blocks/UserBlock';
import { AskQuestionBlock } from './blocks/AskQuestionBlock';
import { PlanApprovalBlock } from './blocks/PlanApprovalBlock';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface StructuredPaneProps {
  taskId: string;
  projectId: string;
  visible: boolean;
  taskStatus?: string;
  agentBlocks?: AgentBlock[];
  followUpDraft?: FollowUpDraft;
  onFollowUpDraftChange?: (draft: FollowUpDraft | null) => void;
  onTaskStatusChange?: (status: string) => void;
  compact?: boolean;
  readOnly?: boolean;
  sendRef?: React.MutableRefObject<((text: string) => void) | null>;
  attachRef?: React.MutableRefObject<(() => void) | null>;
  onNewText?: (text: string) => void;
  userFontSize?: number;
  responseFontSize?: number;
}

export function StructuredPane({ taskId, projectId, visible, taskStatus, agentBlocks, followUpDraft, onFollowUpDraftChange, onTaskStatusChange, compact, readOnly, sendRef, attachRef, onNewText, userFontSize: userFontSizeProp, responseFontSize: responseFontSizeProp }: StructuredPaneProps) {
  const { blocks, streamingText, connected, sessionDone, sendFollowUp, approvePlan, stop } = useAgentSession(taskId, projectId, agentBlocks);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const [inputValue, setInputValue] = useState(followUpDraft?.text ?? '');
  const [attachments, setAttachments] = useState<TaskAttachment[]>(followUpDraft?.attachments ?? []);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const [showCosts, setShowCosts] = useState(false);
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [userFontSize, setUserFontSize] = useState(() => {
    if (typeof window === 'undefined') return 15;
    const v = parseInt(localStorage.getItem('proq-structured-userFontSize') ?? '', 10);
    return isNaN(v) ? 15 : v;
  });
  const [responseFontSize, setResponseFontSize] = useState(() => {
    if (typeof window === 'undefined') return 19;
    const v = parseInt(localStorage.getItem('proq-structured-responseFontSize') ?? '', 10);
    return isNaN(v) ? 19 : v;
  });
  // Persist font sizes
  useEffect(() => { localStorage.setItem('proq-structured-userFontSize', String(userFontSize)); }, [userFontSize]);
  useEffect(() => { localStorage.setItem('proq-structured-responseFontSize', String(responseFontSize)); }, [responseFontSize]);
  // Use props when provided, otherwise fall back to internal state
  const effectiveUserFontSize = userFontSizeProp ?? userFontSize;
  const effectiveResponseFontSize = responseFontSizeProp ?? responseFontSize;
  // Track user-originated input changes to avoid external sync overwriting them
  const localChangeRef = useRef(false);

  // Fetch showCosts setting once on mount
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => setShowCosts(!!s.showCosts))
      .catch(() => {});
  }, []);

  // Auto-scroll to bottom on new blocks unless user scrolled up
  useEffect(() => {
    if (!userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [blocks, streamingText, userScrolledUp]);

  // Track scroll position
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setUserScrolledUp(!isAtBottom);
  };

  const jumpToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUserScrolledUp(false);
    }
  };

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    // Reset to 0 to get true scrollHeight, then clamp
    ta.style.height = '0';
    const sh = ta.scrollHeight;
    ta.style.height = Math.max(36, Math.min(sh, 160)) + 'px';
  }, []);

  // Resize textarea on mount when restoring a draft
  useEffect(() => {
    if (followUpDraft?.text) resizeTextarea();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync input when draft is set externally (e.g., conflict resolution prompt)
  // Skip if the change originated from user typing (localChangeRef)
  const prevDraftRef = useRef(followUpDraft?.text);
  useEffect(() => {
    if (localChangeRef.current) {
      localChangeRef.current = false;
      prevDraftRef.current = followUpDraft?.text;
      return;
    }
    if (followUpDraft?.text && followUpDraft.text !== prevDraftRef.current) {
      setInputValue(followUpDraft.text);
      setAttachments(followUpDraft.attachments ?? []);
      setTimeout(resizeTextarea, 0);
      textareaRef.current?.focus();
    }
    prevDraftRef.current = followUpDraft?.text;
  }, [followUpDraft, resizeTextarea]);

  const syncDraft = useCallback((text: string, atts: TaskAttachment[]) => {
    if (text || atts.length > 0) {
      onFollowUpDraftChange?.({ text, attachments: atts });
    } else {
      onFollowUpDraftChange?.(null);
    }
  }, [onFollowUpDraftChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    localChangeRef.current = true;
    setInputValue(val);
    syncDraft(val, attachments);
    resizeTextarea();

    const trimmed = val.trim().toLowerCase();
    if (trimmed === '/atr' || trimmed === '/att') {
      setInputValue('');
      syncDraft('', attachments);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      handleChatCommand(trimmed, (newAtts) => {
        setAttachments((prev) => {
          const updated = [...prev, ...newAtts];
          syncDraft('', updated);
          return updated;
        });
      });
    }
  };

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const uploaded = await uploadFiles(files);
    localChangeRef.current = true;
    setAttachments((prev) => {
      const updated = [...prev, ...uploaded];
      syncDraft(inputValue, updated);
      return updated;
    });
  }, [inputValue, syncDraft]);

  const removeAttachment = useCallback((id: string) => {
    localChangeRef.current = true;
    setAttachments((prev) => {
      const updated = prev.filter((a) => a.id !== id);
      syncDraft(inputValue, updated);
      return updated;
    });
  }, [inputValue, syncDraft]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text && attachments.length === 0) return;

    if (connected) {
      // WS is live — use continueSession which preserves blocks and resumes
      sendFollowUp(text, attachments.length > 0 ? attachments : undefined);
    } else {
      // No WS connection — fall back to re-dispatch via PATCH
      fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'in-progress',
          followUpMessage: text,
        }),
      });
    }

    setInputValue('');
    setAttachments([]);
    onFollowUpDraftChange?.(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Expose imperative send for external callers (e.g. mobile record button)
  useEffect(() => {
    if (sendRef) {
      sendRef.current = (text: string) => {
        if (!text.trim()) return;
        if (connected) {
          sendFollowUp(text);
        } else {
          fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in-progress', followUpMessage: text }),
          });
        }
      };
    }
    return () => { if (sendRef) sendRef.current = null; };
  }, [sendRef, taskId, projectId, taskStatus, connected, sendFollowUp]);

  // Expose imperative attach for external callers (e.g. mobile plus button)
  useEffect(() => {
    if (attachRef) {
      attachRef.current = () => fileInputRef.current?.click();
    }
    return () => { if (attachRef) attachRef.current = null; };
  }, [attachRef]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragOver(false);
    }
  }, []);

  // Notify parent of new text blocks for TTS — only after agent finishes
  // Use a ref to capture onNewText so it survives task-list reorder races
  // (on mobile, the task moves from "running" to "verify" sort order right as
  // sessionDone becomes true, which can make the prop undefined before the effect fires)
  const onNewTextRef = useRef(onNewText);
  if (onNewText) onNewTextRef.current = onNewText;
  const ttsReadRef = useRef(false);
  useEffect(() => {
    // Reset when a new session starts
    if (!sessionDone) {
      ttsReadRef.current = false;
      return;
    }
    const ttsCallback = onNewTextRef.current;
    if (!ttsCallback || ttsReadRef.current) return;
    ttsReadRef.current = true;
    for (const block of blocks) {
      if (block.type === 'text' && block.text) {
        ttsCallback(block.text);
      }
    }
  }, [sessionDone, blocks]);

  if (!visible) return null;

  // Build a map of tool_use toolId -> tool_result for pairing
  const toolResultMap = new Map<string, Extract<AgentBlock, { type: 'tool_result' }>>();
  for (const block of blocks) {
    if (block.type === 'tool_result') {
      toolResultMap.set(block.toolId, block);
    }
  }

  // Check if agent is actively thinking (last non-status block has no result yet)
  const isRunning = !sessionDone;
  const lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : null;
  const isThinking = isRunning && !streamingText && blocks.length > 0 && (
    (lastBlock?.type === 'status' && lastBlock.subtype === 'init') ||
    (lastBlock?.type === 'tool_result') ||
    (lastBlock?.type === 'text') ||
    (lastBlock?.type === 'user')
  );

  // Group consecutive tool_use blocks of the same type into render items
  type RenderItem =
    | { kind: 'block'; block: AgentBlock; idx: number }
    | { kind: 'tool_group'; toolName: string; items: (ToolGroupItem & { idx: number })[] }
    | { kind: 'ask_question'; toolId: string; input: Record<string, unknown>; result?: Extract<AgentBlock, { type: 'tool_result' }>; idx: number }
    | { kind: 'plan_approval'; toolId: string; input: Record<string, unknown>; result?: Extract<AgentBlock, { type: 'tool_result' }>; planContent?: string; planFilePath?: string; alreadyResponded: boolean; idx: number };

  const renderItems: RenderItem[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === 'tool_result') continue;

    if (block.type === 'tool_use') {
      // Render AskUserQuestion as interactive question card
      if (block.name === 'AskUserQuestion') {
        renderItems.push({
          kind: 'ask_question',
          toolId: block.toolId,
          input: block.input,
          result: toolResultMap.get(block.toolId),
          idx: i,
        });
        continue;
      }

      // Render ExitPlanMode as plan approval card
      if (block.name === 'ExitPlanMode') {
        // Plan content and path are enriched server-side (agent-session.ts reads the
        // plan file from disk when ExitPlanMode is detected). Fall back to backward
        // scan for older sessions where the enrichment wasn't available.
        let planContent = block.input._planContent as string | undefined;
        let planFilePath = block.input._planFilePath as string | undefined;
        if (!planContent) {
          for (let j = i - 1; j >= 0; j--) {
            if (i - j > 50) break;
            const prev = blocks[j];
            if (prev.type === 'tool_use' && prev.name === 'Write') {
              const fp = prev.input.file_path as string;
              if (fp && fp.endsWith('.md')) {
                planContent = prev.input.content as string;
                planFilePath = fp;
                break;
              }
            }
            if (prev.type === 'tool_use' && prev.name === 'Edit') {
              const fp = prev.input.file_path as string;
              if (fp && fp.endsWith('.md') && prev.input.new_string) {
                planContent = prev.input.new_string as string;
                planFilePath = fp;
                break;
              }
            }
          }
        }
        // Check if the user already responded (a user block exists after this one)
        let alreadyResponded = false;
        for (let j = i + 1; j < blocks.length; j++) {
          if (blocks[j].type === 'user') { alreadyResponded = true; break; }
        }
        renderItems.push({
          kind: 'plan_approval',
          toolId: block.toolId,
          input: block.input,
          result: toolResultMap.get(block.toolId),
          planContent,
          planFilePath,
          alreadyResponded,
          idx: i,
        });
        continue;
      }

      // Render proq update_task as TaskUpdateBlock instead of ToolBlock
      const isProqUpdate = block.name === 'mcp__proq__update_task';
      if (isProqUpdate && typeof block.input.summary === 'string') {
        renderItems.push({
          kind: 'block',
          block: {
            type: 'task_update',
            summary: block.input.summary as string,
            nextSteps: block.input.nextSteps as string | undefined,
            timestamp: new Date().toISOString(),
          },
          idx: i,
        });
        continue;
      }

      // Check if this extends an existing group at the end
      const last = renderItems[renderItems.length - 1];
      if (last?.kind === 'tool_group' && last.toolName === block.name) {
        last.items.push({
          toolId: block.toolId,
          name: block.name,
          input: block.input,
          result: toolResultMap.get(block.toolId),
          idx: i,
        });
      } else {
        // Start a new potential group
        renderItems.push({
          kind: 'tool_group',
          toolName: block.name,
          items: [{
            toolId: block.toolId,
            name: block.name,
            input: block.input,
            result: toolResultMap.get(block.toolId),
            idx: i,
          }],
        });
      }
    } else {
      renderItems.push({ kind: 'block', block, idx: i });
    }
  }

  // Find index of last non-text render item (tool, user, task_update, ask, plan)
  // Text blocks after this are "final output" and get the response font size
  let lastNonTextRenderIdx = -1;
  for (let i = renderItems.length - 1; i >= 0; i--) {
    const item = renderItems[i];
    if (item.kind === 'tool_group' || item.kind === 'ask_question' || item.kind === 'plan_approval') {
      lastNonTextRenderIdx = i;
      break;
    }
    if (item.kind === 'block') {
      const t = item.block.type;
      if (t === 'user' || t === 'task_update') {
        lastNonTextRenderIdx = i;
        break;
      }
    }
  }

  // Determine if agent is processing (not waiting for user input, not finished)
  const lastRenderItem = renderItems[renderItems.length - 1];
  const isWaitingForInput =
    (lastRenderItem?.kind === 'ask_question' && !lastRenderItem.result) ||
    (lastRenderItem?.kind === 'plan_approval' && !lastRenderItem.alreadyResponded);
  const isProcessing = isRunning && !isWaitingForInput;

  return (
    <div
      className="flex-1 flex flex-col min-h-0 bg-surface-deep relative"
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-bronze-600/20 dark:bg-bronze-600/15 border-2 border-bronze-600/50 flex items-center justify-center pointer-events-none z-20 rounded-md m-1">
          <div className="text-sm text-text-secondary font-medium bg-bronze-400 dark:bg-bronze-800 border border-bronze-500 dark:border-bronze-700 px-4 py-2 rounded-md shadow-sm">Drop files here</div>
        </div>
      )}

      {/* Message list */}
      <div className="relative flex-1 min-h-0">

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden px-5 py-4 space-y-1"
          style={compact ? { touchAction: 'pan-y' } : undefined}
        >
          {/* Starting session placeholder — shown before any blocks arrive */}
          {blocks.length === 0 && !sessionDone && (
            <div className="flex items-center gap-2 py-2 text-xs text-text-tertiary">
              <Loader2Icon className="w-3.5 h-3.5 text-bronze-500 animate-spin" />
              <span>Starting session...</span>
            </div>
          )}

          {renderItems.map((item, ri) => {
            if (item.kind === 'ask_question') {
              const questions = Array.isArray(item.input.questions) ? item.input.questions as { question: string; header?: string; options: { label: string; description: string }[]; multiSelect?: boolean }[] : [];
              return (
                <AskQuestionBlock
                  key={`ask-${item.idx}`}
                  questions={questions}
                  hasResult={!!item.result}
                  resultText={item.result?.output}
                  isOld={blocks.slice(item.idx + 1).some(b => b.type === 'user')}
                  onAnswer={(answer) => {
                    sendFollowUp(answer);
                  }}
                />
              );
            }
            if (item.kind === 'plan_approval') {
              return (
                <PlanApprovalBlock
                  key={`plan-${item.idx}`}
                  input={item.input}
                  planContent={item.planContent}
                  planFilePath={item.planFilePath}
                  alreadyResponded={item.alreadyResponded}
                  onApprove={() => approvePlan('Plan approved. Proceed with implementation.')}
                  onReject={(feedback) => sendFollowUp(`Plan rejected. ${feedback}`)}
                />
              );
            }
            if (item.kind === 'tool_group') {
              // Single tool call — render inline without group wrapper
              if (item.items.length === 1) {
                const t = item.items[0];
                return (
                  <ToolBlock
                    key={`tool-${t.idx}`}
                    toolId={t.toolId}
                    name={t.name}
                    input={t.input}
                    result={t.result}
                    forceCollapsed={undefined}
                  />
                );
              }
              // Multiple consecutive same-type tools — aggregate
              return (
                <ToolGroupBlock
                  key={`tg-${ri}`}
                  toolName={item.toolName}
                  items={item.items}
                  forceCollapsed={undefined}
                />
              );
            }

            const block = item.block;
            const idx = item.idx;

            switch (block.type) {
              case 'text': {
                const isFinalText = ri > lastNonTextRenderIdx;
                return <TextBlock key={idx} text={block.text} fontSize={isFinalText ? effectiveResponseFontSize : undefined} />;
              }
              case 'thinking':
                return <ThinkingBlock key={idx} thinking={block.thinking} forceCollapsed={undefined} />;
              case 'user':
                return <UserBlock key={idx} text={block.text} attachments={block.attachments} fontSize={effectiveUserFontSize} />;
              case 'status':
                return (
                  <StatusBlock
                    key={idx}
                    subtype={block.subtype}
                    sessionId={block.sessionId}
                    model={block.model}
                    costUsd={showCosts ? block.costUsd : undefined}
                    durationMs={block.durationMs}
                    turns={block.turns}
                    error={block.error}
                  />
                );
              case 'task_update':
                return (
                  <TaskUpdateBlock
                    key={idx}
                    summary={block.summary}
                    nextSteps={block.nextSteps}
                  />
                );
              default:
                return null;
            }
          })}

          {/* Streaming text (live partial response) */}
          {streamingText && <TextBlock text={streamingText} fontSize={effectiveResponseFontSize} />}

          {/* Thinking indicator */}
          {isThinking && (
            <div className="py-2 relative z-[10]">
              <ScrambleText text="Thinking..." />
            </div>
          )}
        </div>

        {/* Processing overlay — light grey when agent is working */}
        {isProcessing && (
          <div className="absolute inset-0 bg-white/30 dark:bg-black/30 pointer-events-none z-[5]" />
        )}

        {/* Jump to bottom */}
        {userScrolledUp && (
          <button
            onClick={jumpToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-text-secondary bg-surface-hover border border-border-strong rounded-full shadow-lg hover:bg-border-strong z-10"
          >
            <ArrowDownIcon className="w-3 h-3" />
            Jump to bottom
          </button>
        )}
      </div>

      {/* Input area */}
      {!readOnly && <div className={`shrink-0 ${compact ? 'px-1.5 py-1' : 'px-3 py-2.5'}`}>
        <div className={`${compact ? 'rounded-lg' : 'rounded-xl'} border border-border-strong/40 focus-within:border-border-strong bg-surface-topbar overflow-hidden transition-colors`}>
          {/* Attachment previews inside container */}
          {attachments.length > 0 && (
            <div className={`flex flex-wrap gap-2 ${compact ? 'px-2 pt-2' : 'px-3 pt-3'}`}>
              {attachments.map((att) => {
                const url = att.filePath ? attachmentUrl(att.filePath) : undefined;
                const isImage = att.type?.startsWith('image/') && url;
                return isImage ? (
                  <div
                    key={att.id}
                    className="relative group rounded-lg overflow-hidden border border-border-strong/50 bg-surface-hover/60"
                  >
                    <img
                      src={url}
                      alt={att.name}
                      className={`${compact ? 'h-10' : 'h-16'} w-auto max-w-[100px] object-cover block cursor-pointer`}
                      onClick={() => window.open(url, '_blank')}
                    />
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white/80 hover:text-crimson opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <XIcon className="w-2.5 h-2.5" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5">
                      <span className="text-[9px] text-text-secondary truncate block">{att.name}</span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={att.id}
                    className="flex items-center gap-1.5 bg-surface-hover/60 border border-border-strong/50 rounded-lg px-2.5 py-2 group"
                  >
                    <FileIcon className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] text-text-secondary truncate max-w-[120px] leading-tight">{att.name}</span>
                      <span className="text-[9px] text-text-placeholder leading-tight">{formatSize(att.size)}</span>
                    </div>
                    <button
                      onClick={() => removeAttachment(att.id)}
                      className="text-text-placeholder hover:text-crimson ml-0.5 opacity-0 group-hover:opacity-100"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {compact ? (
            /* Compact: single-line input with inline buttons */
            <div className="flex items-center gap-1 px-1 py-1">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={taskStatus === 'done' ? "Send a follow-up..." : "Send a message..."}
                rows={1}
                style={{ height: '24px', fontSize: `${effectiveUserFontSize}px` }}
                className="flex-1 min-h-[24px] max-h-[60px] resize-none overflow-hidden bg-transparent text-xs leading-[20px] text-text-secondary placeholder:text-text-placeholder focus:outline-none py-0.5"
              />
              {isRunning && (
                <button
                  onClick={stop}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded bg-red-500/10 hover:bg-red-500/20"
                  title="Stop agent"
                >
                  <SquareIcon className="w-3 h-3 text-red-400 fill-red-400" />
                </button>
              )}
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() && attachments.length === 0}
                className={`shrink-0 w-6 h-6 flex items-center justify-center rounded ${inputValue.trim() || attachments.length > 0 ? 'text-text-chrome bg-bronze-400/30 dark:bg-surface-hover' : 'text-text-tertiary disabled:opacity-30'}`}
                title="Send message"
              >
                <SendIcon className="w-3 h-3" />
              </button>
            </div>
          ) : (
            /* Normal: multi-line textarea with separate button bar */
            <>
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={taskStatus === 'done' ? "Send a follow-up..." : "Send a message..."}
              rows={1}
              style={{ height: '36px', fontSize: `${effectiveUserFontSize}px` }}
              className="w-full min-h-[36px] max-h-[160px] resize-none overflow-hidden bg-transparent px-3 pt-3 pb-2 text-sm leading-[20px] text-text-secondary placeholder:text-text-placeholder focus:outline-none"
            />

            {/* Font size settings row */}
            {showFontSettings && (
              <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border-strong/20">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-placeholder">User</span>
                  <input
                    type="number"
                    min={8}
                    max={32}
                    value={userFontSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 8 && v <= 32) setUserFontSize(v);
                    }}
                    className="w-10 px-1 py-0.5 rounded text-[10px] text-text-secondary bg-surface-secondary border border-border-default text-center focus:outline-none focus:border-blue-500"
                    title="User message text size (px)"
                  />
                  <span className="text-[10px] text-text-placeholder">px</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-text-placeholder">Response</span>
                  <input
                    type="number"
                    min={8}
                    max={32}
                    value={responseFontSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v) && v >= 8 && v <= 32) setResponseFontSize(v);
                    }}
                    className="w-10 px-1 py-0.5 rounded text-[10px] text-text-secondary bg-surface-secondary border border-border-default text-center focus:outline-none focus:border-blue-500"
                    title="Response text size (px)"
                  />
                  <span className="text-[10px] text-text-placeholder">px</span>
                </div>
              </div>
            )}

            {/* Bottom bar: attach left, send right */}
            <div className="flex items-center justify-between px-1.5 pb-1.5">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-tertiary hover:text-text-chrome-hover hover:bg-surface-hover"
                  title="Attach file"
                >
                  <PaperclipIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowFontSettings((v) => !v)}
                  className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
                    showFontSettings
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-text-tertiary hover:text-text-chrome-hover hover:bg-surface-hover'
                  }`}
                  title="Text size settings"
                >
                  <SettingsIcon className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1">
                {isRunning && (
                  <button
                    onClick={stop}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 hover:bg-red-500/20"
                    title="Stop agent"
                  >
                    <SquareIcon className="w-3.5 h-3.5 text-red-400 fill-red-400" />
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() && attachments.length === 0}
                  className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg ${inputValue.trim() || attachments.length > 0 ? 'text-text-chrome bg-bronze-400/30 dark:bg-surface-hover' : 'text-text-tertiary disabled:opacity-30'}`}
                  title="Send message"
                >
                  <SendIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              addFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />
      </div>}
    </div>
  );
}
