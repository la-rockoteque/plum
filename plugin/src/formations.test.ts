// Formations: concept → module matching, and a sparse fetch that never brings solutions.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { matchFormations, sparsePatterns, type Formation } from "./formations.js";

const formation = (repoUrl: string, ref: string): Formation => ({
  title: "Formation Architecture backend", repoUrl, ref, root: "curricula/backend/architecture",
  languages: ["python", "go"], modules: { "01-repository": ["repository", "test-doubles"], "03-cqrs": ["cqrs"] }
});

test("match finds the module that teaches a concept, and nothing for an unmapped one", () => {
  const all = { "architecture-backend": formation("/r", "main") };
  expect(matchFormations("repository", all)).toEqual([
    { id: "architecture-backend", title: "Formation Architecture backend", module: "01-repository", languages: ["python", "go"] }
  ]);
  expect(matchFormations("dry", all)).toEqual([]);
});

// ── end to end: a local bare repo stands in for formation-frontend ──────────

let home = "", pluginRoot = "";

function git(cwd: string, ...args: string[]): string {
  const p = Bun.spawnSync(["git", ...args], { cwd, env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
  if (p.exitCode !== 0) throw new Error(p.stderr.toString());
  return p.stdout.toString().trim();
}

function write(base: string, files: string[]): void {
  for (const f of files) { mkdirSync(join(base, f, ".."), { recursive: true }); writeFileSync(join(base, f), f); }
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "plum-formations-"));
  const repo = join(home, "remote.git"), work = join(home, "work");
  const c = "curricula/backend/architecture";
  write(work, ["CLAUDE.md", ".claude/settings.json", ".claude/skills/start/SKILL.md", "learner/.gitkeep",
    `${c}/curriculum.md`, `${c}/modules/01-repository.md`, `${c}/questions/repository.md`, `${c}/docs/stack.md`,
    `${c}/project/go/main.go`, `${c}/project/python/main.py`, `${c}/solutions/01-repository.md`,
    "curricula/backend/modules/sql/01-sql.md", "curricula/frontend/react/curriculum.md", "curricula/frontend/modules/testing-library/07-testing.md"]);
  git(home, "init", "-q", "--bare", "-b", "main", repo);
  git(home, "init", "-q", "-b", "main", work);
  git(work, "add", "."); git(work, "commit", "-qm", "formation");
  git(work, "push", "-q", repo, "main");
  pluginRoot = join(home, "plugin");
  mkdirSync(join(pluginRoot, "library"), { recursive: true });
  writeFileSync(join(pluginRoot, "library", "formations.json"),
    JSON.stringify({ "architecture-backend": formation(repo, git(work, "rev-parse", "HEAD")) }));
});

function plum(...args: string[]): { out: string; code: number } {
  const p = Bun.spawnSync(["bun", join(import.meta.dir, "cli.ts"), "formations", ...args], {
    env: { ...process.env, PLUM_DATA_DIR: join(home, "data"), PLUM_PLUGIN_ROOT: pluginRoot }
  });
  return { out: p.stdout.toString() + p.stderr.toString(), code: p.exitCode ?? 0 };
}

test("fetch checks out the coach, one language's curriculum and its domain's shared modules, never solutions", () => {
  const dest = join(home, "learn");
  const r = plum("fetch", "architecture-backend", "--lang", "go", "--dir", dest);
  expect(r.code).toBe(0);
  const c = join(dest, "curricula/backend/architecture");
  for (const f of ["CLAUDE.md", ".claude/skills/start/SKILL.md", "learner/.gitkeep"]) expect(existsSync(join(dest, f))).toBe(true);
  for (const f of ["curriculum.md", "modules/01-repository.md", "questions/repository.md", "docs/stack.md", "project/go/main.go"]) {
    expect(existsSync(join(c, f))).toBe(true);
  }
  expect(existsSync(join(c, "solutions"))).toBe(false);
  expect(existsSync(join(c, "project/python"))).toBe(false);
  expect(existsSync(join(dest, "curricula/backend/modules/sql/01-sql.md"))).toBe(true);
  expect(existsSync(join(dest, "curricula/frontend"))).toBe(false);
  expect(r.out).toContain(`cd '${dest}'\nclaude\n`);
});

test("fetch hands off with commands that survive a path with spaces and quotes", () => {
  const dest = join(home, "it's mine");
  const r = plum("fetch", "architecture-backend", "--dir", dest);
  expect(r.code).toBe(0);
  expect(r.out).toContain(`cd '${dest.replace("'", "'\\''")}'\nclaude\n`);
});

test("fetch refuses a non-empty folder and leaves it untouched", () => {
  const dest = join(home, "busy");
  mkdirSync(dest); writeFileSync(join(dest, "mine.txt"), "keep");
  const r = plum("fetch", "architecture-backend", "--dir", dest);
  expect(r.code).toBe(1);
  expect(r.out).toContain("isn't empty");
  expect(readdirSync(dest)).toEqual(["mine.txt"]);
});

test("fetch rejects a language the formation has no starter for", () => {
  const r = plum("fetch", "architecture-backend", "--lang", "kotlin", "--dir", join(home, "k"));
  expect(r.code).toBe(1);
  expect(r.out).toContain("available: python, go");
  expect(existsSync(join(home, "k"))).toBe(false);
});

test("a formation with a single starter fetches the whole project/, still without solutions", () => {
  const f = formation("/r", "main");
  const single: Formation = { title: f.title, repoUrl: f.repoUrl, ref: f.ref, root: f.root, modules: f.modules };
  expect(sparsePatterns(single)).toContain("/curricula/backend/architecture/project/");
  expect(sparsePatterns(single).some((p) => p.includes("solutions"))).toBe(false);
});

test("fetch brings the extra files a formation includes from a sibling track", () => {
  const f: Formation = { ...formation("/r", "main"), include: ["curricula/frontend/react/docs/practices.md"] };
  expect(sparsePatterns(f)).toContain("/curricula/frontend/react/docs/practices.md");
});
