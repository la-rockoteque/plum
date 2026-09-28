// Usage statistics: opt-in, counts only, local, never breaks a run.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { sanitizeEvent, trimEvents, summarize, formatSummary, type UsageEvent } from "./telemetry.js";

const CLI     = join(import.meta.dir, "cli.ts");
const SECRETS = ["sk-live-TOPSECRET123", "hunter2", "/Users/alice/acme-payroll", "acme-payroll", "invoice.ts", "Alice Martin"];
const DAY     = 86_400_000;

// ── pure functions ───────────────────────────────────────────────────────────

test("sanitizeEvent keeps only counts, extensions and error type names", () => {
  const e = sanitizeEvent("post-tool", {
    durationMs: 12.7,
    counts: { category_testing: 1, "sk-live-TOPSECRET123": 5, "path/like": 2, negative: -3 },
    extensions: [".ts", "invoice.ts", "/Users/alice/x.py", ".PY"],
    errors: ["TypeError", "Error: /Users/alice/acme-payroll not found"]
  }, 1_000);
  expect(e).toEqual({ ts: 1_000, tool: "post-tool", ms: 13, counts: { category_testing: 1 }, ext: [".ts", ".py"], err: ["TypeError"] });
});

test("sanitizeEvent maps unknown tool names to 'other'", () => {
  expect(sanitizeEvent("rm -rf /Users/alice", {}, 0).tool).toBe("other");
});

test("trimEvents drops events past retention and the oldest half above the size cap", () => {
  const now = 100 * DAY;
  const events: UsageEvent[] = Array.from({ length: 10 }, (_, i) => ({ ts: now - (10 - i) * DAY, tool: "post-tool", ms: 1 }));
  expect(trimEvents(events, { retentionDays: 5, maxBytes: 1e9, now }).length).toBe(5);
  const big = trimEvents(events, { retentionDays: 365, maxBytes: 200, now });
  expect(big.length).toBeLessThan(10);
  expect(big.at(-1)).toEqual(events.at(-1)!);          // newest kept
});

test("summarize aggregates totals, medians, top categories and verdict ratios", () => {
  const now = 10 * DAY;
  const events: UsageEvent[] = [
    { ts: now - 1, tool: "post-tool", ms: 10, counts: { category_testing: 2 } },
    { ts: now - 2, tool: "post-tool", ms: 30, counts: { category_testing: 1, category_debugging: 1 } },
    { ts: now - 3, tool: "pre-tool",  ms: 5,  counts: { nudge_fired: 1 } },
    { ts: now - 4, tool: "verdict",   counts: { test_delegation__confirmed: 3, test_delegation__false_positive: 1 } },
    { ts: now - 5, tool: "post-tool", ms: 1, err: ["TypeError"] },
    { ts: now - 40 * DAY, tool: "post-tool", ms: 999 }
  ];
  const s = summarize(events, { days: 30, now });
  expect(s.events).toBe(5);
  expect(s.tools["post-tool"]).toEqual({ runs: 3, medianMs: 10 });
  expect(s.topCounts[0]).toEqual(["category_testing", 3]);
  expect(s.errors).toEqual({ TypeError: 1 });
  expect(s.verdicts.test_delegation).toEqual({ confirmed: 3, false_positive: 1, falsePositiveRate: 0.25 });
  expect(formatSummary(s, 30).startsWith("[Usage statistics]")).toBe(true);
});

// ── end to end through the real CLI ──────────────────────────────────────────

let dataDir = "", projectDir = "";

beforeEach(() => {
  dataDir    = mkdtempSync(join(tmpdir(), "plum-usage-"));
  projectDir = mkdtempSync(join(tmpdir(), "plum-project-"));
  mkdirSync(join(projectDir, ".plum"));
});

function run(args: string[], stdin = ""): { out: string; code: number } {
  const p = Bun.spawnSync(["bun", CLI, ...args], {
    stdin: new TextEncoder().encode(stdin),
    env: { ...process.env, PLUM_DATA_DIR: dataDir, CLAUDE_PROJECT_DIR: projectDir }
  });
  return { out: p.stdout.toString() + p.stderr.toString(), code: p.exitCode ?? 0 };
}

function hookWithSecrets(): void {
  const input = { file_path: "/Users/alice/acme-payroll/src/invoice.ts", command: "curl -H 'Authorization: sk-live-TOPSECRET123'", content: "password=hunter2 by Alice Martin" };
  run(["user-prompt"], JSON.stringify({ session_id: "s1", prompt: "fix the acme-payroll bug, password hunter2" }));
  run(["post-tool"],   JSON.stringify({ session_id: "s1", tool_name: "Edit", tool_input: input }));
  run(["pre-tool"],    JSON.stringify({ session_id: "s1", tool_name: "Bash", tool_input: input }));
}

const usagePath = () => join(dataDir, "usage.jsonl");
const personal  = (cfg: object) => writeFileSync(join(dataDir, "config.json"), JSON.stringify(cfg));
const shared    = (cfg: object) => writeFileSync(join(projectDir, ".plum", "config.json"), JSON.stringify(cfg));

test("with statistics off, nothing is recorded", () => {
  hookWithSecrets();
  expect(existsSync(usagePath())).toBe(false);
});

test("a shared config alone can't turn statistics on", () => {
  shared({ telemetry: { enabled: true } });
  hookWithSecrets();
  expect(existsSync(usagePath())).toBe(false);
});

test("a personal opt-in records runs, and the usage file holds no secrets, names or paths", () => {
  personal({ telemetry: { enabled: true } });
  hookWithSecrets();
  const raw = readFileSync(usagePath(), "utf-8");
  const events = raw.trim().split("\n").map((l) => JSON.parse(l));
  expect(events.map((e) => e.tool).sort()).toEqual(["post-tool", "pre-tool", "user-prompt"]);
  expect(events.find((e) => e.tool === "post-tool").ext).toEqual([".ts"]);
  for (const s of SECRETS) expect(raw).not.toContain(s);
});

test("a shared opt-out wins over a personal opt-in", () => {
  personal({ telemetry: { enabled: true } });
  shared({ telemetry: { enabled: false } });
  hookWithSecrets();
  expect(existsSync(usagePath())).toBe(false);
});

test("recording never breaks a run, even when the data dir is unwritable", () => {
  personal({ telemetry: { enabled: true } });
  mkdirSync(usagePath());                                          // appending to a directory throws EISDIR
  const r = run(["concepts"]);
  expect(r.code).toBe(0);
  expect(r.out).toContain("Concept library");
});

test("stats summary, verdicts and send print counts and a form link without opening anything", () => {
  personal({ telemetry: { enabled: true } });
  hookWithSecrets();
  expect(run(["stats", "verdicts", JSON.stringify([{ pattern: "test_delegation", verdict: "false_positive" }])]).code).toBe(0);
  expect(run(["stats", "verdicts", JSON.stringify({ pattern: "sk-live-TOPSECRET123", verdict: "confirmed" })]).code).not.toBe(0);

  const summary = run(["stats", "summary", "--json"]);
  const parsed = JSON.parse(summary.out);
  expect(parsed.events).toBeGreaterThanOrEqual(3);
  expect(parsed.verdicts.test_delegation.false_positive).toBe(1);

  const send = run(["stats", "send"]);
  expect(send.out).toContain("[Usage statistics]");
  expect(send.out).toContain("Form host: docs.google.com");
  expect(send.out).toContain("usp=pp_url&entry.1018508464=");
  expect(send.out).toContain("Nothing has been sent");
  for (const s of SECRETS) expect(send.out).not.toContain(s);

  expect(run(["stats", "clear"]).code).toBe(0);
  expect(existsSync(usagePath())).toBe(false);
});

test("feedback prints the exact text and link, and honours feedback.enabled=false", () => {
  const r = run(["feedback", "--kind", "feature", "--message", "Teach Rust concepts", "--why", "our backend is Rust"]);
  expect(r.out).toContain("[Feature request] Teach Rust concepts");
  expect(r.out).toContain("Why: our backend is Rust");
  expect(r.out).toContain("Context: Plum ");
  expect(r.out).toContain("Form host: docs.google.com");
  expect(r.out).toContain("Nothing has been sent");

  shared({ feedback: { enabled: false } });
  const off = run(["feedback", "--message", "hello"]);
  expect(off.code).not.toBe(0);
  expect(off.out).toContain("disabled");
});
