#!/usr/bin/env node
// proq-bridge.js — Runs inside a tmux session, exposes the agent's PTY over a unix domain socket.
// Usage: node proq-bridge.js <socket-path> <launcher-script> [--json]
//
// PTY mode (default): xterm.js connects directly to the PTY for full terminal emulation.
// JSON mode (--json): Uses child_process.spawn for clean stdout (no PTY wrapping artifacts).
//   Designed for `claude --output-format stream-json` where output is newline-delimited JSON.

const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const SCROLLBACK_LIMIT = 50 * 1024; // 50 KB ring buffer

const socketPath = process.argv[2];
const launcherScript = process.argv[3];
const jsonMode = process.argv[4] === "--json";

if (!socketPath || !launcherScript) {
  console.error("Usage: node proq-bridge.js <socket-path> <launcher-script> [--json]");
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

if (jsonMode) {
  // JSON mode: use child_process.spawn for clean stdout (no PTY line wrapping)
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
    write: () => {}, // no interactive input in JSON mode
    resize: () => {}, // no terminal to resize
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
      // In JSON mode, only handle resize messages; ignore other input
      try {
        const parsed = JSON.parse(str);
        if (parsed.type === "resize") return; // no-op for JSON mode
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

  if (!processExited) {
    proc.kill();
  }

  try { server.close(); } catch {}

  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
