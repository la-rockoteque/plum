/**
 * Auto-update on session start.
 *
 * Plum is installed as a copy from its git marketplace; Claude Code records the installed commit in
 * installed_plugins.json. At SessionStart we compare it with the marketplace's `main` (git ls-remote, bounded
 * timeout, throttled) and then, per `updates.mode`:
 *   prompt (default) — tell the user and ask Claude to confirm with them before updating;
 *   silent           — update in a detached background process (personal/local opt-in only);
 *   off              — nothing.
 * Updating uses Claude Code's own `claude plugin marketplace update` + `claude plugin update`; the new version is
 * picked up by /reload-plugins or the next session. Nothing here may block or break session start.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from "fs";
import { join } from "path";
import { getConfig, type UpdateMode } from "./config.js";
import { HOME, PLUM_DATA_DIR, PLUM_REPO_DIR } from "./env.js";

const STATE_PATH = join(PLUM_DATA_DIR, "update-state.json");
const LS_REMOTE_TIMEOUT_MS = 3_000;
const HOUR_MS = 3_600_000;

export const pluginRoot = () => process.env.PLUM_PLUGIN_ROOT ?? PLUM_REPO_DIR;
const pluginsDir = () => process.env.CLAUDE_CODE_PLUGIN_CACHE_DIR
  ?? join(process.env.CLAUDE_CONFIG_DIR ?? join(HOME, ".claude"), "plugins");

// ─── registry lookup (pure) ──────────────────────────────────────────────────

export interface Install { id: string; marketplace: string; scope: string; sha: string }

export function findInstall(installed: unknown, root: string): Install | null {
  const plugins = (installed as { plugins?: Record<string, unknown[]> })?.plugins ?? {};
  for (const [id, entries] of Object.entries(plugins)) {
    for (const e of (entries ?? []) as { scope?: string; installPath?: string; gitCommitSha?: string }[]) {
      if (e.installPath && samePath(e.installPath, root) && e.gitCommitSha) {
        return { id, marketplace: id.split("@")[1] ?? "", scope: e.scope ?? "user", sha: e.gitCommitSha };
      }
    }
  }
  return null;
}

export function marketplaceUrl(known: unknown, name: string): string | null {
  const src = (known as Record<string, { source?: { source?: string; url?: string; repo?: string } }>)?.[name]?.source;
  if (src?.url) return src.url;
  if (src?.source === "github" && src.repo) return `https://github.com/${src.repo}.git`;
  return null;
}

function samePath(a: string, b: string): boolean {
  if (a === b) return true;
  try { return realpathSync(a) === realpathSync(b); } catch { return false; }
}

// ─── decision (pure) ─────────────────────────────────────────────────────────

export type UpdateAction = "none" | "ask" | "apply";

export function decideUpdate(o: {
  mode: UpdateMode; installedSha: string; remoteSha: string | null; env: Record<string, string | undefined>;
}): UpdateAction {
  const e = o.env;
  const disabled = (e.DISABLE_UPDATES || e.DISABLE_AUTOUPDATER || e.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC) && !e.FORCE_AUTOUPDATE_PLUGINS;
  if (o.mode === "off" || disabled || !o.remoteSha) return "none";
  if (o.remoteSha === o.installedSha) return "none";
  return o.mode === "silent" ? "apply" : "ask";
}

const short = (sha: string) => sha.slice(0, 7);

export function sessionStartOutput(action: UpdateAction, i: { installedSha: string; remoteSha: string; pluginRoot: string }) {
  const change = `${short(i.installedSha)} → ${short(i.remoteSha)}`;
  const cmd = `"${i.pluginRoot}/bin/plum" update --apply`;
  if (action === "ask") {
    return {
      systemMessage: `Plum update available (${change}).`,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext:
          `[Plum] A Plum update is available (${change}). At the start of your first reply, ask the user with ` +
          `AskUserQuestion whether to update Plum now (options: "Update now", "Not now"). Only if they choose ` +
          `"Update now", run ${cmd} and tell them the new version applies after /reload-plugins or in the next ` +
          `session. Then continue with their request. Don't ask again this session.`
      }
    };
  }
  if (action === "apply") {
    return { systemMessage: `Updating Plum in the background (${change}); it applies after /reload-plugins or next session.` };
  }
  return null;
}

// ─── side effects ────────────────────────────────────────────────────────────

interface UpdateState { lastCheck?: number; remoteSha?: string; applied?: { sha: string; at: number; ok: boolean; announced?: boolean } }

function readState(): UpdateState {
  try { return JSON.parse(readFileSync(STATE_PATH, "utf-8")); } catch { return {}; }
}
function writeState(s: UpdateState): void {
  mkdirSync(PLUM_DATA_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}
function readJson(path: string): unknown {
  try { return JSON.parse(readFileSync(path, "utf-8")); } catch { return null; }
}

function currentInstall(): (Install & { url: string | null }) | null {
  const install = findInstall(readJson(join(pluginsDir(), "installed_plugins.json")), pluginRoot());
  if (!install) return null;
  return { ...install, url: marketplaceUrl(readJson(join(pluginsDir(), "known_marketplaces.json")), install.marketplace) };
}

// Non-interactive, time-boxed `git ls-remote <url> refs/heads/main`.
export function lsRemote(url: string, ref = "refs/heads/main"): string | null {
  const p = Bun.spawnSync(["git", "ls-remote", url, ref], {
    timeout: LS_REMOTE_TIMEOUT_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=3" }
  });
  if (p.exitCode !== 0) return null;
  const sha = p.stdout.toString().trim().split(/\s+/)[0];
  return /^[0-9a-f]{40}$/.test(sha ?? "") ? sha : null;
}

function remoteSha(url: string, intervalHours: number, now: number): string | null {
  const state = readState();
  if (state.remoteSha && state.lastCheck && now - state.lastCheck < intervalHours * HOUR_MS) return state.remoteSha;
  const sha = lsRemote(url);
  writeState({ ...state, lastCheck: now, ...(sha ? { remoteSha: sha } : {}) });
  return sha ?? state.remoteSha ?? null;
}

// SessionStart hook. Prints at most one JSON object; prints nothing when there's nothing to say.
export function runUpdateCheck(): void {
  const install = currentInstall();
  if (!install?.url) return;                       // running from a checkout, or unknown marketplace
  const { updates } = getConfig();
  const state = readState();

  if (state.applied && !state.applied.announced) {
    writeState({ ...state, applied: { ...state.applied, announced: true } });
    if (state.applied.ok && state.applied.sha === install.sha) {
      console.log(JSON.stringify({ systemMessage: `Plum was updated to ${short(install.sha)} in the background.` }));
      return;
    }
  }

  const remote = updates.mode === "off" ? null : remoteSha(install.url, updates.checkIntervalHours, Date.now());
  const action = decideUpdate({ mode: updates.mode, installedSha: install.sha, remoteSha: remote, env: process.env });
  const out = remote ? sessionStartOutput(action, { installedSha: install.sha, remoteSha: remote, pluginRoot: pluginRoot() }) : null;
  if (!out) return;
  if (action === "apply") {
    Bun.spawn([join(pluginRoot(), "bin", "plum"), "update", "--apply", "--quiet"], { stdio: ["ignore", "ignore", "ignore"] }).unref();
  }
  console.log(JSON.stringify(out));
}

// `plum update [--apply] [--quiet]`: check now (ignores the throttle) and optionally update.
export function runUpdateCommand(argv: string[]): number {
  const apply = argv.includes("--apply");
  const quiet = argv.includes("--quiet");
  const say = (m: string) => { if (!quiet) console.log(m); };
  const install = currentInstall();
  if (!install) { say("[Plum] Not installed from a marketplace (running from a checkout?) — nothing to update."); return 0; }
  if (!install.url) { say(`[Plum] Can't find the URL of marketplace "${install.marketplace}".`); return 1; }

  const remote = lsRemote(install.url);
  writeState({ ...readState(), lastCheck: Date.now(), ...(remote ? { remoteSha: remote } : {}) });
  if (!remote) { say("[Plum] Couldn't reach the marketplace to check for updates."); return 1; }
  if (remote === install.sha) { say(`[Plum] Up to date (${short(remote)}).`); return 0; }
  say(`[Plum] Update available: ${short(install.sha)} → ${short(remote)}.`);
  if (!apply) return 0;

  const run = (args: string[]) => Bun.spawnSync(["claude", ...args], { stdout: quiet ? "ignore" : "inherit", stderr: quiet ? "ignore" : "inherit" }).exitCode === 0;
  const ok = run(["plugin", "marketplace", "update", install.marketplace])
          && run(["plugin", "update", install.id, "--scope", install.scope]);
  writeState({ ...readState(), applied: { sha: remote, at: Date.now(), ok } });
  say(ok ? "[Plum] Updated. Run /reload-plugins to use it now, or start a new session."
         : "[Plum] Update failed; run `claude plugin update " + install.id + "` to see why.");
  return ok ? 0 : 1;
}
