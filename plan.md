# Remote Mobile Access — Beyond WiFi

## Problem

Current mobile access requires either:
1. **Same WiFi** — scan QR pointing at `https://192.168.x.x:1337/mobile`
2. **Cloudflare quick tunnel** — must be at computer to click "Start Tunnel", URL is ephemeral/random each time

Neither works when you're away from home and want to check on your agents from your phone.

## Goal

Phone opens proq from anywhere (cellular, coffee shop, etc.) with a **stable, bookmarkable URL** and zero friction after initial setup.

---

## Approach: Named Cloudflare Tunnel (recommended)

**Why this wins:** You already have `cloudflared` integrated. The jump from quick tunnels to named tunnels is small but transforms the experience — you get a **permanent subdomain** that never changes.

### How it works

1. One-time setup: `cloudflared tunnel create proq` → generates a tunnel ID + credentials file
2. proq auto-starts the named tunnel on `npm run dev` (or on-demand from settings)
3. Tunnel routes `proq.{your-domain}.com` (or a free `*.cfargotunnel.com` subdomain) → `localhost:1337`
4. QR code in settings always shows the same URL — scan once, bookmark forever
5. Phone works from anywhere with internet

### What changes

#### 1. Settings UI — "Remote Access" section (replaces current tunnel UI)

```
┌─ Remote Access ──────────────────────────────┐
│                                               │
│  Status: ● Connected                          │
│  URL: https://proq.yourdomain.com/mobile      │
│                                               │
│  ┌─────────┐                                  │
│  │ QR CODE │  ← always the same URL           │
│  └─────────┘                                  │
│                                               │
│  [ ] Auto-start on launch                     │
│  [Stop Tunnel]                                │
│                                               │
│  ─── First-time setup ───                     │
│  Requires: cloudflared + Cloudflare account   │
│  [Run Setup Wizard]                           │
│                                               │
└───────────────────────────────────────────────┘
```

#### 2. New API: `/api/tunnel` enhancements

**Config stored in** `data/tunnel.json`:
```json
{
  "tunnelId": "abc-123-...",
  "tunnelName": "proq",
  "credentialsPath": "~/.cloudflared/abc-123.json",
  "hostname": "proq.yourdomain.com",  // or null for *.cfargotunnel.com
  "autoStart": true
}
```

**New endpoints:**
- `POST /api/tunnel/setup` — runs `cloudflared tunnel create proq`, stores config
- Enhanced `POST /api/tunnel` — uses named tunnel config instead of quick tunnel
- `GET /api/tunnel` — returns status + **stable URL** (not ephemeral)

**Named tunnel launch command:**
```bash
cloudflared tunnel --config /tmp/proq-tunnel.yml run proq
```

Where the config YAML is generated at runtime:
```yaml
tunnel: abc-123-...
credentials-file: ~/.cloudflared/abc-123.json
ingress:
  - hostname: proq.yourdomain.com
    service: http://localhost:1337
  - service: http_status:404
```

#### 3. Auto-start on dev server launch

If `autoStart: true` in tunnel config, start the named tunnel when the Next.js server boots. Two options:

- **Option A**: Start in the existing `tunnel/route.ts` on first API hit (lazy)
- **Option B**: Use a Next.js instrumentation hook (`src/instrumentation.ts`) to start on server boot ← cleaner

#### 4. Mobile app — offline/reconnect handling

Since remote access means less reliable connections:
- Show connection status indicator (already have WiFi indicator in MobileShell — extend it)
- Queue actions when offline, replay on reconnect
- SSE auto-reconnect with backoff (EventSource does this natively, just handle the UI)

---

## Implementation steps

### Step 1: Tunnel config persistence
- Add `tunnelConfig` to `data/tunnel.json` (read/write helpers in `src/lib/db.ts` or a new `src/lib/tunnel-config.ts`)
- Fields: `tunnelId`, `tunnelName`, `credentialsPath`, `hostname`, `autoStart`

### Step 2: Setup wizard API
- `POST /api/tunnel/setup` — shells out to `cloudflared tunnel create proq`
- Parses output for tunnel ID and credentials path
- If user has a domain configured in Cloudflare, also runs `cloudflared tunnel route dns proq proq.domain.com`
- Stores config to `data/tunnel.json`
- Falls back to quick tunnel mode if no Cloudflare account (current behavior stays as fallback)

### Step 3: Enhanced tunnel start/stop
- Modify `POST /api/tunnel` to check for named tunnel config first
- If config exists: generate temp YAML config, run `cloudflared tunnel run proq`
- If no config: fall back to current quick tunnel behavior (backwards compatible)
- URL is now deterministic — read from config, not parsed from stderr

### Step 4: Auto-start via instrumentation
- `src/instrumentation.ts` — on server register, check tunnel config
- If `autoStart: true` and config exists, start the tunnel process
- Store process handle for cleanup on shutdown

### Step 5: Settings UI update
- Refactor Mobile section to show "Remote Access" with stable URL + QR when configured
- Add "Setup Wizard" flow for first-time named tunnel creation
- Keep current quick tunnel as a "Simple mode" fallback
- Add auto-start toggle

### Step 6: Connection resilience on mobile
- Enhance MobileShell connection indicator for remote scenarios
- Add visual feedback when SSE disconnects/reconnects

---

## Alternatives considered

### Tailscale
- Install Tailscale on computer + phone → access via `100.x.y.z:1337`
- Pros: Very secure, zero-config networking, works everywhere
- Cons: Requires Tailscale app on phone, another service to manage, no shareable URL
- Verdict: Great for power users but higher setup friction than extending existing cloudflared

### WebSocket relay (Cloudflare Worker)
- Deploy a tiny Worker that bridges phone ↔ proq via WebSocket
- Pros: No cloudflared needed, works through any NAT
- Cons: Need to deploy + maintain a relay, latency, complexity
- Verdict: Over-engineered for a personal tool

### ngrok
- Similar to Cloudflare tunnel but paid for stable URLs
- Verdict: No advantage over Cloudflare when you already have cloudflared

---

## Scope

- Builds entirely on existing `cloudflared` integration
- Backwards compatible — quick tunnel still works as fallback
- No new external dependencies
- ~4 files to modify, ~2 new files
