// Auto-update on session start: prompted by default, silent only by personal/local opt-in.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveConfig } from "./config.js";
import { findInstall, marketplaceUrl, decideUpdate, sessionStartOutput } from "./update.js";

const OLD = "1111111111111111111111111111111111111111";
const NEW = "2222222222222222222222222222222222222222";
const HOUR = 3_600_000;

// ── consent ──────────────────────────────────────────────────────────────────

test("update mode defaults to prompt", () => {
  expect(resolveConfig({}).updates).toEqual({ mode: "prompt", checkIntervalHours: 12 });
});

test("silent updates need a personal or local opt-in; a shared silent falls back to prompt", () => {
  expect(resolveConfig({ shared:   { updates: { mode: "silent" } } }).updates.mode).toBe("prompt");
  expect(resolveConfig({ personal: { updates: { mode: "silent" } } }).updates.mode).toBe("silent");
  expect(resolveConfig({ local:    { updates: { mode: "silent" } } }).updates.mode).toBe("silent");
});

test("a shared 'off' wins; personal or local can choose off or prompt too", () => {
  expect(resolveConfig({ shared: { updates: { mode: "off" } }, personal: { updates: { mode: "silent" } } }).updates.mode).toBe("off");
  expect(resolveConfig({ personal: { updates: { mode: "off" } } }).updates.mode).toBe("off");
  expect(resolveConfig({ personal: { updates: { mode: "nonsense" as never } } }).updates.mode).toBe("prompt");
});

// ── registry lookup ──────────────────────────────────────────────────────────

const installed = {
  version: 2,
  plugins: {
    "plum@plum": [{ scope: "project", installPath: "/cache/plum/plum/abc", gitCommitSha: OLD }],
    "other@x":   [{ scope: "user", installPath: "/cache/x/other/1.0.0", gitCommitSha: NEW }]
  }
};

test("findInstall matches this plugin's install path", () => {
  expect(findInstall(installed, "/cache/plum/plum/abc")).toEqual({ id: "plum@plum", marketplace: "plum", scope: "project", sha: OLD });
  expect(findInstall(installed, "/Users/dev/Plum")).toBeNull();          // running from a checkout
});

test("marketplaceUrl reads git and github sources", () => {
  expect(marketplaceUrl({ plum: { source: { source: "git", url: "git@host:me/plum.git" } } }, "plum")).toBe("git@host:me/plum.git");
  expect(marketplaceUrl({ gh: { source: { source: "github", repo: "me/plum" } } }, "gh")).toBe("https://github.com/me/plum.git");
  expect(marketplaceUrl({}, "plum")).toBeNull();
});

// ── decision ─────────────────────────────────────────────────────────────────

const base = { installedSha: OLD, remoteSha: NEW, lastCheck: 0, now: 100 * HOUR, intervalHours: 12, env: {} };

test("decideUpdate: up to date, off, disabled by env, prompt and silent", () => {
  expect(decideUpdate({ ...base, mode: "prompt", remoteSha: OLD })).toBe("none");
  expect(decideUpdate({ ...base, mode: "off" })).toBe("none");
  expect(decideUpdate({ ...base, mode: "prompt", env: { DISABLE_AUTOUPDATER: "1" } })).toBe("none");
  expect(decideUpdate({ ...base, mode: "prompt", env: { DISABLE_UPDATES: "1", FORCE_AUTOUPDATE_PLUGINS: "1" } })).toBe("ask");
  expect(decideUpdate({ ...base, mode: "prompt" })).toBe("ask");
  expect(decideUpdate({ ...base, mode: "silent" })).toBe("apply");
  expect(decideUpdate({ ...base, mode: "silent", remoteSha: null })).toBe("none");
});

test("prompt output tells the user and asks Claude to confirm before updating", () => {
  const out = sessionStartOutput("ask", { installedSha: OLD, remoteSha: NEW, pluginRoot: "/p" });
  expect(out?.systemMessage).toContain("1111111 → 2222222");
  expect(out?.hookSpecificOutput?.hookEventName).toBe("SessionStart");
  expect(out?.hookSpecificOutput?.additionalContext).toContain("AskUserQuestion");
  expect(out?.hookSpecificOutput?.additionalContext).toContain('"/p/bin/plum" update --apply');
});

// ── end to end: a local bare repo stands in for the GitLab marketplace ────────

let home = "", data = "", repo = "", plugins = "";

function git(cwd: string, ...args: string[]): string {
  const p = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (p.exitCode !== 0) throw new Error(p.stderr.toString());
  return p.stdout.toString().trim();
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "plum-update-"));
  data = join(home, "plum-data");
  plugins = join(home, "claude", "plugins");
  mkdirSync(data, { recursive: true });
  mkdirSync(plugins, { recursive: true });
  const work = join(home, "work");
  repo = join(home, "remote.git");
  git(home, "init", "-q", "--bare", "-b", "main", repo);
  git(home, "init", "-q", "-b", "main", work);
  writeFileSync(join(work, "a"), "1"); git(work, "add", "."); git(work, "commit", "-qm", "one");
  git(work, "push", "-q", repo, "main");
});

function pushSecondCommit(): string {
  const work = join(home, "work");
  writeFileSync(join(work, "a"), "2"); git(work, "commit", "-qam", "two"); git(work, "push", "-q", repo, "main");
  return git(work, "rev-parse", "HEAD");
}

function register(installedSha: string, installPath: string): void {
  writeFileSync(join(plugins, "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "plum@plum": [{ scope: "user", installPath, gitCommitSha: installedSha }] } }));
  writeFileSync(join(plugins, "known_marketplaces.json"), JSON.stringify({ plum: { source: { source: "git", url: repo } } }));
}

function check(pluginRoot: string, cfg: object = {}): string {
  writeFileSync(join(data, "config.json"), JSON.stringify(cfg));
  const p = Bun.spawnSync(["bun", join(import.meta.dir, "cli.ts"), "update-check"], {
    stdin: new TextEncoder().encode(JSON.stringify({ session_id: "s", source: "startup" })),
    env: { ...process.env, PLUM_DATA_DIR: data, CLAUDE_CODE_PLUGIN_CACHE_DIR: plugins, PLUM_PLUGIN_ROOT: pluginRoot, DISABLE_AUTOUPDATER: "", DISABLE_UPDATES: "" }
  });
  return p.stdout.toString().trim();
}

test("update-check is silent when the installed commit is current", () => {
  const head = git(join(home, "work"), "rev-parse", "HEAD");
  register(head, "/cache/plum/plum/x");
  expect(check("/cache/plum/plum/x")).toBe("");
});

test("update-check prompts when main has new commits, then throttles the network check", () => {
  const first = git(join(home, "work"), "rev-parse", "HEAD");
  register(first, "/cache/plum/plum/x");
  const second = pushSecondCommit();
  const out = JSON.parse(check("/cache/plum/plum/x"));
  expect(out.systemMessage).toContain(`${first.slice(0, 7)} → ${second.slice(0, 7)}`);
  const state = JSON.parse(readFileSync(join(data, "update-state.json"), "utf-8"));
  expect(state.remoteSha).toBe(second);

  // Within the interval the cached remote SHA is reused — still prompts, no new ls-remote needed.
  Bun.spawnSync(["rm", "-rf", repo]);
  expect(JSON.parse(check("/cache/plum/plum/x")).systemMessage).toContain(second.slice(0, 7));
});

test("update-check does nothing when running from a checkout (not installed from a marketplace)", () => {
  register(git(join(home, "work"), "rev-parse", "HEAD"), "/cache/plum/plum/x");
  pushSecondCommit();
  expect(check("/Users/dev/Plum")).toBe("");
  expect(existsSync(join(data, "update-state.json"))).toBe(false);
});
