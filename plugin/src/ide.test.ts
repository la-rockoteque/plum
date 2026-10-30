// IDE events: parsing and privacy (unit), then the CLI end to end against a throwaway data dir and git repo.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, realpathSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import { testRunner, parseIdeEvent } from "./ide.js";

test("testRunner keeps the runner name only, after env vars and chained commands", () => {
  expect(testRunner("bun test plugin/src")).toBe("bun test");
  expect(testRunner("CI=1 FOO=bar pytest -k secret_name")).toBe("pytest");
  expect(testRunner("cd api && go test ./...")).toBe("go test");
  expect(testRunner("npm run test -- --watch")).toBe("npm test");
  expect(testRunner("./gradlew :app:test")).toBe("gradle");
  expect(testRunner("deno test")).toBe("deno test");
  expect(testRunner("uv run pytest")).toBe("pytest");
  expect(testRunner("bun run test")).toBe("npm test");
  expect(testRunner("mvn -q test")).toBe("maven");
  expect(testRunner("git commit -m 'add test'")).toBeNull();
  expect(testRunner('git commit -m "fix; pytest"')).toBeNull();
  expect(testRunner("ls tests/")).toBeNull();
  expect(testRunner("jest-codemod src")).toBeNull();
  expect(testRunner("mvn package -Dmaven.test.skip=true")).toBeNull();
  expect(testRunner("gradle build -x test")).toBeNull();
});

test("parseIdeEvent rejects bad input and never keeps the raw command", () => {
  expect(() => parseIdeEvent({ kind: "debug", cwd: "rel" })).toThrow("absolute");
  expect(() => parseIdeEvent({ kind: "debug", cwd: "/r", debugType: "a b; rm" })).toThrow("debugType");
  expect(() => parseIdeEvent({ kind: "edit", cwd: "/r", file: "/r/a.ts", lines: 0 })).toThrow("lines");
  expect(() => parseIdeEvent({ kind: "keylog", cwd: "/r" })).toThrow("unknown kind");
  expect(parseIdeEvent({ kind: "test", cwd: "/r", command: "echo hi" })).toBeNull();
  const t = parseIdeEvent({ kind: "test", cwd: "/r", command: "pytest -k token=abc", exitCode: 1 });
  expect(t?.row.metadata).toEqual({ runner: "pytest", exitCode: 1 });
  expect(parseIdeEvent({ kind: "edit", cwd: "/r", file: "/r/src/a.test.ts", lines: 4 })?.row.category).toBe("testing");
});

const CLI = join(import.meta.dir, "cli.ts");
let dataDir = "";
let repo = "";
const sh = (...args: string[]) => Bun.spawnSync(args, { cwd: repo, stdout: "ignore", stderr: "ignore" });
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n") + "\n";

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "plum-test-"));
  repo = realpathSync(mkdtempSync(join(tmpdir(), "plum-repo-")));
  sh("git", "init", "-q");
  writeFileSync(join(repo, "a.ts"), "export {};\n");
  sh("git", "add", "-A");
  sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
});

const cli = (args: string[], payload?: object) => Bun.spawnSync(["bun", CLI, ...args], {
  stdin: new TextEncoder().encode(payload ? JSON.stringify(payload) : ""),
  env: { ...process.env, PLUM_DATA_DIR: dataDir, PLUM_PLUGIN_ROOT: "/opt/plum" }
});
const hook = (cmd: string, payload: object) => cli([cmd], { session_id: "s1", cwd: repo, ...payload });
const ide = (payload: object) => cli(["ide-event"], { cwd: repo, ...payload });
const db = () => new Database(join(dataDir, "atrophy.db"));
const health = () => JSON.parse(cli(["skill-health", "--json"]).stdout.toString()) as
  { overall: number; domains: { domain: string; score: number; requests: number }[] };

test("ide-event links to the workspace's session and rejects bad input with exit 1", () => {
  hook("user-prompt", { prompt: "hello" });
  expect(ide({ kind: "debug", cwd: join(repo, "sub"), debugType: "pwa-chrome" }).exitCode).toBe(0);
  const row = db().query(`SELECT session_id, category, delegated FROM events WHERE event_type = 'ide_debug'`).get();
  expect(row).toEqual({ session_id: "s1", category: "debugging", delegated: 0 });

  // An exact-folder session wins over a newer one opened above it, and _ in a path isn't a wildcard
  hook("user-prompt", { session_id: "parent", cwd: join(repo, ".."), prompt: "hi" });
  hook("user-prompt", { session_id: "lookalike", cwd: repo.replace(/-([^-]*)$/, "_$1"), prompt: "hi" });
  ide({ kind: "test", command: "bun test" });
  expect(db().query(`SELECT session_id FROM events WHERE event_type = 'ide_test'`).get()).toEqual({ session_id: "s1" });

  const bad = ide({ kind: "debug", debugType: "x y" });
  expect(bad.exitCode).toBe(1);
  expect(bad.stderr.toString()).toContain("invalid debugType");
});

test("debugging in the IDE engages the next debugging request, not a request in another domain", () => {
  const score = (d: string) => health().domains.find((x) => x.domain === d)!.score;
  hook("user-prompt", { prompt: "fix the bug, the error is still thrown" });
  ide({ kind: "debug", debugType: "node" });
  hook("user-prompt", { prompt: "fix the bug, the error is still thrown" });
  expect(score("debugging")).toBe(39);          // weights 0 + 1 → 100·(1/3 + 2)/(2 + 4); 33 without the debug session

  ide({ kind: "debug", debugType: "node" });
  hook("user-prompt", { prompt: "add a new endpoint for users" });
  expect(score("implementation")).toBe(40);     // weight 0 → 100·2/5: the debug session isn't credited here
  hook("user-prompt", { prompt: "fix the bug, the error is still thrown" });
  expect(score("debugging")).toBe(38);          // ...but still on the next debugging request: 100·(2/3 + 2)/7; 33 if lost
});

test("with IDE typed edits, the git hook credits only the files the user typed in", () => {
  hook("stop", {});
  writeFileSync(join(repo, "typed.ts"), lines(5));
  writeFileSync(join(repo, "formatted.ts"), lines(40));    // a formatter or another session wrote this
  ide({ kind: "edit", file: join(repo, "typed.ts"), lines: 5 });
  hook("user-prompt", { prompt: "next" });

  const rows = db().query(`SELECT metadata FROM events WHERE event_type = 'independence'`).all() as { metadata: string }[];
  expect(rows.map((r) => JSON.parse(r.metadata))).toEqual([{ source: "git", files: 1, added: 5, removed: 0 }]);
});

test("skill-health --json lists five domains, and session start writes the CLI pointer", () => {
  const h = health();
  expect(h.overall).toBe(50);
  expect(h.domains.map((d) => d.domain)).toEqual(["implementation", "debugging", "testing", "architecture", "synthesis"]);

  cli(["update-check"]);
  expect(readFileSync(join(dataDir, "cli"), "utf-8")).toBe("/opt/plum/bin/plum\n");
});
