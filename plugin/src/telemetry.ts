/**
 * Opt-in usage statistics. Off by default; only a personal or local config can turn them on (see config.ts).
 *
 * Events hold counts only — command name, duration, per-category counts, file extensions, error type names —
 * and every field is checked against a strict shape before it is written, so free text can't slip in.
 * They live in ~/.plum/usage.jsonl and leave the machine only if the user sends a summary through the
 * feedback form themselves. Recording never throws and never prints.
 */
import { appendFileSync, existsSync, openSync, readFileSync, readSync, closeSync, rmSync, statSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { PLUM_DATA_DIR } from "./env.js";
import { getConfig, configPaths } from "./config.js";
import { PATTERN_IDS } from "./patterns.js";
import { presentFeedback, parseFlags } from "./feedback.js";

export const USAGE_PATH = join(PLUM_DATA_DIR, "usage.jsonl");
export const DEBUG_LOG  = join(PLUM_DATA_DIR, "usage-debug.log");
const MAX_BYTES = 1_000_000;
const DAY_MS    = 86_400_000;

// Only these names can appear as `tool`. Anything else is recorded as "other".
const TOOLS = new Set([
  "pre-tool", "post-tool", "user-prompt", "session-end", "skill-health", "status", "predict", "verify",
  "export", "reset-scores", "wipe", "concepts", "feedback", "verdict", "update-check", "update", "library", "teach",
  "context", "explained", "independent"
]);
const COUNT_KEY = /^[a-z][a-z0-9_]{0,48}$/;
const EXTENSION = /^\.[a-z0-9]{1,8}$/;
const ERROR_TYPE = /^[A-Z][A-Za-z0-9]{0,60}$/;

export interface UsageData {
  durationMs?: number;
  counts?: Record<string, number>;
  extensions?: string[];
  errors?: string[];
}

export interface UsageEvent {
  ts: number;
  tool: string;
  ms?: number;
  counts?: Record<string, number>;
  ext?: string[];
  err?: string[];
}

export function sanitizeEvent(tool: string, data: UsageData, now: number): UsageEvent {
  const event: UsageEvent = { ts: now, tool: TOOLS.has(tool) ? tool : "other" };
  if (typeof data.durationMs === "number" && Number.isFinite(data.durationMs) && data.durationMs >= 0) {
    event.ms = Math.round(data.durationMs);
  }
  const counts = Object.fromEntries(Object.entries(data.counts ?? {})
    .filter(([k, v]) => COUNT_KEY.test(k) && typeof v === "number" && Number.isFinite(v) && v >= 0));
  if (Object.keys(counts).length > 0) event.counts = counts;
  const ext = [...new Set((data.extensions ?? []).map((e) => e.toLowerCase()).filter((e) => EXTENSION.test(e)))];
  if (ext.length > 0) event.ext = ext;
  const err = (data.errors ?? []).filter((e) => ERROR_TYPE.test(e));
  if (err.length > 0) event.err = err;
  return event;
}

// Drop events past retention, then the oldest half while the file would exceed the size cap.
export function trimEvents(events: UsageEvent[], o: { retentionDays: number; maxBytes: number; now: number }): UsageEvent[] {
  let kept = events.filter((e) => e.ts >= o.now - o.retentionDays * DAY_MS);
  while (kept.length > 1 && serialize(kept).length > o.maxBytes) kept = kept.slice(Math.floor(kept.length / 2));
  return kept;
}

const serialize = (events: UsageEvent[]) => events.map((e) => JSON.stringify(e)).join("\n") + (events.length ? "\n" : "");

// ─── recording ───────────────────────────────────────────────────────────────

export function record(tool: string, data: UsageData = {}): void {
  try {
    const { telemetry } = getConfig();
    if (!telemetry.enabled) return;
    const now = Date.now();
    mkdirSync(PLUM_DATA_DIR, { recursive: true });
    appendFileSync(USAGE_PATH, JSON.stringify(sanitizeEvent(tool, data, now)) + "\n");
    if (statSync(USAGE_PATH).size > MAX_BYTES || oldestTs() < now - telemetry.retentionDays * DAY_MS) {
      writeFileSync(USAGE_PATH, serialize(trimEvents(readEvents(), { retentionDays: telemetry.retentionDays, maxBytes: MAX_BYTES / 2, now })));
    }
  } catch { /* statistics must never break a run */ }
}

export function recordError(tool: string, error: unknown, data: UsageData = {}): void {
  try {
    const name = error instanceof Error ? error.constructor.name : "NonError";
    record(tool, { ...data, errors: [...(data.errors ?? []), name] });
    const { telemetry } = getConfig();
    if (telemetry.enabled && telemetry.debug) {
      const stack = error instanceof Error ? error.stack ?? String(error) : String(error);
      appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${tool}\n${stack}\n\n`);
      if (statSync(DEBUG_LOG).size > MAX_BYTES) {
        const text = readFileSync(DEBUG_LOG, "utf-8");
        writeFileSync(DEBUG_LOG, text.slice(Math.floor(text.length / 2)));   // keep the newest half
      }
    }
  } catch { /* never break a run */ }
}

function readEvents(): UsageEvent[] {
  if (!existsSync(USAGE_PATH)) return [];
  return readFileSync(USAGE_PATH, "utf-8").split("\n").flatMap((line) => {
    try { return line ? [JSON.parse(line) as UsageEvent] : []; } catch { return []; }
  });
}

// Timestamp of the first event, reading only up to the first newline. Unknown → Infinity (never forces a rewrite).
function oldestTs(): number {
  const fd = openSync(USAGE_PATH, "r");
  try {
    const buf = Buffer.alloc(8192);
    const n = readSync(fd, buf, 0, buf.length, 0);
    const text = buf.subarray(0, n).toString("utf-8");
    const nl = text.indexOf("\n");
    if (nl < 0) return Infinity;
    const ts = (JSON.parse(text.slice(0, nl)) as UsageEvent).ts;
    return typeof ts === "number" ? ts : Infinity;
  } catch { return Infinity; } finally { closeSync(fd); }
}

// ─── aggregation ─────────────────────────────────────────────────────────────

export interface UsageSummary {
  days: number;
  events: number;
  tools: Record<string, { runs: number; medianMs: number | null }>;
  topCounts: [string, number][];
  extensions: Record<string, number>;
  errors: Record<string, number>;
  verdicts: Record<string, { confirmed: number; false_positive: number; falsePositiveRate: number }>;
}

export function summarize(all: UsageEvent[], o: { days: number; now: number }): UsageSummary {
  const events = all.filter((e) => e.ts >= o.now - o.days * DAY_MS);
  const durations: Record<string, number[]> = {};
  const runs: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const extensions: Record<string, number> = {};
  const errors: Record<string, number> = {};
  const verdicts: UsageSummary["verdicts"] = {};

  for (const e of events) {
    runs[e.tool] = (runs[e.tool] ?? 0) + 1;
    if (typeof e.ms === "number") (durations[e.tool] ??= []).push(e.ms);
    for (const x of e.ext ?? []) extensions[x] = (extensions[x] ?? 0) + 1;
    for (const x of e.err ?? []) errors[x] = (errors[x] ?? 0) + 1;
    for (const [k, v] of Object.entries(e.counts ?? {})) {
      const [pattern, verdict] = k.split("__");
      if (e.tool === "verdict" && (verdict === "confirmed" || verdict === "false_positive")) {
        const row = (verdicts[pattern] ??= { confirmed: 0, false_positive: 0, falsePositiveRate: 0 });
        row[verdict] += v;
      } else {
        counts[k] = (counts[k] ?? 0) + v;
      }
    }
  }
  for (const row of Object.values(verdicts)) {
    const total = row.confirmed + row.false_positive;
    row.falsePositiveRate = total > 0 ? Math.round((row.false_positive / total) * 100) / 100 : 0;
  }

  return {
    days: o.days,
    events: events.length,
    tools: Object.fromEntries(Object.entries(runs).map(([t, n]) => [t, { runs: n, medianMs: median(durations[t] ?? []) }])),
    topCounts: Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 10),
    extensions, errors, verdicts
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

export function formatSummary(s: UsageSummary, days: number): string {
  const list = (o: Record<string, number>) =>
    Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ") || "none";
  const tools = Object.entries(s.tools).sort((a, b) => b[1].runs - a[1].runs)
    .map(([t, r]) => `${t} ${r.runs}${r.medianMs === null ? "" : ` (median ${r.medianMs} ms)`}`).join(", ") || "none";
  const verdicts = Object.entries(s.verdicts)
    .map(([p, v]) => `${p} ${v.confirmed} confirmed / ${v.false_positive} false positive (${Math.round(v.falsePositiveRate * 100)}% false)`)
    .join("; ") || "none";
  return [
    "[Usage statistics]",
    "",
    `Last ${days} days: ${s.events} recorded runs.`,
    `Runs: ${tools}`,
    `Top counts: ${s.topCounts.map(([k, v]) => `${k} ${v}`).join(", ") || "none"}`,
    `File types: ${list(s.extensions)}`,
    `Errors: ${list(s.errors)}`,
    `Nudge verdicts: ${verdicts}`
  ].join("\n");
}

// ─── `plum stats …` ──────────────────────────────────────────────────────────

export async function runStatsCommand(argv: string[]): Promise<number> {
  const [sub = "status", ...rest] = argv;
  const flags = parseFlags(rest);
  const days  = Math.max(1, Math.min(3650, parseInt(flags.days ?? "30", 10) || 30));

  switch (sub) {
    case "status":   return printStatus();
    case "summary": {
      const s = summarize(readEvents(), { days, now: Date.now() });
      console.log(flags.json ? JSON.stringify(s, null, 2) : formatSummary(s, days));
      return 0;
    }
    case "verdicts": return recordVerdicts(rest.find((a) => !a.startsWith("--")) ?? "");
    case "send": {
      const text = formatSummary(summarize(readEvents(), { days, now: Date.now() }), days);
      return presentFeedback(text, flags.open === "true");
    }
    case "clear":
      for (const f of [USAGE_PATH, DEBUG_LOG]) rmSync(f, { force: true, recursive: true });
      console.log("[Plum] Usage statistics cleared.");
      return 0;
    default:
      console.error("Usage: plum stats status | summary [--days N] [--json] | verdicts <json> | send [--days N] [--open] | clear");
      return 1;
  }
}

function printStatus(): number {
  const { telemetry } = getConfig();
  const paths  = configPaths();
  const events = readEvents();
  console.log([
    `Usage statistics: ${telemetry.enabled ? "on" : "off"}${telemetry.debug ? " (debug log on)" : ""}`,
    `  Turn on in ${paths.personal} or ${paths.local}: { "telemetry": { "enabled": true } }`,
    `  A team can turn them off for everyone in ${paths.shared}; it can't turn them on.`,
    `  File: ${USAGE_PATH} — ${events.length} events, ${existsSync(USAGE_PATH) ? statSync(USAGE_PATH).size : 0} bytes, kept ${telemetry.retentionDays} days`,
    telemetry.debug ? `  Debug log: ${DEBUG_LOG} — contains tracebacks with local paths; don't share it.` : ""
  ].filter(Boolean).join("\n"));
  return 0;
}

// Verdicts from the agent or user on Plum's nudges: {"pattern": "<id>", "verdict": "confirmed" | "false_positive"}.
function recordVerdicts(json: string): number {
  let items: unknown;
  try { items = JSON.parse(json); } catch { console.error("[Plum] verdicts expects JSON"); return 1; }
  const list = Array.isArray(items) ? items : [items];
  const counts: Record<string, number> = {};
  for (const v of list as { pattern?: unknown; verdict?: unknown }[]) {
    if (!PATTERN_IDS.includes(v?.pattern as never) || (v?.verdict !== "confirmed" && v?.verdict !== "false_positive")) {
      console.error(`[Plum] Invalid verdict — pattern must be one of ${PATTERN_IDS.join(", ")}; verdict confirmed or false_positive.`);
      return 1;
    }
    const key = `${v.pattern}__${v.verdict}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  if (!getConfig().telemetry.enabled) { console.log("[Plum] Usage statistics are off; verdicts not recorded."); return 0; }
  record("verdict", { counts });
  console.log(`[Plum] Recorded ${list.length} verdict${list.length === 1 ? "" : "s"}.`);
  return 0;
}
