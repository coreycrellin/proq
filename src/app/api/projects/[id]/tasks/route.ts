import { NextResponse } from "next/server";
import { getAllTasks, createTask, getProject, updateTask } from "@/lib/db";
import { isSessionAlive, processQueue, scheduleCleanup } from "@/lib/agent-dispatch";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const columns = await getAllTasks(id);

  // Detect orphaned tasks: dispatch is "running" but tmux session is dead
  const inProgress = columns["in-progress"] || [];
  let hasOrphans = false;
  for (const task of inProgress) {
    if ((task.dispatch === "running" || task.dispatch === "starting") && !isSessionAlive(task.id)) {
      console.log(`[orphan-detect] task ${task.id.slice(0, 8)} has dispatch="${task.dispatch}" but tmux session is dead — moving to verify`);
      await updateTask(id, task.id, { status: "verify", dispatch: null });
      scheduleCleanup(id, task.id);
      hasOrphans = true;
    }
  }

  // If we fixed orphans, re-read tasks and process the queue for next task
  if (hasOrphans) {
    await processQueue(id);
    const fresh = await getAllTasks(id);
    return NextResponse.json(fresh);
  }

  return NextResponse.json(columns);
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const title = body.title ?? "";
  const description = body.description ?? "";

  const task = await createTask(id, { title, description });
  return NextResponse.json(task, { status: 201 });
}
