// Regression tests for the wave-1 security review. Each test names the attack it blocks.
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, symlinkSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { resolveConfig } from "./config.js";
import { openerCommand } from "./feedback.js";
import { marketplaceUrl } from "./update.js";
import { isSafeRef, isSafeRepoUrl, isSafeRelativePath, isSafeSegment } from "./library-cache.js";

const CLI = join(import.meta.dir, "cli.ts");

function git(cwd: string, ...args: string[]): string {
  const p = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (p.exitCode !== 0) throw new Error(p.stderr.toString());
  return p.stdout.toString().trim();
}

// ── input validation ─────────────────────────────────────────────────────────

test("path segments, relative paths, refs and repo URLs are validated", () => {
  for (const bad of ["..", "../x", "a/b", "", ".hidden", "-rf", "a\\b"]) expect(isSafeSegment(bad)).toBe(false);
  expect(isSafeSegment("unit-of-work")).toBe(true);

  for (const bad of ["../../.ssh/id_rsa", "/etc/passwd", "a/../../b", "a\\b", "", "a//b"]) expect(isSafeRelativePath(bad)).toBe(false);
  expect(isSafeRelativePath("src/main/kotlin/example/dry/after/Order.kt")).toBe(true);

  for (const bad of ["--upload-pack=touch PWN", "-x", "a b", "main;rm", ""]) expect(isSafeRef(bad)).toBe(false);
  expect(isSafeRef("main")).toBe(true);
  expect(isSafeRef("0123456789abcdef0123456789abcdef01234567")).toBe(true);

  for (const bad of ["--upload-pack=x", "ext::sh -c x", "fd::3", "file:///etc", "http://x/y.git", "-oProxyCommand=x"]) expect(isSafeRepoUrl(bad)).toBe(false);
  for (const good of ["git@git.nexapptech.com:vbernier/plum.git", "https://gitlab.com/a/b.git", "ssh://git@host/a/b.git"]) expect(isSafeRepoUrl(good)).toBe(true);
});

test("marketplaceUrl refuses option-like URLs from the registry", () => {
  expect(marketplaceUrl({ plum: { source: { source: "git", url: "--upload-pack=touch PWN" } } }, "plum")).toBeNull();
});

// ── trust boundaries ─────────────────────────────────────────────────────────

test("a shared (committed) config can't redirect where example code is fetched from", () => {
  const cfg = resolveConfig({ shared: { library: { repoUrl: "git@evil.example:x/y.git", ref: "evil", cacheMaxMb: 5 } } });
  expect(cfg.library.repoUrl).toBeUndefined();
  expect(cfg.library.ref).toBe("main");
  expect(cfg.library.cacheMaxMb).toBe(5);                    // harmless keys still apply
  expect(resolveConfig({ personal: { library: { repoUrl: "git@mirror:plum.git" } } }).library.repoUrl).toBe("git@mirror:plum.git");
});

test("a committed config.local.json is treated as shared, not personal", () => {
  const project = mkdtempSync(join(tmpdir(), "plum-committed-local-"));
  const data = mkdtempSync(join(tmpdir(), "plum-committed-data-"));
  git(project, "init", "-q");
  mkdirSync(join(project, ".plum"));
  writeFileSync(join(project, ".plum", "config.local.json"), JSON.stringify({ telemetry: { enabled: true }, updates: { mode: "silent" } }));
  git(project, "add", "."); git(project, "commit", "-qm", "sneaky");
  const p = Bun.spawnSync(["bun", CLI, "stats", "status"], { env: { ...process.env, PLUM_DATA_DIR: data, CLAUDE_PROJECT_DIR: project } });
  expect(p.stdout.toString()).toContain("Usage statistics: off");
});

// ── Windows opener ───────────────────────────────────────────────────────────

test("the Windows browser opener never goes through cmd", () => {
  const url = "https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.1=a&calc.exe";
  const cmd = openerCommand("win32", url);
  expect(cmd[0]).not.toBe("cmd");
  expect(cmd.at(-1)).toBe(url);
  expect(openerCommand("darwin", url)).toEqual(["open", url]);
  expect(openerCommand("linux", url)).toEqual(["xdg-open", url]);
});

// ── end to end: hostile manifests and trees ──────────────────────────────────

function installedPlugin(manifest: object, repo: string, sha: string, extra?: (dir: string) => void) {
  const home = mkdtempSync(join(tmpdir(), "plum-hostile-"));
  const root = join(home, "cache", "plum", "plum", "v1");
  const concept = join(root, "library", "concepts", "evil");
  mkdirSync(concept, { recursive: true });
  writeFileSync(join(concept, "concept.json"), JSON.stringify(manifest));
  const plugins = join(home, "claude", "plugins");
  mkdirSync(plugins, { recursive: true });
  writeFileSync(join(plugins, "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "plum@plum": [{ scope: "user", installPath: root, gitCommitSha: sha }] } }));
  writeFileSync(join(plugins, "known_marketplaces.json"), JSON.stringify({ plum: { source: { source: "git", url: repo } } }));
  const data = join(home, "data");
  mkdirSync(data, { recursive: true });
  const canary = join(home, "canary.txt");
  writeFileSync(canary, "still here");
  extra?.(home);
  const run = (...args: string[]) => {
    const p = Bun.spawnSync(["bun", CLI, "library", ...args], {
      env: { ...process.env, PLUM_DATA_DIR: data, PLUM_PLUGIN_ROOT: root, CLAUDE_CODE_PLUGIN_CACHE_DIR: plugins }
    });
    return { out: p.stdout.toString() + p.stderr.toString(), code: p.exitCode ?? 0 };
  };
  return { home, data, canary, run };
}

test("a manifest language key like '../../..' can't make the cache delete anything outside it", () => {
  const { canary, data, run } = installedPlugin(
    { id: "evil", examples: { "../../..": { stages: { after: ["x"] }, tests: [], run: "x" } } },
    "git@example.invalid:x.git", "0".repeat(40)
  );
  const r = run("fetch", "evil");
  expect(r.code).not.toBe(0);
  expect(r.out).toContain("Invalid");
  expect(existsSync(canary)).toBe(true);
  expect(existsSync(data)).toBe(true);
});

test("manifest file paths can't escape the example directory", () => {
  const { run, canary } = installedPlugin(
    { id: "evil", examples: { go: { stages: { after: ["../../../../canary.txt"] }, tests: [], run: "x" } } },
    "git@example.invalid:x.git", "0".repeat(40)
  );
  const r = run("fetch", "evil", "--lang", "go");
  expect(r.code).not.toBe(0);
  expect(r.out).toContain("Invalid");
  expect(existsSync(canary)).toBe(true);
});

test("symlinks in the fetched tree are refused, not copied into the cache", () => {
  const home = mkdtempSync(join(tmpdir(), "plum-symlink-src-"));
  const work = join(home, "work"), repo = join(home, "remote.git");
  mkdirSync(join(work, "library", "examples", "go"), { recursive: true });
  symlinkSync("/etc/hosts", join(work, "library", "examples", "go", "leak.go"));
  git(home, "init", "-q", "--bare", "-b", "main", repo);
  git(home, "init", "-q", "-b", "main", work);
  git(work, "add", "."); git(work, "commit", "-qm", "x"); git(work, "push", "-q", repo, "main");
  const sha = git(work, "rev-parse", "HEAD");

  const { run, data } = installedPlugin({ id: "evil", examples: { go: { stages: { after: ["leak.go"] }, tests: [], run: "x" } } }, repo, sha);
  const r = run("fetch", "evil", "--lang", "go");
  expect(r.code).not.toBe(0);
  const cache = join(data, "library-cache", "evil", "go");
  expect(existsSync(cache) ? readdirSync(cache) : []).toEqual([]);
});
