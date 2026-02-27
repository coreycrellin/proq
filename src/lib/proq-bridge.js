#!/usr/bin/env node
// proq-bridge.js — Runs inside a tmux session, exposes the agent's PTY over a unix domain socket.
// Usage: node proq-bridge.js <socket-path> <launcher-script> [--json --jsonl <path>]
//
// PTY mode (default): xterm.js connects directly to the PTY for full terminal emulation.
// JSON mode (--json --jsonl <path>): Spawns the launcher (which redirects stdout to the jsonl file),
//   then tails the file and broadcasts new data over the socket.

const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const SCROLLBACK_LIMIT = 50 * 1024; // 50 KB ring buffer

const socketPath = process.argv[2];
const launcherScript = process.argv[3];

// Parse flags
let jsonMode = false;
let jsonlPath = null;
for (let i = 4; i < process.argv.length; i++) {
  if (process.argv[i] === "--json") jsonMode = true;
  if (process.argv[i] === "--jsonl" && process.argv[i + 1]) {
    jsonlPath = process.argv[++i];
  }
}

if (!socketPath || !launcherScript) {
  console.error("Usage: node proq-bridge.js <socket-path> <launcher-script> [--json --jsonl <path>]");
  process.exit(1);
}

// Clean up stale socket file
if (fs.existsSync(socketPath)) {
  fs.unlinkSync(socketPath);
}

// Ensure socket directory exists
fs.mkdirSync(path.dirname(socketPath), { recursive: true });

// Clean env: strip vars that cause issues
const env = { ...process.env };
delete env.CLAUDECODE;
delete env.PORT;
delete env.npm_config_prefix;
for (const key of Object.keys(env)) {
  if (key.startsWith("npm_")) delete env[key];
}

let scrollback = "";
const activeClients = new Set();
let processExited = false;
let exitCode = null;

// Unified process handle
let proc;

function handleData(data) {
  const str = typeof data === "string" ? data : data.toString();
  scrollback += str;
  if (scrollback.length > SCROLLBACK_LIMIT) {
    scrollback = scrollback.slice(-SCROLLBACK_LIMIT);
  }

  for (const client of activeClients) {
    if (!client.destroyed) {
      try { client.write(str); } catch {}
    }
  }
}

function handleExit(code) {
  processExited = true;
  exitCode = code;
  console.log(`[proq-bridge] process exited with code ${code}`);

  // Notify all connected clients
  for (const client of activeClients) {
    if (!client.destroyed) {
      try { client.write(JSON.stringify({ type: "exit", code }) + "\n"); } catch {}
    }
  }
}

if (jsonMode && jsonlPath) {
  // JSON mode: spawn the launcher (it redirects stdout to jsonlPath itself),
  // then tail the file to capture stream-json output.
  console.log(`[proq-bridge] starting in JSON mode (file tail: ${jsonlPath})`);

  // Ensure jsonl file exists (launcher will append to it)
  if (!fs.existsSync(jsonlPath)) {
    try { fs.writeFileSync(jsonlPath, "", "utf-8"); } catch {}
  }

  const child = spawn("bash", [launcherScript], {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "ignore", "ignore"],
  });

  // Pending reply support: after process exit, check for a .pending-reply file
  // and spawn a continuation process to handle it.
  const pendingReplyPath = jsonlPath.replace(/\.jsonl$/, ".pending-reply");
  let replyChild = null;

  function checkPendingReply() {
    if (replyChild) return; // already handling a reply
    if (!fs.existsSync(pendingReplyPath)) return;

    let message;
    try {
      message = fs.readFileSync(pendingReplyPath, "utf-8").trim();
      fs.unlinkSync(pendingReplyPath);
    } catch { return; }

    if (!message) return;

    // Extract session_id from jsonl for --resume
    let sessionId = null;
    try {
      const content = fs.readFileSync(jsonlPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.session_id) { sessionId = event.session_id; break; }
        } catch {}
      }
    } catch {}

    const claudeBin = process.env.CLAUDE_BIN || "claude";
    const resumeFlag = sessionId ? `--resume '${sessionId}'` : "-c";

    // Write reply prompt + launcher
    const promptDir = path.join(require("os").tmpdir(), "proq-prompts");
    try { fs.mkdirSync(promptDir, { recursive: true }); } catch {}
    const replyPromptFile = path.join(promptDir, `${path.basename(socketPath, ".sock")}-reply.md`);
    const replyLauncherFile = path.join(promptDir, `${path.basename(socketPath, ".sock")}-reply.sh`);
    fs.writeFileSync(replyPromptFile, message, "utf-8");
    fs.writeFileSync(
      replyLauncherFile,
      `#!/bin/bash\nexec env -u CLAUDECODE -u PORT ${claudeBin} ${resumeFlag} -p --verbose --output-format stream-json --dangerously-skip-permissions "$(cat '${replyPromptFile}')" >> '${jsonlPath}' 2>&1\n`,
      "utf-8",
    );

    // Reset processExited so clients know a new turn is active
    processExited = false;

    console.log(`[proq-bridge] spawning reply continuation (session: ${sessionId || "none"})`);
    replyChild = spawn("bash", [replyLauncherFile], {
      cwd: process.cwd(),
      env,
      stdio: ["ignore", "ignore", "ignore"],
    });

    replyChild.on("exit", (rCode) => {
      console.log(`[proq-bridge] reply process exited with code ${rCode}`);
      replyChild = null;
      // Do a final read then check for more pending replies or send exit
      setTimeout(() => {
        tailFile();
        if (fs.existsSync(pendingReplyPath)) {
          checkPendingReply();
        } else {
          handleExit(rCode);
        }
      }, 500);
    });
  }

  child.on("exit", (code) => {
    // Do a final read of the file to capture any remaining data
    setTimeout(() => {
      tailFile();
      // Check for pending reply before sending exit
      if (fs.existsSync(pendingReplyPath)) {
        checkPendingReply();
      } else {
        handleExit(code);
      }
    }, 500);
  });

  proc = {
    write: () => {},
    resize: () => {},
    kill: () => {
      try { child.kill(); } catch {}
      if (replyChild) { try { replyChild.kill(); } catch {} }
    },
  };

  // Tail the jsonl file by polling for new content
  let fileOffset = 0;
  function tailFile() {
    try {
      const stat = fs.statSync(jsonlPath);
      if (stat.size > fileOffset) {
        const fd = fs.openSync(jsonlPath, "r");
        const buf = Buffer.alloc(stat.size - fileOffset);
        fs.readSync(fd, buf, 0, buf.length, fileOffset);
        fs.closeSync(fd);
        fileOffset = stat.size;
        handleData(buf.toString());
      }
    } catch {}
  }

  // Poll for new data and pending replies
  setInterval(() => {
    tailFile();
    if (processExited && !replyChild) checkPendingReply();
  }, 300);

} else if (jsonMode) {
  // Legacy JSON mode (fallback if no --jsonl): pipe-based capture
  console.log("[proq-bridge] starting in JSON mode (child_process.spawn)");
  const child = spawn("bash", [launcherScript], {
    cwd: process.cwd(),
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  child.stdout.on("data", handleData);
  child.stderr.on("data", handleData);
  child.on("exit", (code) => handleExit(code));

  proc = {
    write: () => {},
    resize: () => {},
    kill: () => { try { child.kill(); } catch {} },
  };
} else {
  // PTY mode: full terminal emulation via node-pty
  console.log("[proq-bridge] starting in PTY mode (node-pty)");
  const ptyModule = require(path.join(__dirname, "../../node_modules/node-pty"));
  const shell = ptyModule.spawn("bash", [launcherScript], {
    name: "xterm-256color",
    cols: 120,
    rows: 30,
    cwd: process.cwd(),
    env,
  });

  shell.onData(handleData);
  shell.onExit(({ exitCode: code }) => handleExit(code));

  proc = {
    write: (data) => { try { shell.write(data); } catch {} },
    resize: (cols, rows) => { try { shell.resize(cols, rows); } catch {} },
    kill: () => { try { shell.kill(); } catch {} },
  };
}

// Unix domain socket server
const server = net.createServer((client) => {
  console.log("[proq-bridge] client connected");

  activeClients.add(client);

  // Replay scrollback
  if (scrollback.length > 0) {
    try {
      client.write(scrollback);
    } catch {}
  }

  // If process already exited, notify immediately
  if (processExited) {
    try {
      client.write(JSON.stringify({ type: "exit", code: exitCode }) + "\n");
    } catch {}
  }

  // Forward client input to process
  let inputBuffer = "";
  client.on("data", (data) => {
    const str = data.toString();

    if (jsonMode) {
      // In JSON mode, handle resize and interrupt messages; ignore other input
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === "resize") return; // no-op for JSON mode
        if (parsed.type === "interrupt") {
          if (!processExited) {
            proc.kill();
          }
          return;
        }
      } catch {}
      return;
    }

    // PTY mode: handle mixed input (resize messages + terminal data)
    inputBuffer += str;

    while (inputBuffer.length > 0) {
      const jsonStart = inputBuffer.indexOf("{");
      if (jsonStart === -1) {
        if (!processExited) proc.write(inputBuffer);
        inputBuffer = "";
        break;
      }

      if (jsonStart > 0) {
        if (!processExited) proc.write(inputBuffer.slice(0, jsonStart));
        inputBuffer = inputBuffer.slice(jsonStart);
      }

      try {
        let braceDepth = 0;
        let jsonEnd = -1;
        for (let i = 0; i < inputBuffer.length; i++) {
          if (inputBuffer[i] === "{") braceDepth++;
          else if (inputBuffer[i] === "}") {
            braceDepth--;
            if (braceDepth === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }

        if (jsonEnd === -1) break;

        const jsonStr = inputBuffer.slice(0, jsonEnd);
        const parsed = JSON.parse(jsonStr);

        if (parsed.type === "resize" && parsed.cols && parsed.rows) {
          proc.resize(parsed.cols, parsed.rows);
          inputBuffer = inputBuffer.slice(jsonEnd);
          continue;
        }

        if (!processExited) proc.write(jsonStr);
        inputBuffer = inputBuffer.slice(jsonEnd);
      } catch {
        if (!processExited) proc.write("{");
        inputBuffer = inputBuffer.slice(1);
      }
    }
  });

  client.on("close", () => {
    console.log("[proq-bridge] client disconnected");
    activeClients.delete(client);
  });

  client.on("error", () => {
    activeClients.delete(client);
  });
});

server.listen(socketPath, () => {
  console.log(`[proq-bridge] listening on ${socketPath}`);
});

// Graceful shutdown: write scrollback to log file, clean up
function shutdown() {
  console.log("[proq-bridge] shutting down...");

  const logPath = socketPath + ".log";
  try {
    fs.writeFileSync(logPath, scrollback, "utf-8");
    console.log(`[proq-bridge] wrote scrollback to ${logPath}`);
  } catch (err) {
    console.error(`[proq-bridge] failed to write log:`, err);
  }

  try {
    fs.unlinkSync(socketPath);
  } catch {}

  // Clean up pending reply file (keep jsonl for potential follow-up replies)
  if (jsonlPath) {
    try { fs.unlinkSync(jsonlPath.replace(/\.jsonl$/, ".pending-reply")); } catch {}
  }

  if (!processExited) {
    proc.kill();
  }

  try { server.close(); } catch {}

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
