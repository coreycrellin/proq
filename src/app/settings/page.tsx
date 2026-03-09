"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BotIcon,
  PaletteIcon,
  BellIcon,
  InfoIcon,
  CircleHelpIcon,
  PlusIcon,
  XIcon,
  SearchIcon,
  LoaderIcon,
  SmartphoneIcon,
  UsersIcon,
  TrashIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { ProqSettings, ClaudeAccount } from "@/lib/types";
import { Select } from "@/components/ui/select";

type SettingsSection =
  | "about"
  | "appearance"
  | "agent"
  | "accounts"
  | "notifications"
  | "mobile";

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "about", label: "About", icon: <InfoIcon className="w-4 h-4" /> },
  {
    id: "appearance",
    label: "Appearance",
    icon: <PaletteIcon className="w-4 h-4" />,
  },
  { id: "agent", label: "Agent", icon: <BotIcon className="w-4 h-4" /> },
  {
    id: "accounts",
    label: "Accounts",
    icon: <UsersIcon className="w-4 h-4" />,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: <BellIcon className="w-4 h-4" />,
  },
  {
    id: "mobile",
    label: "Mobile",
    icon: <SmartphoneIcon className="w-4 h-4" />,
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<ProqSettings | null>(null);
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("about");
  const [detectingBin, setDetectingBin] = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);
  const [mobileHttps, setMobileHttps] = useState(false);
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null);
  const [tunnelStarting, setTunnelStarting] = useState(false);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountDir, setNewAccountDir] = useState("");
  const [addingAccount, setAddingAccount] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const isScrollingTo = useRef(false);

  const checkTunnel = useCallback(() => {
    fetch("/api/tunnel")
      .then((res) => res.json())
      .then((data) => {
        setTunnelUrl(data.active ? data.url : null);
        setTunnelStarting(!!data.starting);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then(setSettings)
      .catch(console.error);
    fetch("/api/network-info")
      .then((res) => res.json())
      .then((data) => { setMobileUrl(data.url); setMobileHttps(!!data.https); })
      .catch(console.error);
    checkTunnel();
  }, [checkTunnel]);

  // Track which section is visible on scroll
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (isScrollingTo.current) return;

      const containerTop = container.scrollTop;
      let current: SettingsSection = "about";

      for (const section of SECTIONS) {
        const el = sectionRefs.current[section.id];
        if (el) {
          if (el.offsetTop - container.offsetTop <= containerTop + 100) {
            current = section.id;
          }
        }
      }
      setActiveSection(current);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = useCallback((id: SettingsSection) => {
    const el = sectionRefs.current[id];
    if (!el) return;

    setActiveSection(id);
    isScrollingTo.current = true;

    el.scrollIntoView({ block: "start" });

    requestAnimationFrame(() => {
      isScrollingTo.current = false;
    });
  }, []);

  const update = <K extends keyof ProqSettings>(
    key: K,
    value: ProqSettings[K],
  ) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);

    // Apply theme immediately
    if (key === "theme") {
      const isDark = value === "dark";
      document.documentElement.classList.toggle("dark", isDark);
      localStorage.setItem("theme", isDark ? "dark" : "light");
    }

    // Persist to API
    fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: value }),
    }).catch((e) => console.error("Failed to save setting:", e));
  };

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-tertiary text-sm">Loading settings...</div>
      </div>
    );
  }

  const webhooks = Array.isArray(settings.webhooks) ? settings.webhooks : [];

  return (
    <>
      {/* Top bar */}
      <header className="h-12 bg-surface-topbar border-b border-border-default flex items-center px-6 flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
      </header>

      {/* Sidebar + scrolling content */}
      <div className="flex-1 flex min-h-0">
        {/* Jump-to sidebar */}
        <nav className="w-48 flex-shrink-0 py-3 overflow-y-auto border-r border-border-default bg-surface-topbar">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollToSection(s.id)}
              className={`w-full flex items-center gap-2.5 px-4 py-1.5 text-xs relative ${
                activeSection === s.id
                  ? "text-text-primary bg-surface-hover/50"
                  : "text-text-tertiary hover:text-text-primary hover:bg-surface-hover/40"
              }`}
            >
              {activeSection === s.id && (
                <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-bronze-700 dark:bg-bronze-600" />
              )}
              {s.icon}
              {s.label}
            </button>
          ))}
        </nav>

        {/* All sections flow vertically */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-surface-deep">
          <div className="px-8 py-6 pb-[100px] max-w-2xl space-y-8">
            {/* About */}
            <section
              ref={(el) => {
                sectionRefs.current.about = el;
              }}
              id="settings-about"
            >
              <SectionHeading
                icon={<InfoIcon className="w-4 h-4" />}
                label="About"
              />
              <p className="text-sm text-text-secondary leading-relaxed mb-2">
                A task board that runs your coding agents. You write tasks,
                agents do the work, you review and merge. proq is a kanban
                board that launches CLI coding agents in tmux, one per task,
                against your actual codebase.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Internally it&apos;s a process manager — local, self-contained,
                no external services. It works with whatever agent config, MCPs,
                and subagents you already have.
              </p>
              <p className="text-xs text-text-tertiary mb-1">
                This is version 0.1.0
              </p>
              <p className="text-xs text-text-tertiary">
                Vibed with ♥ by{" "}
                <a
                  href="https://brian.online"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bronze-700 dark:text-bronze-400 hover:underline"
                >
                  brian.online
                </a>{" "}
                &mdash; 0xc00010ff on{" "}
                <a
                  href="https://x.com/0xc00010ff"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bronze-700 dark:text-bronze-400 hover:underline"
                >
                  X
                </a>{" "}
                and{" "}
                <a
                  href="https://github.com/0xc00010ff"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bronze-700 dark:text-bronze-400 hover:underline"
                >
                  GitHub
                </a>
              </p>
            </section>

            {/* Appearance */}
            <section
              ref={(el) => {
                sectionRefs.current.appearance = el;
              }}
              id="settings-appearance"
            >
              <SectionHeading
                icon={<PaletteIcon className="w-4 h-4" />}
                label="Appearance"
              />
              <div className="space-y-4">
                <Field label="Theme">
                  <Select
                    value={settings.theme}
                    onChange={(v) => update("theme", v as "dark" | "light")}
                    options={[
                      { value: "dark", label: "Dark" },
                      { value: "light", label: "Light" },
                    ]}
                  />
                </Field>
              </div>
            </section>

            {/* Agent */}
            <section
              ref={(el) => {
                sectionRefs.current.agent = el;
              }}
              id="settings-agent"
            >
              <SectionHeading
                icon={<BotIcon className="w-4 h-4" />}
                label="Agent"
              />
              <div className="space-y-4">
                <Field label="Coding agent">
                  <div className="flex items-center gap-2">
                    <div
                      className={`${inputClass} flex-1 opacity-50 cursor-not-allowed select-none`}
                    >
                      Claude Code
                    </div>
                    <Tooltip text="Currently built for Claude Code. Codex/OpenCode coming soon.">
                      <CircleHelpIcon className="w-4 h-4 text-text-tertiary" />
                    </Tooltip>
                  </div>
                </Field>
                <Field
                  label="Claude binary"
                  hint="Path to the Claude Code CLI. Auto-detect finds it from your shell profile, nvm, or homebrew."
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={settings.claudeBin}
                      onChange={(e) => update("claudeBin", e.target.value)}
                      placeholder="claude"
                      className={`${inputClassMono} flex-1`}
                    />
                    <button
                      onClick={async () => {
                        setDetectingBin(true);
                        setDetectMessage(null);
                        try {
                          const res = await fetch("/api/settings/detect-claude-bin", { method: "POST" });
                          const data = await res.json();
                          setSettings((s) => s ? { ...s, claudeBin: data.claudeBin } : s);
                          setDetectMessage(data.message);
                        } catch {
                          setDetectMessage("Detection failed");
                        } finally {
                          setDetectingBin(false);
                        }
                      }}
                      disabled={detectingBin}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs bg-surface-base border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover disabled:opacity-50"
                    >
                      {detectingBin ? (
                        <LoaderIcon className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <SearchIcon className="w-3.5 h-3.5" />
                      )}
                      Auto-detect
                    </button>
                  </div>
                  {detectMessage && (
                    <p className={`text-xs mt-1.5 ${detectMessage.startsWith("Found") ? "text-green-500" : "text-text-secondary"}`}>
                      {detectMessage}
                    </p>
                  )}
                </Field>
                <Field
                  label="Agent render mode"
                  hint="Chat shows a formatted chat window like Claude Code desktop. CLI shows a raw terminal running the Claude Code CLI."
                >
                  <Select
                    value={settings.agentRenderMode}
                    onChange={(v) =>
                      update("agentRenderMode", v as "cli" | "structured")
                    }
                    options={[
                      { value: "structured", label: "Chat" },
                      { value: "cli", label: "CLI" },
                    ]}
                  />
                </Field>
                {settings.agentRenderMode === "structured" && (
                  <Field
                    label="Show costs"
                    hint="Display a calculated hypothetical token cost per turn. If you're on the Claude subscription plan, you are not billed anything extra — this is just data returned by Claude."
                  >
                    <Toggle
                      checked={settings.showCosts}
                      onChange={(v) => update("showCosts", v)}
                    />
                  </Field>
                )}
              </div>
            </section>

            {/* Accounts */}
            <section
              ref={(el) => {
                sectionRefs.current.accounts = el;
              }}
              id="settings-accounts"
            >
              <SectionHeading
                icon={<UsersIcon className="w-4 h-4" />}
                label="Accounts"
              />
              <p className="text-xs text-text-tertiary mb-4">
                Configure multiple Claude accounts. Each account uses a separate config directory.
                Authenticate by running{" "}
                <code className="font-mono text-text-secondary bg-surface-inset px-1 rounded">
                  CLAUDE_CONFIG_DIR=&lt;path&gt; claude
                </code>{" "}
                in your terminal once. Then assign accounts to projects in project settings.
              </p>
              <div className="space-y-3">
                {(settings.claudeAccounts || []).map((account: ClaudeAccount) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-surface-inset border border-border-default"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">
                        {account.name}
                      </div>
                      <div className="text-xs font-mono text-text-tertiary truncate">
                        {account.configDir}
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch("/api/settings/accounts", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: account.id }),
                        });
                        setSettings((s) =>
                          s
                            ? {
                                ...s,
                                claudeAccounts: s.claudeAccounts.filter(
                                  (a) => a.id !== account.id,
                                ),
                              }
                            : s,
                        );
                      }}
                      className="p-1.5 rounded hover:bg-surface-hover text-text-tertiary hover:text-red-400"
                      title="Remove account"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {addingAccount ? (
                  <div className="p-3 rounded-lg bg-surface-inset border border-border-default space-y-2">
                    <input
                      type="text"
                      value={newAccountName}
                      onChange={(e) => {
                        setNewAccountName(e.target.value);
                        if (!newAccountDir || newAccountDir === `~/.claude-${newAccountName.toLowerCase().replace(/\s+/g, "-")}`) {
                          setNewAccountDir(
                            `~/.claude-${e.target.value.toLowerCase().replace(/\s+/g, "-")}`,
                          );
                        }
                      }}
                      placeholder="Account name (e.g. Work)"
                      className={`${inputClass}`}
                      autoFocus
                    />
                    <input
                      type="text"
                      value={newAccountDir}
                      onChange={(e) => setNewAccountDir(e.target.value)}
                      placeholder="Config directory (e.g. ~/.claude-work)"
                      className={`${inputClassMono}`}
                    />
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          if (!newAccountName.trim() || !newAccountDir.trim())
                            return;
                          const res = await fetch("/api/settings/accounts", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              name: newAccountName.trim(),
                              configDir: newAccountDir.trim(),
                            }),
                          });
                          if (res.ok) {
                            const account: ClaudeAccount = await res.json();
                            setSettings((s) =>
                              s
                                ? {
                                    ...s,
                                    claudeAccounts: [
                                      ...s.claudeAccounts,
                                      account,
                                    ],
                                  }
                                : s,
                            );
                            setNewAccountName("");
                            setNewAccountDir("");
                            setAddingAccount(false);
                          }
                        }}
                        disabled={
                          !newAccountName.trim() || !newAccountDir.trim()
                        }
                        className="px-3 py-1.5 rounded-md text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => {
                          setAddingAccount(false);
                          setNewAccountName("");
                          setNewAccountDir("");
                        }}
                        className="px-3 py-1.5 rounded-md text-xs bg-surface-base border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingAccount(true)}
                    className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary py-1"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    Add account
                  </button>
                )}
              </div>
            </section>

            {/* Notifications */}
            <section
              ref={(el) => {
                sectionRefs.current.notifications = el;
              }}
              id="settings-notifications"
            >
              <SectionHeading
                icon={<BellIcon className="w-4 h-4" />}
                label="Notifications"
              />
              <p className="text-xs text-text-tertiary italic mb-4">
                Notifications coming soon.
              </p>
              <div className="space-y-4 opacity-50 pointer-events-none select-none">
                <Field label="Sounds">
                  <Toggle
                    checked={settings.soundNotifications}
                    onChange={(v) => update("soundNotifications", v)}
                  />
                </Field>
                <Field label="Local notifications">
                  <Toggle
                    checked={settings.localNotifications}
                    onChange={(v) => update("localNotifications", v)}
                  />
                </Field>
                <Field label="Webhooks" hint="URLs to notify on task events.">
                  <div className="space-y-2">
                    {webhooks.map((url, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={url}
                          readOnly
                          className={`${inputClassMono} flex-1`}
                        />
                        <button
                          className="p-1.5 rounded hover:bg-surface-hover text-text-secondary"
                          tabIndex={-1}
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary py-1">
                      <PlusIcon className="w-3.5 h-3.5" />
                      Add webhook
                    </button>
                  </div>
                </Field>
              </div>
            </section>

            {/* Mobile */}
            <section
              ref={(el) => {
                sectionRefs.current.mobile = el;
              }}
              id="settings-mobile"
            >
              <SectionHeading
                icon={<SmartphoneIcon className="w-4 h-4" />}
                label="Mobile Companion"
              />
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                Scan this QR code with your phone to open the mobile companion.
                Make sure your phone and computer are on the same WiFi network.
              </p>

              {/* Tunnel controls for voice dictation */}
              <Field
                label="Voice dictation"
                hint="Start a secure tunnel to enable voice dictation on your phone. No certificates or server restart needed."
              >
                {tunnelUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
                      <span className="text-sm text-emerald font-medium">Tunnel running</span>
                    </div>
                    <div className="flex flex-col items-center gap-3 py-3">
                      <div className="bg-white p-3 rounded-xl">
                        <QRCodeSVG
                          value={tunnelUrl}
                          size={160}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#000000"
                        />
                      </div>
                      <code className="text-xs text-bronze-400 font-mono bg-surface-inset px-2.5 py-1.5 rounded-md border border-border-default select-all break-all text-center max-w-full">
                        {tunnelUrl}
                      </code>
                    </div>
                    <button
                      onClick={async () => {
                        await fetch("/api/tunnel", { method: "DELETE" });
                        setTunnelUrl(null);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs bg-surface-base border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                      Stop Tunnel
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={async () => {
                        setTunnelStarting(true);
                        setTunnelError(null);
                        try {
                          const res = await fetch("/api/tunnel", { method: "POST" });
                          const data = await res.json();
                          if (res.ok && data.url) {
                            setTunnelUrl(data.url);
                            setTunnelStarting(false);
                            return;
                          }
                          if (!res.ok) {
                            setTunnelError(data.error || "Failed to start tunnel");
                            setTunnelStarting(false);
                            return;
                          }
                          // Still starting — poll GET until ready
                          const poll = setInterval(async () => {
                            try {
                              const r = await fetch("/api/tunnel");
                              const d = await r.json();
                              if (d.active && d.url) {
                                clearInterval(poll);
                                setTunnelUrl(d.url);
                                setTunnelStarting(false);
                              } else if (d.error) {
                                clearInterval(poll);
                                setTunnelError(d.error);
                                setTunnelStarting(false);
                              } else if (!d.starting) {
                                clearInterval(poll);
                                setTunnelError("Tunnel process exited unexpectedly");
                                setTunnelStarting(false);
                              }
                            } catch { /* keep polling */ }
                          }, 1000);
                          setTimeout(() => {
                            clearInterval(poll);
                            setTunnelStarting((s) => {
                              if (s) setTunnelError("Tunnel took too long to start");
                              return false;
                            });
                          }, 60000);
                        } catch {
                          setTunnelError("Network error");
                          setTunnelStarting(false);
                        }
                      }}
                      disabled={tunnelStarting}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {tunnelStarting ? (
                        <><LoaderIcon className="w-3.5 h-3.5 animate-spin" /> Starting tunnel...</>
                      ) : (
                        'Start Tunnel'
                      )}
                    </button>
                    {tunnelError && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                        <p className="text-xs text-red-400">{tunnelError}</p>
                        {tunnelError.includes("not found") && (
                          <p className="text-xs text-text-tertiary mt-1">
                            Install it with: <code className="font-mono text-text-secondary bg-surface-inset px-1 rounded">brew install cloudflared</code>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Field>

              {/* QR code for local network access */}
              <div className="mt-6">
                <p className="text-xs text-text-tertiary mb-3 font-medium uppercase tracking-wider">Local Network</p>
                {mobileUrl ? (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <div className="bg-white p-4 rounded-xl">
                      <QRCodeSVG
                        value={mobileUrl}
                        size={180}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-text-tertiary mb-1">Local URL (no voice dictation):</p>
                      <code className="text-xs text-bronze-400 font-mono bg-surface-inset px-2.5 py-1 rounded-md border border-border-default select-all">
                        {mobileUrl}
                      </code>
                    </div>
                    {mobileHttps && (
                      <div className="mt-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20 max-w-md">
                        <p className="text-xs text-green-400 font-medium">HTTPS enabled — voice dictation ready</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-text-tertiary">Detecting network address...</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Shared styles ──

const inputClass =
  "w-full bg-surface-inset border border-border-default rounded-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-lazuli";

const inputClassMono =
  inputClass +
  " font-mono placeholder:text-text-placeholder";

// ── Reusable components ──

function SectionHeading({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border-default">
      <span className="text-text-tertiary">{icon}</span>
      <h2 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
        {label}
      </h2>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary mb-1">
        {label}
      </label>
      {hint && (
        <p className="text-xs text-text-tertiary mb-2">{hint}</p>
      )}
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked
          ? "bg-bronze-700 dark:bg-bronze-600"
          : "bg-zinc-300 dark:bg-border-strong"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Tooltip({
  text,
  children,
}: {
  text: string;
  children: React.ReactNode;
}) {
  return (
    <span className="relative group">
      {children}
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded bg-surface-modal border border-border-default text-xs text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
        {text}
      </span>
    </span>
  );
}
