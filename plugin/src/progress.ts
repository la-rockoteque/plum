/**
 * Connector-agnostic progress model: a snapshot of what Plum measured, and goals Plum can measure itself.
 * Goals are built from the user's own actions (predicting, explaining back, studying concepts) — not from the
 * skill scores, which are also driven by Claude's behaviour. Everything here is counts, rates and concept ids.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getDb } from "./db.js";
import { PLUM_DATA_DIR } from "./env.js";
import { getSkillSnapshot } from "./skill-model.js";
import { loadConcepts } from "./library.js";

const DAY_MS = 86_400_000;
const GOALS_DIR = join(PLUM_DATA_DIR, "goals");
const PROPOSALS_PATH = join(GOALS_DIR, "proposals.json");
const PREDICT_TARGET = 0.3;
const EXPLAIN_STEP = 4;
const GOAL_DAYS = 30;

export interface ProgressSnapshot {
  period: { from: string; to: string; days: number };
  domains: Record<string, { score: number; trend: string; delegationRate: number }>;
  habits: { delegations: number; predictions: number; predictRate: number; explanations: number; independence: number };
  concepts: { id: string; lectures: number; explainBack?: "full" | "partial" }[];
}

export type Metric =
  | { kind: "habit-rate"; key: "predictRate"; from: number; target: number }
  | { kind: "habit-count"; key: "explanations"; from: number; target: number }
  | { kind: "concepts-completed"; key: string; from: number; target: number };

export interface GoalProposal {
  id: string;
  title: string;
  why: string;
  metric: Metric;
  due: string;
  suggestedPractice: string[];
}

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

function count(sql: string, ...args: unknown[]): number {
  return ((getDb().query(sql).get(...(args as [])) as { c: number } | null)?.c) ?? 0;
}

function habits(sinceMs: number): ProgressSnapshot["habits"] {
  const delegations = count(`SELECT COUNT(*) AS c FROM events WHERE ts > ? AND event_type = 'post_tool' AND delegated = 1`, sinceMs);
  const predictions = count(`SELECT COUNT(*) AS c FROM events WHERE ts > ? AND event_type = 'predict'`, sinceMs);
  return {
    delegations, predictions,
    predictRate: delegations > 0 ? round2(Math.min(1, predictions / delegations)) : 0,
    explanations: count(`SELECT COUNT(*) AS c FROM events WHERE ts > ? AND event_type = 'explanation'`, sinceMs),
    independence: count(`SELECT COUNT(*) AS c FROM events WHERE ts > ? AND event_type = 'independence'`, sinceMs)
  };
}

function conceptsStudied(sinceMs: number): ProgressSnapshot["concepts"] {
  const rows = getDb().query(
    `SELECT event_type AS t, metadata AS m FROM events WHERE ts > ? AND event_type IN ('lecture', 'explanation')`
  ).all(sinceMs) as { t: string; m: string }[];
  const by = new Map<string, { id: string; lectures: number; explainBack?: "full" | "partial" }>();
  for (const r of rows) {
    let meta: { concept?: string; quality?: string } = {};
    try { meta = JSON.parse(r.m ?? "{}"); } catch { continue; }
    if (!meta.concept) continue;
    const e = by.get(meta.concept) ?? { id: meta.concept, lectures: 0 };
    if (r.t === "lecture") e.lectures++;
    else if (meta.quality === "full" || (meta.quality === "partial" && e.explainBack !== "full")) e.explainBack = meta.quality as "full" | "partial";
    by.set(meta.concept, e);
  }
  return [...by.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function progressSnapshot(days = 30, now = Date.now()): ProgressSnapshot {
  const since = now - days * DAY_MS;
  return {
    period: { from: iso(since), to: iso(now), days },
    domains: Object.fromEntries(getSkillSnapshot().map((s) => [s.domain, { score: s.score, trend: s.trend, delegationRate: s.delegationRate }])),
    habits: habits(since),
    concepts: conceptsStudied(since)
  };
}

export function proposeGoals(snapshot: ProgressSnapshot, now = Date.now(), max = 3): GoalProposal[] {
  const month = iso(now).slice(0, 7);
  const due = iso(now + GOAL_DAYS * DAY_MS);
  const out: GoalProposal[] = [];
  const h = snapshot.habits;

  if (h.predictRate < PREDICT_TARGET) {
    out.push({
      id: `predict-rate-${month}`,
      title: `Predict before asking in ${Math.round(PREDICT_TARGET * 100)}% of my delegations`,
      why: `In the last ${snapshot.period.days} days, ${Math.round(h.predictRate * 100)}% of ${h.delegations} delegations started with a prediction.`,
      metric: { kind: "habit-rate", key: "predictRate", from: h.predictRate, target: PREDICT_TARGET },
      due, suggestedPractice: ["Write a hypothesis with /plum:predict before asking Claude to debug or design"]
    });
  }
  out.push({
    id: `explain-back-${month}`,
    title: `Explain back ${EXPLAIN_STEP} changes or concepts in ${GOAL_DAYS} days`,
    why: `${h.explanations} explain-back${h.explanations === 1 ? "" : "s"} in the last ${snapshot.period.days} days.`,
    metric: { kind: "habit-count", key: "explanations", from: h.explanations, target: h.explanations + EXPLAIN_STEP },
    due, suggestedPractice: ["Run /plum:explain after accepting a non-trivial change"]
  });

  // A concept for the weakest domain that hasn't been studied yet.
  const studied = new Set(snapshot.concepts.filter((c) => c.explainBack === "full").map((c) => c.id));
  const weakest = Object.entries(snapshot.domains).sort((a, b) => a[1].score - b[1].score).map(([d]) => d);
  const concepts = loadConcepts();
  for (const domain of weakest) {
    const pick = concepts.find((c) => c.domain === domain && !studied.has(c.id));
    if (!pick) continue;
    out.push({
      id: `concept-${pick.id}-${month}`,
      title: `Study ${pick.title} and explain it back`,
      why: `${domain} is my lowest-scoring area in Plum, and I haven't explained ${pick.title} back yet.`,
      metric: { kind: "concepts-completed", key: pick.id, from: 0, target: 1 },
      due, suggestedPractice: [`/plum:teach ${pick.id}`, "Answer the lecture's explain-back question"]
    });
    break;
  }
  return out.slice(0, max);
}

export function saveProposals(proposals: GoalProposal[]): void {
  mkdirSync(GOALS_DIR, { recursive: true });
  const existing = loadProposals();
  const merged = { ...Object.fromEntries(existing.map((p) => [p.id, p])), ...Object.fromEntries(proposals.map((p) => [p.id, p])) };
  writeFileSync(PROPOSALS_PATH, JSON.stringify(Object.values(merged), null, 2));
}

export function loadProposals(): GoalProposal[] {
  if (!existsSync(PROPOSALS_PATH)) return [];
  try { const v = JSON.parse(readFileSync(PROPOSALS_PATH, "utf-8")); return Array.isArray(v) ? v : []; } catch { return []; }
}

// Current value of a goal's metric: rates over a rolling window, counts since the goal was linked.
export function metricValue(metric: Metric, sinceMs: number, now = Date.now()): number {
  if (metric.kind === "habit-rate") return habits(now - GOAL_DAYS * DAY_MS).predictRate;
  if (metric.kind === "habit-count") return metric.from + habits(sinceMs).explanations;
  const c = conceptsStudied(0).find((x) => x.id === metric.key);
  return c?.explainBack === "full" ? 1 : c && (c.lectures > 0 || c.explainBack === "partial") ? 0.5 : 0;
}

// Human-readable metric values: rates as percentages, concept goals as a state.
export function formatValue(metric: Metric, v: number): string {
  if (metric.kind === "habit-rate") return `${Math.round(v * 100)}%`;
  if (metric.kind === "concepts-completed") return v >= 1 ? "explained back" : v > 0 ? "started" : "not started";
  return String(v);
}

export function percentDone(metric: Metric, current: number): number {
  const span = metric.target - metric.from;
  if (span <= 0) return current >= metric.target ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round(((current - metric.from) / span) * 100)));
}

// ─── `plum progress` / `plum goals` ──────────────────────────────────────────

export function runProgressCommand(argv: string[]): number {
  const days = Math.max(1, Math.min(365, Number(argv[argv.indexOf("--days") + 1]) || 30));
  const s = progressSnapshot(days);
  if (argv.includes("--json")) { console.log(JSON.stringify(s, null, 2)); return 0; }
  const h = s.habits;
  console.log([
    `Plum progress, ${s.period.from} → ${s.period.to}`,
    `  Predict before asking: ${Math.round(h.predictRate * 100)}% of ${h.delegations} delegations`,
    `  Explain-backs: ${h.explanations} · Solved independently: ${h.independence}`,
    `  Concepts studied: ${s.concepts.map((c) => `${c.id}${c.explainBack ? ` (${c.explainBack})` : ""}`).join(", ") || "none"}`,
    `  Skill scores: ${Object.entries(s.domains).map(([d, v]) => `${d} ${v.score}`).join(", ")}`
  ].join("\n"));
  return 0;
}

export function runGoalsCommand(argv: string[]): number {
  const [sub] = argv;
  const json = argv.includes("--json");
  if (sub === "propose") {
    const proposals = proposeGoals(progressSnapshot());
    saveProposals(proposals);
    if (json) { console.log(JSON.stringify(proposals, null, 2)); return 0; }
    for (const p of proposals) console.log(`- ${p.id}: ${p.title} (by ${p.due})\n    ${p.why}\n    Practice: ${p.suggestedPractice.join("; ")}`);
    return 0;
  }
  console.error("Usage: plum goals propose [--json] | progress [--json]");
  return 1;
}
