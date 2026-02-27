import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { getProject } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

function gitRemoteToUrl(remote: string): string | null {
  const trimmed = remote.trim();

  // SSH: git@github.com:user/repo.git
  const sshMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
  if (sshMatch) return `https://${sshMatch[1]}/${sshMatch[2]}`;

  // HTTPS: https://github.com/user/repo.git
  const httpsMatch = trimmed.match(/^https?:\/\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return `https://${httpsMatch[1]}`;

  return null;
}

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const projectPath = project.path.replace(/^~/, process.env.HOME || "~");

  try {
    const remote = execSync("git remote get-url origin", {
      cwd: projectPath,
      encoding: "utf-8",
      timeout: 5000,
    });

    const url = gitRemoteToUrl(remote);
    if (!url) {
      return NextResponse.json({ error: "Could not parse remote URL" }, { status: 422 });
    }

    return NextResponse.json({ url });
  } catch {
    return NextResponse.json({ error: "No git remote found" }, { status: 404 });
  }
}
