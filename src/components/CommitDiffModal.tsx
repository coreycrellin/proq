'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2Icon, XIcon, FileIcon, GitCommitHorizontalIcon } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { FileDiffAccordion } from '@/components/FileDiffAccordion';
import { parseCommitShow } from '@/lib/diff-parser';
import type { FileDiff } from '@/lib/diff-parser';

interface CommitDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  commitHash: string;
  commitMessage?: string;
}

export function CommitDiffModal({ isOpen, onClose, projectId, commitHash, commitMessage }: CommitDiffModalProps) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<FileDiff[]>([]);
  const [parsedMessage, setParsedMessage] = useState('');
  const [parsedHash, setParsedHash] = useState('');
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen || !commitHash) return;
    setLoading(true);
    setFiles([]);
    setOpenFiles(new Set());
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/git`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'show-commit', hash: commitHash }),
        });
        if (res.ok) {
          const data = await res.json();
          const parsed = parseCommitShow(data.diff || '');
          setFiles(parsed.files);
          setParsedMessage(parsed.message || commitMessage || '');
          setParsedHash(parsed.hash || commitHash.slice(0, 7));
          setOpenFiles(new Set(parsed.files.map((f, i) => `${i}:${f.fileName}`)));
        }
      } catch { /* best effort */ }
      setLoading(false);
    })();
  }, [isOpen, commitHash, projectId, commitMessage]);

  const handleClose = useCallback(() => {
    setFiles([]);
    setOpenFiles(new Set());
    setLoading(false);
    onClose();
  }, [onClose]);

  const toggleFile = useCallback((key: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allExpanded = files.length > 0 && openFiles.size >= files.length;

  const handleExpandCollapseAll = useCallback(() => {
    if (allExpanded) {
      setOpenFiles(new Set());
    } else {
      setOpenFiles(new Set(files.map((f, i) => `${i}:${f.fileName}`)));
    }
  }, [allExpanded, files]);

  const messageLines = parsedMessage.split('\n');
  const title = messageLines[0];
  const body = messageLines.slice(1).join('\n').replace(/^\n+/, '');

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showClose={false}
      className="w-[50vw] min-w-[40vw] max-w-[80vw] h-[80vh] flex flex-col resize overflow-auto"
    >
      <div className="px-3 border-b border-border-default flex items-center gap-2 shrink-0 h-[48px]">
        <h3 className="flex-1 min-w-0 truncate flex items-center">
          <span className="text-sm font-semibold">
            <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wide leading-none mr-1.5">commit</span>
            <span className="font-mono text-text-chrome leading-none">{parsedHash || commitHash.slice(0, 7)}</span>
          </span>
        </h3>
        {files.length > 0 && (
          <button
            onClick={handleExpandCollapseAll}
            className="text-xs text-text-chrome hover:text-text-chrome-hover px-2 py-1 rounded border border-border-strong/50 shrink-0"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
        <button
          onClick={handleClose}
          className="text-text-chrome hover:text-text-chrome-hover p-1 rounded hover:bg-surface-hover/50"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {loading && (
          <div className="flex items-center justify-center py-12 text-text-tertiary">
            <Loader2Icon className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs">Loading diff...</span>
          </div>
        )}
        {!loading && files.length > 0 && (
          <>
            <div className="px-5 py-3 border-b border-border-default space-y-3">
              <p className="text-sm text-text-primary font-medium">{title}</p>
              {body && (
                <p className="text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{body}</p>
              )}
              <FileStatSummary files={files} />
            </div>
            {files.map((file, i) => {
              const key = `${i}:${file.fileName}`;
              return (
                <FileDiffAccordion key={key} file={file} isOpen={openFiles.has(key)} onToggle={() => toggleFile(key)} />
              );
            })}
          </>
        )}
        {!loading && files.length === 0 && (
          <div className="flex items-center justify-center py-12 text-text-tertiary text-xs">
            No file changes
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── All Commits Diff Modal ──────────────────────────────

interface CommitWithDiff {
  hash: string;
  message: string;
  date: string;
  files: FileDiff[];
  loading: boolean;
}

interface AllCommitsDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  commits: { hash: string; message: string; author: string; date: string }[];
}

export function AllCommitsDiffModal({ isOpen, onClose, projectId, commits }: AllCommitsDiffModalProps) {
  const [commitDiffs, setCommitDiffs] = useState<CommitWithDiff[]>([]);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());
  const [loadingCount, setLoadingCount] = useState(0);
  const abortRef = useRef(false);

  useEffect(() => {
    if (!isOpen || commits.length === 0) return;
    abortRef.current = false;

    // Initialize with loading state
    const initial: CommitWithDiff[] = commits.map((c) => ({
      hash: c.hash,
      message: c.message,
      date: c.date,
      files: [],
      loading: true,
    }));
    setCommitDiffs(initial);
    setOpenFiles(new Set());
    setLoadingCount(commits.length);

    // Fetch all diffs in parallel
    commits.forEach((commit, idx) => {
      fetch(`/api/projects/${projectId}/git`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'show-commit', hash: commit.hash }),
      })
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (abortRef.current) return;
          const parsed = data ? parseCommitShow(data.diff || '') : { files: [], message: '', hash: '' };
          setCommitDiffs((prev) => {
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              files: parsed.files,
              message: parsed.message || commit.message,
              loading: false,
            };
            return next;
          });
          // Build open files set for this commit
          setOpenFiles((prev) => {
            const next = new Set(prev);
            for (let i = 0; i < parsed.files.length; i++) {
              next.add(`${idx}:${i}:${parsed.files[i].fileName}`);
            }
            return next;
          });
          setLoadingCount((c) => c - 1);
        })
        .catch(() => {
          if (abortRef.current) return;
          setCommitDiffs((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], loading: false };
            return next;
          });
          setLoadingCount((c) => c - 1);
        });
    });

    return () => { abortRef.current = true; };
  }, [isOpen, projectId, commits]);

  const handleClose = useCallback(() => {
    abortRef.current = true;
    setCommitDiffs([]);
    setOpenFiles(new Set());
    onClose();
  }, [onClose]);

  const toggleFile = useCallback((key: string) => {
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const allFileKeys = commitDiffs.flatMap((c, ci) => c.files.map((f, fi) => `${ci}:${fi}:${f.fileName}`));
  const allExpanded = allFileKeys.length > 0 && allFileKeys.every((k) => openFiles.has(k));

  const handleExpandCollapseAll = useCallback(() => {
    if (allExpanded) {
      setOpenFiles(new Set());
    } else {
      setOpenFiles(new Set(allFileKeys));
    }
  }, [allExpanded, allFileKeys]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      showClose={false}
      className="w-[50vw] min-w-[40vw] max-w-[80vw] h-[80vh] flex flex-col resize overflow-auto"
    >
      <div className="px-3 border-b border-border-default flex items-center gap-2 shrink-0 h-[48px]">
        <h3 className="flex-1 min-w-0 truncate flex items-center">
          <span className="text-[10px] text-text-tertiary font-semibold uppercase tracking-wide leading-none">
            All Changes
            <span className="ml-1.5 normal-case tracking-normal text-text-placeholder font-normal">
              ({commits.length} {commits.length === 1 ? 'commit' : 'commits'})
            </span>
          </span>
        </h3>
        {loadingCount > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-text-placeholder shrink-0">
            <Loader2Icon className="w-3 h-3 animate-spin" />
            {loadingCount} loading
          </span>
        )}
        {allFileKeys.length > 0 && (
          <button
            onClick={handleExpandCollapseAll}
            className="text-xs text-text-chrome hover:text-text-chrome-hover px-2 py-1 rounded border border-border-strong/50 shrink-0"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        )}
        <button
          onClick={handleClose}
          className="text-text-chrome hover:text-text-chrome-hover p-1 rounded hover:bg-surface-hover/50"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-auto min-h-0">
        {commitDiffs.map((commit, ci) => (
          <div key={commit.hash}>
            {/* Commit header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-2.5 border-b border-border-default bg-surface-modal">
              <GitCommitHorizontalIcon className="w-3.5 h-3.5 text-text-placeholder shrink-0" />
              <code className="text-[10px] font-mono text-text-chrome shrink-0">{commit.hash}</code>
              <span className="text-xs text-text-primary truncate flex-1 min-w-0">{commit.message.split('\n')[0]}</span>
              <span className="text-[10px] text-text-placeholder shrink-0">{commit.date}</span>
            </div>
            {commit.loading ? (
              <div className="flex items-center gap-2 px-5 py-3 text-text-placeholder">
                <Loader2Icon className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Loading diff...</span>
              </div>
            ) : commit.files.length > 0 ? (
              commit.files.map((file, fi) => {
                const key = `${ci}:${fi}:${file.fileName}`;
                return (
                  <FileDiffAccordion key={key} file={file} isOpen={openFiles.has(key)} onToggle={() => toggleFile(key)} />
                );
              })
            ) : (
              <div className="px-5 py-3 text-xs text-text-placeholder italic">No file changes</div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function FileStatSummary({ files }: { files: FileDiff[] }) {
  if (files.length === 0) return null;
  const counts = { added: 0, modified: 0, deleted: 0, renamed: 0 };
  for (const f of files) counts[f.status]++;
  const parts: { label: string; count: number; color: string }[] = [];
  if (counts.added) parts.push({ label: counts.added === 1 ? 'new file' : 'new files', count: counts.added, color: 'text-green-400' });
  if (counts.modified) parts.push({ label: 'modified', count: counts.modified, color: 'text-text-secondary' });
  if (counts.deleted) parts.push({ label: 'deleted', count: counts.deleted, color: 'text-red-400' });
  if (counts.renamed) parts.push({ label: 'renamed', count: counts.renamed, color: 'text-blue-400' });
  return (
    <div className="flex items-center gap-2 text-[11px] text-text-tertiary">
      <FileIcon className="w-3 h-3 text-text-tertiary shrink-0" />
      {parts.map((p, i) => (
        <span key={i} className={p.color}>
          {p.count} {p.label}
        </span>
      ))}
    </div>
  );
}
