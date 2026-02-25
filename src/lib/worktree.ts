import { execSync } from "child_process";
import { existsSync, readFileSync, appendFileSync } from "fs";
import { join } from "path";

const WORKTREE_DIR = ".proq-worktrees";

export function createWorktree(
  projectPath: string,
  shortId: string,
): string {
  ensureGitignore(projectPath);
  const worktreePath = join(projectPath, WORKTREE_DIR, shortId);
  const branch = `proq/${shortId}`;
  execSync(
    `git -C '${projectPath}' worktree add '${WORKTREE_DIR}/${shortId}' -b '${branch}'`,
    { timeout: 30_000 },
  );
  console.log(`[worktree] created ${worktreePath} on branch ${branch}`);
  return worktreePath;
}

export function removeWorktree(
  projectPath: string,
  shortId: string,
): void {
  const branch = `proq/${shortId}`;
  try {
    execSync(
      `git -C '${projectPath}' worktree remove '${WORKTREE_DIR}/${shortId}' --force`,
      { timeout: 15_000 },
    );
    console.log(`[worktree] removed worktree for ${shortId}`);
  } catch (err) {
    console.error(`[worktree] failed to remove worktree for ${shortId}:`, err);
  }
  try {
    execSync(`git -C '${projectPath}' branch -D '${branch}'`, {
      timeout: 10_000,
    });
    console.log(`[worktree] deleted branch ${branch}`);
  } catch {
    // Branch may already be gone
  }
}

export function mergeWorktree(
  projectPath: string,
  shortId: string,
): { success: boolean; error?: string; conflictFiles?: string[] } {
  const branch = `proq/${shortId}`;
  try {
    execSync(
      `git -C '${projectPath}' merge '${branch}' --no-ff -m 'Merge ${branch}'`,
      { timeout: 30_000 },
    );
    console.log(`[worktree] merged ${branch} into main`);
    removeWorktree(projectPath, shortId);
    return { success: true };
  } catch (err) {
    // Capture conflicting file list before aborting
    let conflictFiles: string[] = [];
    try {
      const output = execSync(
        `git -C '${projectPath}' diff --name-only --diff-filter=U`,
        { timeout: 10_000, encoding: "utf-8" },
      );
      conflictFiles = output.trim().split("\n").filter(Boolean);
    } catch {
      // May fail if merge didn't leave conflicts
    }

    // Abort the failed merge
    try {
      execSync(`git -C '${projectPath}' merge --abort`, { timeout: 10_000 });
    } catch {
      // merge --abort can fail if there's nothing to abort
    }
    const message =
      err instanceof Error ? err.message : "Unknown merge error";
    console.error(`[worktree] merge failed for ${branch}:`, message);
    return {
      success: false,
      error: `Merge conflict merging ${branch}`,
      conflictFiles,
    };
  }
}

export function getCurrentBranch(
  projectPath: string,
): { branch: string; detached: boolean } {
  try {
    const branch = execSync(
      `git -C '${projectPath}' rev-parse --abbrev-ref HEAD`,
      { timeout: 10_000, encoding: "utf-8" },
    ).trim();

    if (branch !== "HEAD") {
      return { branch, detached: false };
    }

    // Detached HEAD — try to find which proq/* ref we're on
    const refs = execSync(
      `git -C '${projectPath}' log -1 --format=%D HEAD`,
      { timeout: 10_000, encoding: "utf-8" },
    ).trim();

    // Format: "HEAD, proq/abc12345" or "HEAD -> main, origin/main"
    const parts = refs.split(",").map((s) => s.trim());
    for (const part of parts) {
      const cleaned = part.replace(/^HEAD\s*->\s*/, "");
      if (cleaned.startsWith("proq/")) {
        return { branch: cleaned, detached: true };
      }
    }

    return { branch: "HEAD", detached: true };
  } catch {
    return { branch: "main", detached: false };
  }
}

export function listBranches(projectPath: string): string[] {
  try {
    const output = execSync(
      `git -C '${projectPath}' branch --list --format='%(refname:short)'`,
      { timeout: 10_000, encoding: "utf-8" },
    );
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return ["main"];
  }
}

const PROQ_STASH_MSG = "proq-auto-stash";

export function checkoutBranch(
  projectPath: string,
  branch: string,
): void {
  // Check if working tree is dirty and stash if needed
  const status = execSync(
    `git -C '${projectPath}' status --porcelain`,
    { timeout: 10_000, encoding: "utf-8" },
  ).trim();

  const needsStash = status.length > 0;
  if (needsStash) {
    execSync(
      `git -C '${projectPath}' stash push -m '${PROQ_STASH_MSG}'`,
      { timeout: 15_000 },
    );
    console.log("[git] auto-stashed dirty working tree");
  }

  try {
    if (branch.startsWith("proq/")) {
      // Detached checkout to avoid conflict with worktree holding the branch
      execSync(
        `git -C '${projectPath}' checkout --detach '${branch}'`,
        { timeout: 15_000 },
      );
    } else {
      execSync(
        `git -C '${projectPath}' checkout '${branch}'`,
        { timeout: 15_000 },
      );
    }
    console.log(`[git] checked out ${branch}`);
  } catch (err) {
    // On failure, try to pop stash if we pushed one
    if (needsStash) {
      try {
        execSync(`git -C '${projectPath}' stash pop`, { timeout: 10_000 });
      } catch { /* stash pop may fail */ }
    }
    throw err;
  }

  // Pop auto-stash if we pushed one and we're now on a regular branch
  if (needsStash && !branch.startsWith("proq/")) {
    try {
      // Check if the top stash is ours
      const stashMsg = execSync(
        `git -C '${projectPath}' stash list -1 --format=%s`,
        { timeout: 10_000, encoding: "utf-8" },
      ).trim();
      if (stashMsg.includes(PROQ_STASH_MSG)) {
        execSync(`git -C '${projectPath}' stash pop`, { timeout: 10_000 });
        console.log("[git] popped auto-stash");
      }
    } catch {
      console.error("[git] failed to pop auto-stash");
    }
  }
}

export function refreshDetachedHead(
  projectPath: string,
  branch: string,
): boolean {
  try {
    const headHash = execSync(
      `git -C '${projectPath}' rev-parse HEAD`,
      { timeout: 10_000, encoding: "utf-8" },
    ).trim();

    const branchHash = execSync(
      `git -C '${projectPath}' rev-parse '${branch}'`,
      { timeout: 10_000, encoding: "utf-8" },
    ).trim();

    if (headHash === branchHash) return false;

    execSync(
      `git -C '${projectPath}' checkout --detach '${branch}'`,
      { timeout: 15_000 },
    );
    console.log(`[git] refreshed detached HEAD to ${branch} tip`);
    return true;
  } catch {
    return false;
  }
}

export function ensureGitignore(projectPath: string): void {
  const gitignorePath = join(projectPath, ".gitignore");
  try {
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, "utf-8");
      if (content.includes(WORKTREE_DIR)) return;
      appendFileSync(gitignorePath, `\n${WORKTREE_DIR}\n`, "utf-8");
    } else {
      appendFileSync(gitignorePath, `${WORKTREE_DIR}\n`, "utf-8");
    }
    console.log(`[worktree] added ${WORKTREE_DIR} to .gitignore`);
  } catch (err) {
    console.error(`[worktree] failed to update .gitignore:`, err);
  }
}
