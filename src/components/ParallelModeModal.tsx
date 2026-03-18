'use client';

import React from 'react';
import { ConfirmModal } from '@/components/Modal';

interface ParallelModeModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ParallelModeModal({ isOpen, onConfirm, onCancel }: ParallelModeModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onConfirm={onConfirm}
      onCancel={onCancel}
      title="Parallel Mode"
      confirmLabel="Got it"
    >
      <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
        <p>
          All tasks run <strong className="text-zinc-900 dark:text-zinc-100">directly in your project directory</strong> — like having multiple terminal windows open, each with its own Claude instance.
        </p>
        <p>
          No separate branches or worktrees are created. All changes go straight to your local working copy.
        </p>
      </div>
    </ConfirmModal>
  );
}
