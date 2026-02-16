import { NextResponse } from "next/server";
import { execSync } from "child_process";

export async function POST() {
  try {
    const script = `
      set chosenFolder to choose folder with prompt "Select a project folder"
      return POSIX path of chosenFolder
    `;
    const result = execSync(`osascript -e '${script}'`, {
      encoding: "utf-8",
      timeout: 60000,
    }).trim();

    // Remove trailing slash
    const folderPath = result.endsWith("/") ? result.slice(0, -1) : result;
    const folderName = folderPath.split("/").pop() || folderPath;

    return NextResponse.json({ path: folderPath, name: folderName });
  } catch {
    // User cancelled the dialog or error occurred
    return NextResponse.json({ cancelled: true });
  }
}
