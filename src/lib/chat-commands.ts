import type { TaskAttachment } from "./types";

/**
 * Check if the input text is a slash command and handle it.
 * Returns true if the command was handled (caller should clear input),
 * false if it's a normal message.
 */
export async function handleChatCommand(
  text: string,
  addAttachments: (attachments: TaskAttachment[]) => void,
): Promise<boolean> {
  const trimmed = text.trim().toLowerCase();

  if (trimmed === "/atr") {
    const res = await fetch("/api/desktop-recent-image");
    if (!res.ok) return true; // command handled, but no image found
    const attachment: TaskAttachment = await res.json();
    addAttachments([attachment]);
    return true;
  }

  if (trimmed === "/att") {
    const res = await fetch("/api/desktop-file-picker");
    if (!res.ok) return true;
    const attachments: TaskAttachment[] = await res.json();
    if (attachments.length > 0) {
      addAttachments(attachments);
    }
    return true;
  }

  return false;
}
