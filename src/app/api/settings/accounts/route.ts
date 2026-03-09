import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import type { ClaudeAccount } from "@/lib/types";

// GET /api/settings/accounts — list all accounts
export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings.claudeAccounts);
}

// POST /api/settings/accounts — create account
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, configDir } = body as { name?: string; configDir?: string };

  if (!name || !configDir) {
    return NextResponse.json(
      { error: "name and configDir are required" },
      { status: 400 },
    );
  }

  const account: ClaudeAccount = {
    id: uuidv4(),
    name: name.trim(),
    configDir: configDir.trim(),
  };

  const settings = await getSettings();
  const accounts = [...settings.claudeAccounts, account];
  await updateSettings({ claudeAccounts: accounts });

  return NextResponse.json(account, { status: 201 });
}

// DELETE /api/settings/accounts — remove account by id
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body as { id?: string };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const settings = await getSettings();
  const accounts = settings.claudeAccounts.filter((a) => a.id !== id);
  await updateSettings({ claudeAccounts: accounts });

  return NextResponse.json({ ok: true });
}
