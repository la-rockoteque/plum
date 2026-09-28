// Streaming example code on demand, with a garbage-collected cache that keeps frequently used concepts.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { planEviction, type CacheEntry } from "./library-cache.js";

const DAY = 86_400_000;
const entry = (key: string, o: Partial<CacheEntry> = {}): CacheEntry =>
  ({ key, sha: "a", bytes: 1_000, lastUsed: 100 * DAY, uses: 1, pinned: false, ...o });

// ── eviction policy (pure) ───────────────────────────────────────────────────

test("evicts entries unused past the TTL", () => {
  const now = 100 * DAY;
  const evict = planEviction([entry("old", { lastUsed: now - 40 * DAY }), entry("new", { lastUsed: now - DAY })],
    { maxBytes: 1e9, ttlDays: 30, keepAfterUses: 3, now });
  expect(evict).toEqual(["old"]);
});

test("evicts least recently used first until under the size cap", () => {
  const now = 100 * DAY;
  const entries = [
    entry("a", { lastUsed: now - 3 * DAY }),
    entry("b", { lastUsed: now - 1 * DAY }),
    entry("c", { lastUsed: now - 2 * DAY })
  ];
  expect(planEviction(entries, { maxBytes: 1_500, ttlDays: 30, keepAfterUses: 3, now })).toEqual(["a", "c"]);
});

test("keeps concepts used repeatedly, and ones pinned by hand, even when stale or over the cap", () => {
  const now = 100 * DAY;
  const entries = [
    entry("favourite", { uses: 5, lastUsed: now - 60 * DAY }),
    entry("pinned", { pinned: true, lastUsed: now - 60 * DAY }),
    entry("once", { lastUsed: now - DAY })
  ];
  expect(planEviction(entries, { maxBytes: 10, ttlDays: 30, keepAfterUses: 3, now })).toEqual(["once"]);
});

test("evicts entries from another plugin version first", () => {
  const now = 100 * DAY;
  const entries = [entry("current", { sha: "new", lastUsed: now - 5 * DAY }), entry("stale", { sha: "old", lastUsed: now, uses: 9 })];
  expect(planEviction(entries, { maxBytes: 1e9, ttlDays: 30, keepAfterUses: 3, now, sha: "new" })).toEqual(["stale"]);
});

// ── end to end: a local bare repo stands in for the GitLab repo ──────────────

let home = "", data = "", repo = "", pluginRoot = "", sha = "";

function git(cwd: string, ...args: string[]): string {
  const p = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (p.exitCode !== 0) throw new Error(p.stderr.toString());
  return p.stdout.toString().trim();
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "plum-libcache-"));
  data = join(home, "data");
  repo = join(home, "remote.git");
  const work = join(home, "work");
  mkdirSync(join(work, "library", "examples", "go", "dry", "after"), { recursive: true });
  mkdirSync(join(work, "library", "examples", "python", "src", "dry"), { recursive: true });
  mkdirSync(join(work, "library", "examples", "python", "tests"), { recursive: true });
  writeFileSync(join(work, "library", "examples", "go", "dry", "after", "order.go"), "package after\n");
  writeFileSync(join(work, "library", "examples", "python", "src", "dry", "after.py"), "RULE = 1\n");
  writeFileSync(join(work, "library", "examples", "python", "tests", "test_dry.py"), "def test_x(): pass\n");
  writeFileSync(join(work, "library", "examples", "python", "src", "dry", "unrelated_big.py"), "x = 1\n".repeat(5000));
  git(home, "init", "-q", "--bare", "-b", "main", repo);
  git(home, "init", "-q", "-b", "main", work);
  git(work, "add", "."); git(work, "commit", "-qm", "examples");
  git(work, "push", "-q", repo, "main");
  sha = git(work, "rev-parse", "HEAD");

  // An installed plugin copy: manifests only, no examples.
  pluginRoot = join(home, "cache", "plum", "plum", sha.slice(0, 12));
  const concept = join(pluginRoot, "library", "concepts", "dry");
  mkdirSync(concept, { recursive: true });
  writeFileSync(join(concept, "concept.json"), JSON.stringify({
    id: "dry", examples: {
      python: { stages: { before: [], after: ["src/dry/after.py"] }, tests: ["tests/test_dry.py"], run: "pytest" },
      go:     { stages: { before: [], after: ["dry/after/order.go"] }, tests: [], run: "go test" }
    }
  }));
  const plugins = join(home, "claude", "plugins");
  mkdirSync(plugins, { recursive: true });
  writeFileSync(join(plugins, "installed_plugins.json"), JSON.stringify({ version: 2, plugins: { "plum@plum": [{ scope: "user", installPath: pluginRoot, gitCommitSha: sha }] } }));
  writeFileSync(join(plugins, "known_marketplaces.json"), JSON.stringify({ plum: { source: { source: "git", url: repo } } }));
});

function plum(...args: string[]): { out: string; code: number } {
  const p = Bun.spawnSync(["bun", join(import.meta.dir, "cli.ts"), "library", ...args], {
    env: { ...process.env, PLUM_DATA_DIR: data, PLUM_PLUGIN_ROOT: pluginRoot, CLAUDE_CODE_PLUGIN_CACHE_DIR: join(home, "claude", "plugins") }
  });
  return { out: p.stdout.toString() + p.stderr.toString(), code: p.exitCode ?? 0 };
}

test("fetch streams only the concept's files for one language, pinned to the installed commit", () => {
  const r = plum("fetch", "dry", "--lang", "python");
  expect(r.code).toBe(0);
  const dir = r.out.split("\n").find((l) => l.startsWith("/"))!;
  expect(readFileSync(join(dir, "src/dry/after.py"), "utf-8")).toBe("RULE = 1\n");
  expect(existsSync(join(dir, "tests/test_dry.py"))).toBe(true);
  expect(existsSync(join(dir, "src/dry/unrelated_big.py"))).toBe(false);
  expect(existsSync(join(dir, "..", "go"))).toBe(false);
});

test("a second fetch is served from the cache and counts the use; repeated use pins it", () => {
  plum("fetch", "dry", "--lang", "python");
  Bun.spawnSync(["rm", "-rf", repo]);                  // no network needed any more
  expect(plum("fetch", "dry", "--lang", "python").code).toBe(0);
  plum("fetch", "dry", "--lang", "python");
  const status = plum("status").out;
  expect(status).toContain("dry/python");
  expect(status).toContain("uses 3");
  expect(status).toContain("kept");
});

test("gc removes evictable entries and clear empties the cache", () => {
  mkdirSync(data, { recursive: true });
  writeFileSync(join(data, "config.json"), JSON.stringify({ library: { cacheMaxMb: 0 } }));
  plum("fetch", "dry", "--lang", "go");
  expect(plum("status").out).toContain("dry/go");      // the files just asked for stay until the next gc
  plum("fetch", "dry", "--lang", "python");             // gc runs before each fetch: go is over a 0 MB cap
  const status = plum("status").out;
  expect(status).toMatch(/dry\/go .*evicted/);
  expect(status).toMatch(/dry\/python .*cached/);
  expect(plum("clear").code).toBe(0);
  expect(plum("status").out).toContain("empty");
});

test("fetch of an unknown concept or language fails clearly", () => {
  expect(plum("fetch", "nope").out).toContain("Unknown concept");
  expect(plum("fetch", "dry", "--lang", "cobol").out).toContain("no cobol example");
});
