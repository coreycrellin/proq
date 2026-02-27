import { NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import { getCommitHistory, GitCommit } from "@/lib/worktree";

import { TimelineBullet, TimelineWeek, TimelineData } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

// ── Week grouping helpers ────────────────────────────────
function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface WeekBucket {
  key: string;
  startDate: Date;
  endDate: Date;
  commits: GitCommit[];
  authors: Set<string>;
}

function groupCommitsByWeek(commits: GitCommit[]): WeekBucket[] {
  const map = new Map<string, WeekBucket>();

  for (const commit of commits) {
    const monday = getMonday(new Date(commit.date));
    const key = toISODate(monday);

    if (!map.has(key)) {
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      map.set(key, {
        key,
        startDate: monday,
        endDate: sunday,
        commits: [],
        authors: new Set(),
      });
    }

    const bucket = map.get(key)!;
    bucket.commits.push(commit);
    bucket.authors.add(commit.author);
  }

  return Array.from(map.values()).sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );
}

// ── Summarization ────────────────────────────────────────
function summarizeWeeks(weekBuckets: WeekBucket[]): TimelineWeek[] {
  return weekBuckets.map((w) => fallbackWeek(w));
}

// ── Smart fallback (no Claude) ───────────────────────────
// Groups commits into coherent stories by detecting shared keywords/themes

function fallbackWeek(w: WeekBucket): TimelineWeek {
  const commits = w.commits;

  // 1. Cluster commits by shared significant words
  const stories = clusterCommits(commits);

  // 2. Generate a bullet for each story with per-bullet authors
  const bullets: TimelineBullet[] = stories.map((story) => {
    const authors = [...new Set(story.commits.map((c) => c.author))];
    return {
      text:
        story.commits.length === 1
          ? story.commits[0].message
          : `${story.label} (${story.commits.length} commits)`,
      authors,
      commits: story.commits.length,
    };
  });

  // 3. Detect types from commit messages
  const types = detectTypes(commits);

  // 4. Detect milestones
  const hasMilestone = commits.some(
    (c) =>
      /\b(ship|release|deploy|launch|v\d)/i.test(c.message) ||
      /\btag\b/i.test(c.message),
  );

  return {
    weekStart: toISODate(w.startDate),
    weekEnd: toISODate(w.endDate),
    commitCount: commits.length,
    authors: Array.from(w.authors),
    bullets,
    types,
    hasMilestone,
  };
}

interface CommitStory {
  label: string;
  commits: GitCommit[];
}

// Noise words to ignore when clustering
const NOISE = new Set([
  "a", "an", "the", "in", "on", "of", "to", "for", "and", "or", "with",
  "from", "by", "at", "up", "is", "it", "be", "as", "do", "so", "if",
  "no", "not", "into", "when", "that", "this", "all", "new", "more",
]);

function extractKeywords(msg: string): string[] {
  // Strip conventional commit prefixes like "feat:", "fix(scope):"
  const cleaned = msg.replace(/^\w+(\([^)]*\))?:\s*/, "");
  return cleaned
    .toLowerCase()
    .split(/[\s/\-_,.;:!?()[\]{}]+/)
    .filter((w) => w.length > 2 && !NOISE.has(w) && !/^\d+$/.test(w));
}

function clusterCommits(commits: GitCommit[]): CommitStory[] {
  if (commits.length <= 3) {
    // Few commits — just list each one
    return commits.map((c) => ({ label: c.message, commits: [c] }));
  }

  // Build keyword → commit indices
  const kwToCommits = new Map<string, number[]>();
  const commitKeywords: string[][] = [];

  for (let i = 0; i < commits.length; i++) {
    const kws = extractKeywords(commits[i].message);
    commitKeywords.push(kws);
    for (const kw of kws) {
      if (!kwToCommits.has(kw)) kwToCommits.set(kw, []);
      kwToCommits.get(kw)!.push(i);
    }
  }

  // Score keywords: prefer those that appear in multiple commits but not all
  const scored: [string, number][] = [];
  for (const [kw, indices] of kwToCommits) {
    if (indices.length >= 2 && indices.length < commits.length * 0.8) {
      scored.push([kw, indices.length]);
    }
  }
  scored.sort((a, b) => b[1] - a[1]);

  // Greedily assign commits to stories by best keyword
  const assigned = new Set<number>();
  const stories: CommitStory[] = [];

  for (const [keyword] of scored) {
    if (stories.length >= 12) break;
    const indices = kwToCommits.get(keyword)!.filter((i) => !assigned.has(i));
    if (indices.length < 2) continue;

    // Find the most descriptive commit message as the label
    let bestMsg = "";
    let bestScore = 0;
    for (const idx of indices) {
      const msg = commits[idx].message;
      const score = msg.length + (msg.includes(keyword) ? 10 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestMsg = msg;
      }
    }

    for (const idx of indices) assigned.add(idx);
    stories.push({ label: bestMsg, commits: indices.map((i) => commits[i]) });
  }

  // Remaining unassigned commits — group as individual bullets (up to a few)
  const remaining = commits.filter((_, i) => !assigned.has(i));
  const remainCap = Math.max(0, 12 - stories.length);
  for (const c of remaining.slice(0, remainCap)) {
    stories.push({ label: c.message, commits: [c] });
  }
  if (remaining.length > remainCap) {
    stories.push({
      label: `${remaining.length - remainCap} other changes`,
      commits: remaining.slice(remainCap),
    });
  }

  // Sort stories: most commits first
  stories.sort((a, b) => b.commits.length - a.commits.length);

  return stories;
}

function detectTypes(commits: GitCommit[]): string[] {
  const types = new Set<string>();
  for (const c of commits) {
    const msg = c.message.toLowerCase();
    if (/^feat|add|implement|create|new\b/i.test(msg)) types.add("feature");
    if (/^fix|hotfix|bugfix|patch|resolve/i.test(msg)) types.add("fix");
    if (/ci|cd|pipeline|deploy|docker|infra|build/i.test(msg)) types.add("infra");
    if (/chore|deps|upgrade|update|refactor|clean|lint|format|merge/i.test(msg)) types.add("chore");
  }
  if (types.size === 0) types.add("chore");
  return Array.from(types);
}

// ── Route handler ────────────────────────────────────────
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const commits = getCommitHistory(project.path, 1000);
    if (commits.length === 0) {
      return NextResponse.json({
        weeks: [],
        generatedAt: new Date().toISOString(),
      } satisfies TimelineData);
    }

    const weekBuckets = groupCommitsByWeek(commits);
    const weeks = summarizeWeeks(weekBuckets);

    return NextResponse.json({
      weeks,
      generatedAt: new Date().toISOString(),
    } satisfies TimelineData);
  } catch (err) {
    console.error("[timeline] Error:", err);
    return NextResponse.json(
      { error: "Failed to generate timeline" },
      { status: 500 },
    );
  }
}
