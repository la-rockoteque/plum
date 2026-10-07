// End-to-end: the user's own edits between Claude's turns become independence events.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";

const CLI = join(import.meta.dir, "cli.ts");
let dataDir = "";
let repo = "";

const sh = (...args: string[]) => Bun.spawnSync(args, { cwd: repo, stdout: "ignore", stderr: "ignore" });
const lines = (n: number) => Array.from({ length: n }, (_, i) => `line ${i}`).join("\n") + "\n";

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "plum-test-"));
  repo = mkdtempSync(join(tmpdir(), "plum-repo-"));
  sh("git", "init", "-q");
  writeFileSync(join(repo, "a.ts"), "export {};\n");
  sh("git", "add", "-A");
  sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
});

const hook = (cmd: string, payload: object) => Bun.spawnSync(["bun", CLI, cmd], {
  stdin: new TextEncoder().encode(JSON.stringify({ session_id: "s1", cwd: repo, ...payload })),
  env: { ...process.env, PLUM_DATA_DIR: dataDir }
});
const independence = () => new Database(join(dataDir, "atrophy.db"))
  .query(`SELECT category, metadata FROM events WHERE event_type = 'independence'`).all() as { category: string; metadata: string }[];

test("lines the user writes between turns log one independence event, files only counted", () => {
  hook("user-prompt", { prompt: "add a parser" });
  hook("stop", {});
  writeFileSync(join(repo, "b.ts"), lines(5));       // untracked new file counts
  hook("user-prompt", { prompt: "now review it" });

  const rows = independence();
  expect(rows).toHaveLength(1);
  expect(rows[0].category).toBe("implementation");
  expect(JSON.parse(rows[0].metadata)).toEqual({ source: "git", files: 1, added: 5, removed: 0 });
});

test("a test file the user writes counts for testing", () => {
  hook("stop", {});
  writeFileSync(join(repo, "a.test.ts"), lines(4));
  hook("user-prompt", { prompt: "run them" });
  expect(independence().map((r) => r.category)).toEqual(["testing"]);
});

test("Claude's edits, lockfiles, trivial changes and branch switches are not the user's work", () => {
  hook("stop", {});
  writeFileSync(join(repo, "claude.ts"), lines(10));
  hook("post-tool", { tool_name: "Write", tool_input: { file_path: join(repo, "claude.ts") } });
  writeFileSync(join(repo, "bun.lock"), lines(50));
  writeFileSync(join(repo, "a.ts"), "export const x = 1;\n");   // 2 lines changed: under the floor
  hook("user-prompt", { prompt: "next" });
  expect(independence()).toHaveLength(0);

  sh("git", "add", "-A");
  sh("git", "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "pulled");
  writeFileSync(join(repo, "c.ts"), lines(5));
  hook("user-prompt", { prompt: "after a pull" });
  expect(independence()).toHaveLength(0);
});

test("a gap after an interrupted turn with a Bash call is skipped; odd paths still match Claude's edits", () => {
  hook("user-prompt", { prompt: "go" });           // baseline; Stop never runs (interrupted)
  writeFileSync(join(repo, "caf\u00e9 x.ts"), lines(5));
  hook("post-tool", { tool_name: "Write", tool_input: { file_path: join(repo, "caf\u00e9 x.ts") } });
  hook("user-prompt", { prompt: "go on" });
  expect(independence()).toHaveLength(0);

  hook("post-tool", { tool_name: "Bash", tool_input: { command: "bun run fmt" } });
  writeFileSync(join(repo, "fmt.ts"), lines(5));
  hook("user-prompt", { prompt: "again" });
  expect(independence()).toHaveLength(0);
});

test("outside a git repo the hooks are no-ops", () => {
  const plain = mkdtempSync(join(tmpdir(), "plum-plain-"));
  hook("stop", { cwd: plain });
  writeFileSync(join(plain, "x.ts"), lines(5));
  expect(hook("user-prompt", { cwd: plain, prompt: "hi" }).exitCode).toBe(0);
  expect(independence()).toHaveLength(0);
});
