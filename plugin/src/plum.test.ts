// End-to-end: drives the real CLI with Claude Code hook payloads against a throwaway data dir.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";

const CLI = join(import.meta.dir, "cli.ts");
let dataDir = "";

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "plum-test-"));
  // Low gates so patterns fire within a handful of events
  writeFileSync(join(dataDir, "config.json"), JSON.stringify({
    minEventsBeforeIntervene: 1,
    thresholds: { testDelegationMin: 1 }
  }));
});

function run(args: string[], stdin = ""): string {
  const p = Bun.spawnSync(["bun", CLI, ...args], {
    stdin: new TextEncoder().encode(stdin),
    env: { ...process.env, PLUM_DATA_DIR: dataDir }
  });
  return p.stdout.toString();
}

const hook = (cmd: string, payload: object) => run([cmd], JSON.stringify({ session_id: "s1", cwd: "/repo", ...payload }));
const db   = () => new Database(join(dataDir, "atrophy.db"));

test("user-prompt reads the `prompt` field and records intent flags", () => {
  hook("user-prompt", { prompt: "which component library should I use?" });
  const row = db().query(`SELECT metadata FROM events WHERE event_type = 'user_prompt'`).get() as any;
  expect(JSON.parse(row.metadata)).toMatchObject({ is_decision_seeking: 1, is_design_related: 1 });
});

test("pre-tool injects additionalContext once, then respects the cooldown", () => {
  const edit = { tool_name: "Write", tool_input: { file_path: "/repo/a.test.ts" } };
  hook("post-tool", edit);

  const first = JSON.parse(hook("pre-tool", edit));
  expect(first.hookSpecificOutput.hookEventName).toBe("PreToolUse");
  expect(first.hookSpecificOutput.additionalContext).toContain("test_first");
  expect(first.hookSpecificOutput.permissionDecision).toBeUndefined();

  expect(hook("pre-tool", edit)).toBe("");
  const logged = db().query(`SELECT pattern FROM interventions`).all() as any[];
  expect(logged.map((r) => r.pattern)).toEqual(["test_delegation"]);
});

test("each tool call is logged once, and reading the edited file verifies it", () => {
  const edit = { tool_name: "Edit", tool_input: { file_path: "/repo/x.ts" } };
  hook("pre-tool", edit);
  hook("post-tool", edit);
  hook("post-tool", { tool_name: "Read", tool_input: { file_path: "/repo/x.ts" } });

  const rows = db().query(`SELECT tool_name, delegated, verified FROM events ORDER BY id`).all();
  expect(rows).toEqual([
    { tool_name: "Edit", delegated: 1, verified: 1 },
    { tool_name: "Read", delegated: 0, verified: 0 }
  ]);
});

test("predict is attributed to the active session", () => {
  hook("post-tool", { tool_name: "Bash", tool_input: { command: "ls" } });
  run(["predict", "it's a race condition"]);
  const row = db().query(`SELECT session_id FROM events WHERE event_type = 'predict'`).get() as any;
  expect(row.session_id).toBe("s1");
});

test("design critique atrophy fires on unverified design work", () => {
  for (let i = 0; i < 3; i++) hook("user-prompt", { prompt: "tweak the layout spacing" });
  hook("post-tool", { tool_name: "Edit", tool_input: { file_path: "/repo/ui.css" } });
  const out = hook("pre-tool", { tool_name: "Edit", tool_input: { file_path: "/repo/ui.css" } });
  expect(out).toContain("diff_review");
});

test("MCP server speaks newline-delimited JSON-RPC", async () => {
  const p = Bun.spawn(["bun", CLI, "mcp"], {
    stdin: "pipe", stdout: "pipe", env: { ...process.env, PLUM_DATA_DIR: dataDir }
  });
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }) + "\n");
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  p.stdin.end();

  const lines = (await new Response(p.stdout).text()).trim().split("\n").map((l) => JSON.parse(l));
  expect(lines[0].result.protocolVersion).toBe("2025-06-18");
  expect(lines[1].result.tools.map((t: any) => t.name)).toContain("log_explanation");
});

test("week-wide patterns cool down across sessions, not per session", () => {
  const debug = { tool_name: "Bash", tool_input: { command: "fix the bug in parser" } };
  for (let i = 0; i < 5; i++) hook("post-tool", debug);

  run(["post-tool"], JSON.stringify({ session_id: "s2", tool_name: "Read", tool_input: {} })); // clears s2's min-events gate
  const s1 = run(["pre-tool"], JSON.stringify({ session_id: "s1", ...debug }));
  const s2 = run(["pre-tool"], JSON.stringify({ session_id: "s2", ...debug }));
  expect(s1).toContain("predict_first");
  expect(s2).not.toContain("debugging");
});

test("MCP skill context suggests library concepts for at-risk domains", async () => {
  hook("post-tool", { tool_name: "Bash", tool_input: { command: "ls" } });   // creates the DB
  db().run(`UPDATE skill_scores SET score = 10 WHERE domain = 'architecture'`);

  const p = Bun.spawn(["bun", CLI, "mcp"], {
    stdin: "pipe", stdout: "pipe", env: { ...process.env, PLUM_DATA_DIR: dataDir }
  });
  p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_skill_context", arguments: {} } }) + "\n");
  p.stdin.end();

  const reply = JSON.parse((await new Response(p.stdout).text()).trim());
  expect(reply.result.content[0].text).toContain("/plum:teach cqrs");
});
