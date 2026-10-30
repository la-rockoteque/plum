// IDE events: what an editor extension saw the user do, sent as JSON on stdin to `plum ide-event`.
// The extension never opens the DB. Plum validates each event, links it to the session for that workspace and keeps
// only what scoring needs: a debugger type, a test runner name, a file and a line count. Never commands or contents.
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "fs";
import { isAbsolute, join, resolve } from "path";
import { getDb } from "./db.js";
import { PLUM_DATA_DIR, PLUGIN_ROOT } from "./env.js";
import { TEST_FILE_RE } from "./worktree.js";

export type IdeEventKind = "debug" | "test" | "edit";

const DEBUG_TYPE_RE = /^[\w.-]{1,40}$/;
const MAX_LINES = 100_000;
const MAX_PATH = 4096;

// A user-typed command is a test run when it starts (or follows ;, && or |) with one of these. Only the name is kept.
const END = "(?=\\s|$)";   // the whole word: `jest` but not `jest-codemod`
const TEST_RUNNERS: [RegExp, string][] = ([
  ["(bun|deno) test", "$1 test"], ["(npm|pnpm|yarn|bun) (run )?test|npm t", "npm test"], ["(npx |bunx )?jest", "jest"],
  ["(npx |bunx )?vitest", "vitest"], ["((poetry|uv) run )?(python3? -m )?pytest", "pytest"],
  ["python3? -m unittest", "unittest"], ["go test", "go test"], ["cargo test", "cargo test"],
  ["dotnet test", "dotnet test"], ["(mvn|\\./mvnw)( \\S+)* (test|verify)", "maven"],
  ["(gradle|\\./gradlew)( \\S+)* (\\S*:)?test", "gradle"], ["(bundle exec )?rspec", "rspec"],
  ["(vendor/bin/)?phpunit", "phpunit"], ["mix test", "mix test"], ["make test", "make test"]
] as const).map(([re, name]) => [new RegExp(`^(${re})${END}`), name]);
const SKIPS_TESTS = /-DskipTests|test\.skip=true|(^|\s)-x\s+\S*test\b/;

export function testRunner(command: string): string | null {
  const unquoted = command.replace(/'[^']*'|"[^"]*"/g, "''");     // `git commit -m "fix; pytest"` isn't a test run
  for (const part of unquoted.split(/;|&&|\|\|?/).map((s) => s.trim().replace(/^(\w+=\S*\s+)+/, ""))) {
    if (SKIPS_TESTS.test(part)) continue;
    for (const [re, name] of TEST_RUNNERS) {
      const m = part.match(re);
      if (m) return name.replace("$1", m[2] ?? "");
    }
  }
  return null;
}

interface Row { type: string; category: string; metadata: object }

// Throws with a one-line reason on any input the extension shouldn't have sent.
export function parseIdeEvent(input: unknown): { cwd: string; row: Row } | null {
  const e = (input ?? {}) as Record<string, unknown>;
  if (typeof e.cwd !== "string" || !isAbsolute(e.cwd) || e.cwd.length > MAX_PATH) throw new Error("cwd must be an absolute path");
  const cwd = real(resolve(e.cwd));
  switch (e.kind) {
    case "debug": {
      if (typeof e.debugType !== "string" || !DEBUG_TYPE_RE.test(e.debugType)) throw new Error("invalid debugType");
      return { cwd, row: { type: "ide_debug", category: "debugging", metadata: { debugType: e.debugType } } };
    }
    case "test": {
      if (typeof e.command !== "string" || e.command.length > 1000) throw new Error("invalid command");
      const runner = testRunner(e.command);
      if (!runner) return null;                    // not a test command: nothing to record
      const exitCode = Number.isInteger(e.exitCode) ? e.exitCode : undefined;
      return { cwd, row: { type: "ide_test", category: "testing", metadata: { runner, exitCode } } };
    }
    case "edit": {
      if (typeof e.file !== "string" || !isAbsolute(e.file) || e.file.length > MAX_PATH) throw new Error("file must be an absolute path");
      if (!Number.isInteger(e.lines) || (e.lines as number) < 1 || (e.lines as number) > MAX_LINES) throw new Error("invalid lines");
      return { cwd, row: {
        type: "ide_edit", category: TEST_FILE_RE.test(e.file) ? "testing" : "implementation",
        metadata: { file_path: real(resolve(e.file)), lines: e.lines }
      } };
    }
    default:
      throw new Error(`unknown kind ${JSON.stringify(e.kind)} — expected debug|test|edit`);
  }
}

// Sessions record cwd as given; the extension may send /var where git and the hooks see /private/var
const real = (p: string) => existsSync(p) ? realpathSync(p) : p;

// The Claude session for this workspace: the exact folder first, then one above or below it; open before ended;
// newest first. "ide" when there is none yet. Prefix checks use substr, since LIKE treats _ and % in paths as wildcards.
// ponytail: two live sessions in the same folder get events attributed to the later one.
function sessionFor(cwd: string): string {
  const row = getDb().query(
    `SELECT id FROM sessions
     WHERE project_path = ?1
        OR substr(project_path, 1, length(?1) + 1) = ?1 || '/'
        OR substr(?1, 1, length(project_path) + 1) = project_path || '/'
     ORDER BY project_path = ?1 DESC, ended_at IS NULL DESC, started_at DESC LIMIT 1`
  ).get(cwd) as { id: string } | null;
  return row?.id ?? "ide";
}

export function recordIdeEvent(input: unknown, now = Date.now()): string {
  const parsed = parseIdeEvent(input);
  if (!parsed) return "[Plum] Not a test command; nothing recorded.";
  const { cwd, row } = parsed;
  getDb().run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, verified, metadata) VALUES (?, ?, ?, ?, 0, 0, ?)`,
    [sessionFor(cwd), now, row.type, row.category, JSON.stringify(row.metadata)]
  );
  return `[Plum] ${row.type} recorded.`;
}

// The plugin lives in a hashed cache folder, so editor extensions find the launcher through ~/.plum/cli.
export function writeCliPointer(): void {
  const target = join(PLUM_DATA_DIR, "cli");
  const launcher = join(PLUGIN_ROOT, "bin", "plum");
  try {
    if (readFileSync(target, "utf-8").trim() === launcher) return;
  } catch { /* first run */ }
  try { mkdirSync(PLUM_DATA_DIR, { recursive: true }); writeFileSync(target, launcher + "\n"); } catch { /* never disturb session start */ }
}
