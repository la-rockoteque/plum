import { getDb } from "./db.js";

export type SkillDomain = "implementation" | "debugging" | "testing" | "architecture" | "synthesis";

export interface SkillSnapshot {
  domain: SkillDomain;
  score: number;
  trend: "up" | "down" | "stable";
  delegationRate: number;
  label: string;
  atRisk: boolean;
}

const LABELS: Record<string, string> = {
  implementation: "Implementation",
  debugging:      "Debugging",
  testing:        "Testing",
  architecture:   "Architecture",
  synthesis:      "Synthesis"
};

// Legacy running score (v1). Still written for research exports; no longer shown — see Scoring v2 below.
// Score deltas per event type
const DELTA = {
  independent:     +2,  // user solved it themselves
  verified:        +1,  // user verified the output
  predicted:       +2,  // user predicted before asking
  blindDelegation: -1   // accepted without verifying
};

export function updateSkillScore(
  domain: string,
  delegated: boolean,
  verified: boolean,
  predicted: boolean = false
): void {
  if (domain === "search") return;

  const db = getDb();
  const row = db.query(`SELECT * FROM skill_scores WHERE domain = ?`).get(domain) as any;
  if (!row) return;

  let delta = 0;
  if (!delegated)           delta += DELTA.independent;
  if (verified)             delta += DELTA.verified;
  if (predicted)            delta += DELTA.predicted;
  if (delegated && !verified) delta += DELTA.blindDelegation;

  const newScore = Math.max(0, Math.min(100, (row.score as number) + delta));

  db.run(
    `UPDATE skill_scores SET
       score              = ?,
       delegation_count   = delegation_count   + ?,
       verification_count = verification_count + ?,
       prediction_count   = prediction_count   + ?,
       updated_at         = ?
     WHERE domain = ?`,
    [newScore, delegated ? 1 : 0, verified ? 1 : 0, predicted ? 1 : 0, Date.now(), domain]
  );
}

// ─── Scoring v2 ──────────────────────────────────────────────────────────────
// A domain's score is the weighted engagement of the user's own *requests* in that domain over the last 30 days,
// not a running sum of tool calls (which saturated at 0 or 100 within a session). Each prompt is a request;
// it's engaged by what the user does around it: a prediction before it (1), an explain-back after it
// (full 2, partial 1), a manual verify after it (1). Solving something yourself is a fully engaged request (3).
// A request's value is min(weight, 3) / 3. Score = 100 · (Σ value + 2) / (requests + 4): 50 with no data,
// and a few events can't push it to an extreme. Claude's own test runs and file reads are neutral.

export interface ScoringEvent {
  session: string;
  ts: number;
  type: "user_prompt" | "predict" | "explanation" | "manual_verify" | "independence" | "post_tool";
  domain?: string;
  quality?: "full" | "partial";
}

export interface DomainScore {
  domain: SkillDomain;
  score: number;
  engagement: number;        // mean request value, 0–1
  requests: number;
  trend: "up" | "down" | "stable";
  atRisk: boolean;
}

const DOMAINS: SkillDomain[] = ["implementation", "debugging", "testing", "architecture", "synthesis"];
const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;
const TREND_DAYS = 7;
const TREND_MIN_REQUESTS = 3;
const TREND_THRESHOLD = 5;
const AT_RISK_SCORE = 35;
const AT_RISK_MIN_REQUESTS = 10;
const MAX_WEIGHT = 3;
const PRIOR_VALUE = 2;         // a prior of 4 requests at 0.5 engagement
const PRIOR_REQUESTS = 4;

interface Request { domain: string; ts: number; weight: number }

function requestsFrom(events: ScoringEvent[]): Request[] {
  const bySession = new Map<string, ScoringEvent[]>();
  for (const e of events) (bySession.get(e.session) ?? bySession.set(e.session, []).get(e.session)!).push(e);
  const out: Request[] = [];
  for (const list of bySession.values()) {
    list.sort((a, b) => a.ts - b.ts);
    let pending = 0;
    let current: Request | null = null;
    for (const e of list) {
      if (e.type === "predict") pending += 1;
      else if (e.type === "user_prompt" && e.domain) { current = { domain: e.domain, ts: e.ts, weight: pending }; pending = 0; out.push(current); }
      else if (e.type === "explanation" && current) current.weight += e.quality === "partial" ? 1 : 2;
      else if (e.type === "manual_verify" && current) current.weight += 1;
      else if (e.type === "independence" && e.domain) out.push({ domain: e.domain, ts: e.ts, weight: MAX_WEIGHT });
    }
  }
  return out;
}

function scoreOf(reqs: Request[]): { score: number; engagement: number } {
  const total = reqs.reduce((n, r) => n + Math.min(r.weight, MAX_WEIGHT) / MAX_WEIGHT, 0);
  return {
    score: Math.round((100 * (total + PRIOR_VALUE)) / (reqs.length + PRIOR_REQUESTS)),
    engagement: reqs.length ? total / reqs.length : 0
  };
}

export function scoreDomains(events: ScoringEvent[], now = Date.now()): DomainScore[] {
  const reqs = requestsFrom(events);
  const inRange = (from: number, to: number, d: string) => reqs.filter((r) => r.domain === d && r.ts > from && r.ts <= to);
  return DOMAINS.map((domain) => {
    const window = inRange(now - WINDOW_DAYS * DAY_MS, now, domain);
    const { score, engagement } = scoreOf(window);
    const recent = inRange(now - TREND_DAYS * DAY_MS, now, domain);
    const before = inRange(now - 2 * TREND_DAYS * DAY_MS, now - TREND_DAYS * DAY_MS, domain);
    let trend: DomainScore["trend"] = "stable";
    if (recent.length >= TREND_MIN_REQUESTS && before.length >= TREND_MIN_REQUESTS) {
      const diff = scoreOf(recent).score - scoreOf(before).score;
      trend = diff > TREND_THRESHOLD ? "up" : diff < -TREND_THRESHOLD ? "down" : "stable";
    }
    return { domain, score, engagement, requests: window.length, trend,
             atRisk: score < AT_RISK_SCORE && window.length >= AT_RISK_MIN_REQUESTS };
  });
}

function loadScoringEvents(now: number): ScoringEvent[] {
  const rows = getDb().query(
    `SELECT session_id AS s, ts, event_type AS t, category AS c, metadata AS m FROM events
     WHERE ts > ? AND event_type IN ('user_prompt', 'predict', 'explanation', 'manual_verify', 'independence')`
  ).all(now - WINDOW_DAYS * DAY_MS) as { s: string; ts: number; t: ScoringEvent["type"]; c: string | null; m: string | null }[];
  return rows.map((r) => {
    let quality: "full" | "partial" | undefined;
    if (r.t === "explanation") { try { quality = JSON.parse(r.m ?? "{}").quality === "partial" ? "partial" : "full"; } catch { quality = "full"; } }
    return { session: r.s, ts: r.ts, type: r.t, domain: r.c ?? undefined, quality };
  });
}

export function getSkillSnapshot(now = Date.now()): (SkillSnapshot & { requests: number; engagement: number })[] {
  return scoreDomains(loadScoringEvents(now), now).map((d) => ({
    domain: d.domain,
    score: d.score,
    trend: d.trend,
    // Share of requests with no engagement at all ("just delegated").
    delegationRate: d.requests ? Math.round(100 - 100 * d.engagement) : 0,
    label: LABELS[d.domain] ?? d.domain,
    atRisk: d.atRisk,
    requests: d.requests,
    engagement: d.engagement
  }));
}

// Weighted by how much data each domain has, so an idle domain's neutral 50 doesn't drown the others.
export function getOverallHealthScore(): number {
  const snapshot = getSkillSnapshot();
  const weight = (s: { requests: number }) => s.requests + PRIOR_REQUESTS;
  const total = snapshot.reduce((n, s) => n + weight(s), 0);
  return total ? Math.round(snapshot.reduce((n, s) => n + s.score * weight(s), 0) / total) : 50;
}
