import { NextResponse } from "next/server";
import { getProject } from "@/lib/db";
import {
  getCurrentBranch,
  listBranches,
  checkoutBranch,
  refreshDetachedHead,
} from "@/lib/worktree";

type Params = { params: Promise<{ id: string }> };

function resolveProjectPath(path: string): string {
  return path.replace(/^~/, process.env.HOME || "~");
}

/** GET — current branch + all local branches */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectPath = resolveProjectPath(project.path);
  const current = getCurrentBranch(projectPath);
  const branches = listBranches(projectPath);

  return NextResponse.json({
    current: current.branch,
    detached: current.detached,
    branches,
  });
}

/** POST — switch branch */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const { branch } = await request.json();
  if (!branch || typeof branch !== "string") {
    return NextResponse.json(
      { error: "branch is required" },
      { status: 400 },
    );
  }

  const projectPath = resolveProjectPath(project.path);
  try {
    checkoutBranch(projectPath, branch);
    const result = getCurrentBranch(projectPath);
    return NextResponse.json({
      current: result.branch,
      detached: result.detached,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH — refresh detached HEAD (for polling) */
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const projectPath = resolveProjectPath(project.path);
  const current = getCurrentBranch(projectPath);

  if (!current.detached || !current.branch.startsWith("proq/")) {
    return NextResponse.json({
      current: current.branch,
      detached: current.detached,
      updated: false,
    });
  }

  const updated = refreshDetachedHead(projectPath, current.branch);
  const after = getCurrentBranch(projectPath);

  return NextResponse.json({
    current: after.branch,
    detached: after.detached,
    updated,
  });
}
