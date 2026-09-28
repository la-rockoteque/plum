// Progress, goal proposals and connectors: opt-in, show-before-send, counts and goals only.
import { test, expect, beforeEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { Database } from "bun:sqlite";
import { resolveConfig } from "./config.js";
import { loadConnectors } from "./connectors.js";

const CLI = join(import.meta.dir, "cli.ts");
let data = "", project = "";

beforeEach(() => {
  data = mkdtempSync(join(tmpdir(), "plum-conn-"));
  project = mkdtempSync(join(tmpdir(), "plum-conn-proj-"));
  mkdirSync(join(project, ".plum"));
});

function plum(...args: string[]): { out: string; err: string; code: number } {
  const p = Bun.spawnSync(["bun", CLI, ...args], { env: { ...process.env, PLUM_DATA_DIR: data, CLAUDE_PROJECT_DIR: project } });
  return { out: p.stdout.toString(), err: p.stderr.toString(), code: p.exitCode ?? 0 };
}
const hook = (cmd: string, payload: object) => Bun.spawnSync(["bun", CLI, cmd], {
  stdin: new TextEncoder().encode(JSON.stringify({ session_id: "s1", cwd: "/Users/alice/acme-payroll", ...payload })),
  env: { ...process.env, PLUM_DATA_DIR: data, CLAUDE_PROJECT_DIR: project }
});

// Some delegations, no predictions, one explain-back: weak predict habit.
function seedActivity(): void {
  for (let i = 0; i < 6; i++) hook("post-tool", { tool_name: "Edit", tool_input: { file_path: "/Users/alice/acme-payroll/src/pay.ts" } });
  plum("explained", "testing", "--quality", "full", "--concept", "test-doubles");
}

// ── manifests and consent ────────────────────────────────────────────────────

test("the leapsome connector manifest loads and is MCP-mediated", () => {
  const c = loadConnectors().find((x) => x.id === "leapsome");
  expect(c?.kind).toBe("mcp-mediated");
  expect(c?.capabilities).toContain("goals.create");
  expect(c?.visibility).toMatch(/manager/i);
});

test("connectors are off by default; only personal/local config enables them; shared can disable", () => {
  const on = { connectors: { leapsome: { enabled: true } } };
  const off = { connectors: { leapsome: { enabled: false } } };
  expect(resolveConfig({}).connectors.leapsome?.enabled ?? false).toBe(false);
  expect(resolveConfig({ shared: on }).connectors.leapsome?.enabled ?? false).toBe(false);
  expect(resolveConfig({ personal: on }).connectors.leapsome?.enabled).toBe(true);
  expect(resolveConfig({ local: on }).connectors.leapsome?.enabled).toBe(true);
  expect(resolveConfig({ shared: off, personal: on }).connectors.leapsome?.enabled ?? false).toBe(false);
});

test("enable writes the personal config, and status reflects it", () => {
  expect(plum("connectors", "status", "leapsome").out).toContain("off");
  expect(plum("connectors", "enable", "leapsome").code).toBe(0);
  expect(JSON.parse(readFileSync(join(data, "config.json"), "utf-8")).connectors.leapsome.enabled).toBe(true);
  expect(plum("connectors", "status", "leapsome").out).toContain("on");
  plum("connectors", "disable", "leapsome");
  expect(plum("connectors", "status", "leapsome").out).toContain("off");
});

// ── progress and proposals ───────────────────────────────────────────────────

test("progress reports habits and concepts, counts only", () => {
  seedActivity();
  const p = JSON.parse(plum("progress", "--json").out);
  expect(p.habits.predictRate).toBe(0);
  expect(p.habits.explanations).toBe(1);
  expect(p.concepts.map((c: any) => c.id)).toContain("test-doubles");
  expect(JSON.stringify(p)).not.toContain("acme");
  expect(JSON.stringify(p)).not.toContain("/Users");
});

test("goals propose builds measurable proposals from user actions and remembers them", () => {
  seedActivity();
  const proposals = JSON.parse(plum("goals", "propose", "--json").out);
  expect(proposals.length).toBeGreaterThan(0);
  expect(proposals.length).toBeLessThanOrEqual(3);
  const predict = proposals.find((g: any) => g.metric.key === "predictRate");
  expect(predict.metric).toMatchObject({ kind: "habit-rate", from: 0, target: 0.3 });
  expect(predict.title).toMatch(/predict/i);
  for (const g of proposals) expect(g.metric.kind).not.toBe("domain-score");
  expect(existsSync(join(data, "goals", "proposals.json"))).toBe(true);
});

// ── payloads, links and progress ─────────────────────────────────────────────

test("payload is refused while the connector is off", () => {
  seedActivity();
  const [g] = JSON.parse(plum("goals", "propose", "--json").out);
  const r = plum("connectors", "payload", "leapsome", "goals.create", g.id);
  expect(r.code).not.toBe(0);
  expect(r.err).toContain("off");
});

test("goals.create payload shows exactly what will be sent, with the visibility warning", () => {
  seedActivity();
  plum("connectors", "enable", "leapsome");
  const [g] = JSON.parse(plum("goals", "propose", "--json").out);
  const r = plum("connectors", "payload", "leapsome", "goals.create", g.id);
  expect(r.code).toBe(0);
  expect(r.out).toContain(g.title);
  expect(r.out).toMatch(/visible to your manager/i);
  const json = JSON.parse(r.out.slice(r.out.indexOf("{"), r.out.lastIndexOf("}") + 1));
  expect(Object.keys(json).sort()).toEqual(["description", "due", "title"]);
  expect(r.out).not.toContain("acme");
});

test("link, then goals progress and a goals.progress payload for linked goals", () => {
  seedActivity();
  plum("connectors", "enable", "leapsome");
  const [g] = JSON.parse(plum("goals", "propose", "--json").out);
  expect(plum("connectors", "link", "leapsome", g.id, "ls-goal-42").code).toBe(0);
  const progress = JSON.parse(plum("goals", "progress", "--json").out);
  expect(progress[0]).toMatchObject({ proposalId: g.id, connector: "leapsome", externalId: "ls-goal-42" });
  expect(typeof progress[0].current).toBe("number");
  expect(progress[0].percent).toBeGreaterThanOrEqual(0);
  const r = plum("connectors", "payload", "leapsome", "goals.progress");
  expect(r.out).toContain("ls-goal-42");
  expect(r.out).toMatch(/\d+%/);
});

test("linking an unknown proposal fails clearly", () => {
  plum("connectors", "enable", "leapsome");
  const r = plum("connectors", "link", "leapsome", "nope", "x");
  expect(r.code).not.toBe(0);
  expect(r.err).toContain("Unknown proposal");
});

test("lectures rendered from a plan count as concepts studied", () => {
  const db = () => new Database(join(data, "atrophy.db"));
  hook("post-tool", { tool_name: "Bash", tool_input: { command: "ls" } });
  const fills = {
    meta: "m", question: "q", problem: null, problemText: "p", yours: { lang: "ts", text: "x" },
    bindings: {} as Record<string, string>, answers: [] as string[], exercise: ["e"], recap: ["a", "b", "c"]
  };
  const plan = JSON.parse(Bun.spawnSync(["bun", CLI, "concepts", "--json"]).stdout.toString()).find((c: any) => c.id === "dry");
  for (const r of Object.keys(plan.roles)) fills.bindings[r] = "x";
  fills.answers = plan.checks.map(() => "a");
  const f = join(data, "fills.json");
  writeFileSync(f, JSON.stringify(fills));
  plum("teach", "render", "--plan", "dry", "--lang", "go", "--fill", f, "--out", join(data, "deck.html"));
  const row = db().query(`SELECT metadata FROM events WHERE event_type = 'lecture'`).get() as any;
  expect(JSON.parse(row.metadata).concept).toBe("dry");
});
