import { NextResponse } from "next/server";
import { getAllProjects, getAllTasks } from "@/lib/db";

export async function GET() {
  const projects = await getAllProjects();
  const results: {
    projectId: string;
    projectName: string;
    projectPath: string;
    task: Awaited<ReturnType<typeof getAllTasks>>[number];
  }[] = [];

  for (const project of projects) {
    const tasks = await getAllTasks(project.id);
    for (const task of tasks) {
      if (task.status === "in-progress") {
        results.push({
          projectId: project.id,
          projectName: project.name,
          projectPath: project.path,
          task,
        });
      }
    }
  }

  return NextResponse.json({ tasks: results });
}
