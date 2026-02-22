import { NextResponse } from "next/server";
import { peekDeletedTask, restoreDeletedTask } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

/** Peek at the most recent undoable deletion (read-only, does not restore). */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const entry = await peekDeletedTask(id);
  if (!entry) {
    return NextResponse.json({ error: "Nothing to undo" }, { status: 404 });
  }
  return NextResponse.json({ task: entry.task, column: entry.column });
}

/** Confirm restore: actually re-insert the task into its column. */
export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  const entry = await restoreDeletedTask(id);
  if (!entry) {
    return NextResponse.json({ error: "Nothing to undo" }, { status: 404 });
  }
  return NextResponse.json({ task: entry.task, column: entry.column });
}
