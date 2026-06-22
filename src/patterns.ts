import { getDb } from "./db.js";
import { getConfig } from "./config.js";

export type PatternId =
  | "test_delegation"
  | "debugging_avoidance"
  | "blind_acceptance"
  | "architectural_outsourcing"
  | "repeated_weakness"
  | "decision_outsourcing"
  | "design_critique_atrophy";

export interface PatternResult {
  pattern: PatternId;
  severity: "low" | "medium" | "high";
  domain: string;
  context: string;
}

export function detectPatterns(sessionId: string): PatternResult[] {
  const db = getDb();
  const cfg = getConfig();
  const t = cfg.thresholds;
  const results: PatternResult[] = [];
  const now = Date.now();

  // Gate: need minimum data before intervening (avoids false positives on first few events)
  const totalEvents = (
    db.query(`SELECT COUNT(*) as c FROM events WHERE session_id = ?`).get(sessionId) as any
  )?.c ?? 0;
  if (totalEvents < cfg.minEventsBeforeIntervene) return [];

  // ── 1. Test delegation ────────────────────────────────────────────────────
  const testRow = db.query(`
    SELECT COUNT(*) as cnt, SUM(delegated) as del
    FROM events
    WHERE session_id = ? AND category = 'testing'
  `).get(sessionId) as any;

  if ((testRow?.cnt ?? 0) >= t.testDelegationMin && testRow?.del === testRow?.cnt) {
    results.push({
      pattern: "test_delegation",
      severity: (testRow.cnt ?? 0) >= 5 ? "high" : "medium",
      domain: "testing",
      context: `tests delegated ${testRow.cnt}× this session with no independent work`
    });
  }

  // ── 2. Debugging avoidance (weekly window) ────────────────────────────────
  const debugRow = db.query(`
    SELECT COUNT(*) as cnt, SUM(delegated) as del
    FROM events
    WHERE category = 'debugging' AND ts > ?
  `).get(now - t.weekLookbackMs) as any;

  const debugCnt = debugRow?.cnt ?? 0;
  const debugDel = debugRow?.del ?? 0;
  if (debugCnt >= 5 && debugCnt > 0 && debugDel / debugCnt >= t.debugDelegationRate) {
    results.push({
      pattern: "debugging_avoidance",
      severity: debugCnt >= 10 ? "high" : "medium",
      domain: "debugging",
      context: `${Math.round((debugDel / debugCnt) * 100)}% of debugging delegated this week (${debugCnt} events)`
    });
  }

  // ── 3. Blind acceptance — many Agent calls, zero predictions ─────────────
  const agentCnt = (
    db.query(`SELECT COUNT(*) as c FROM events WHERE session_id = ? AND tool_name = 'Agent' AND delegated = 1`).get(sessionId) as any
  )?.c ?? 0;

  const predCnt = (
    db.query(`SELECT COUNT(*) as c FROM events WHERE session_id = ? AND event_type = 'predict'`).get(sessionId) as any
  )?.c ?? 0;

  if (agentCnt >= t.blindAcceptanceMin && predCnt === 0) {
    results.push({
      pattern: "blind_acceptance",
      severity: agentCnt >= 7 ? "high" : "medium",
      domain: "synthesis",
      context: `${agentCnt} agent delegations with zero predictions this session`
    });
  }

  // ── 4. Architectural outsourcing (weekly) ─────────────────────────────────
  const archRow = db.query(`
    SELECT COUNT(*) as cnt, SUM(delegated) as del
    FROM events
    WHERE category = 'architecture' AND ts > ?
  `).get(now - t.weekLookbackMs) as any;

  const archCnt = archRow?.cnt ?? 0;
  const archDel = archRow?.del ?? 0;
  if (archCnt >= t.archOutsourcingMin && archCnt > 0 && archDel / archCnt >= t.archOutsourcingRate) {
    results.push({
      pattern: "architectural_outsourcing",
      severity: "medium",
      domain: "architecture",
      context: `${archDel}/${archCnt} architecture decisions delegated this week`
    });
  }

  // ── 5. Repeated weakness — same domain dominates multiple sessions ────────
  const recRow = db.query(`
    SELECT category, COUNT(DISTINCT session_id) as sessions, COUNT(*) as total
    FROM events
    WHERE ts > ? AND delegated = 1 AND category NOT IN ('search', 'synthesis')
    GROUP BY category
    ORDER BY sessions DESC
    LIMIT 1
  `).get(now - t.weekLookbackMs) as any;

  if ((recRow?.sessions ?? 0) >= 3 && (recRow?.total ?? 0) >= 10) {
    results.push({
      pattern: "repeated_weakness",
      severity: "medium",
      domain: recRow.category,
      context: `${recRow.category} delegated across ${recRow.sessions} sessions this week (${recRow.total} events)`
    });
  }

  return results;
}
