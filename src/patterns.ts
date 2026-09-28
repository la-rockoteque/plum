import { getDb }                          from "./db.js";
import { getConfig }                      from "./config.js";

export const PATTERN_IDS = [
  "test_delegation",
  "debugging_avoidance",
  "blind_acceptance",
  "architectural_outsourcing",
  "repeated_weakness",
  "decision_outsourcing",
  "design_critique_atrophy"
] as const;

export type PatternId = (typeof PATTERN_IDS)[number];

// Metadata keys stored in user_prompt events
const DECISION_META_KEY = "is_decision_seeking";
const DESIGN_META_KEY   = "is_design_related";

export interface PatternResult {
  pattern: PatternId;
  severity: "low" | "medium" | "high";
  domain: string;
  context: string;
  scope: "session" | "week";   // what the pattern measures — also the scope of its cooldown
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
    WHERE session_id = ? AND category = 'testing' AND event_type != 'user_prompt'
  `).get(sessionId) as any;
  // Prompts that mention tests aren't independent work; predict/explanation/independence rows are.

  if ((testRow?.cnt ?? 0) >= t.testDelegationMin && testRow?.del === testRow?.cnt) {
    results.push({
      pattern: "test_delegation",
      scope: "session",
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
      scope: "week",
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
      scope: "session",
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
      scope: "week",
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
      scope: "week",
      severity: "medium",
      domain: recRow.category,
      context: `${recRow.category} delegated across ${recRow.sessions} sessions this week (${recRow.total} events)`
    });
  }

  // ── 6. Decision outsourcing — user asks Claude to decide without constraints ─
  // Detected from user_prompt events that have is_decision_seeking=true
  const decisionRow = db.query(`
    SELECT COUNT(*) as cnt
    FROM events
    WHERE session_id = ?
      AND event_type = 'user_prompt'
      AND json_extract(metadata, '$.${DECISION_META_KEY}') = 1
  `).get(sessionId) as any;

  const predictInSession = (
    db.query(`SELECT COUNT(*) as c FROM events WHERE session_id = ? AND event_type = 'predict'`).get(sessionId) as any
  )?.c ?? 0;

  // Fire if 3+ decision-seeking prompts in session with zero predictions (user not thinking independently)
  if ((decisionRow?.cnt ?? 0) >= 3 && predictInSession === 0) {
    results.push({
      pattern: "decision_outsourcing",
      scope: "session",
      severity: "medium",
      domain: "synthesis",
      context: `${decisionRow.cnt} decision-seeking prompts this session with zero independent predictions`
    });
  }

  // ── 7. Design critique atrophy — design prompts whose sessions' delegations go unverified ─
  // Design intent only exists on user_prompt events, so join back to the delegations in those sessions.
  const designRow = db.query(`
    WITH design_prompts AS (
      SELECT session_id FROM events
      WHERE ts > ? AND event_type = 'user_prompt'
        AND json_extract(metadata, '$.${DESIGN_META_KEY}') = 1
    )
    SELECT
      (SELECT COUNT(*) FROM design_prompts) AS cnt,
      COUNT(*)                              AS del,
      COALESCE(SUM(verified), 0)            AS ver
    FROM events
    WHERE ts > ? AND delegated = 1
      AND session_id IN (SELECT session_id FROM design_prompts)
  `).get(now - t.weekLookbackMs, now - t.weekLookbackMs) as any;

  const designCnt = designRow?.cnt ?? 0;
  const designDel = designRow?.del ?? 0;
  const designVer = designRow?.ver ?? 0;

  // Fire if 3+ design prompts this week and <20% of the resulting delegations were verified
  if (designCnt >= 3 && designDel > 0 && designVer / designDel < 0.2) {
    results.push({
      pattern: "design_critique_atrophy",
      scope: "week",
      severity: designCnt >= 6 ? "high" : "medium",
      domain: "architecture",
      context: `${designCnt} design requests this week — only ${designVer}/${designDel} resulting changes verified`
    });
  }

  return results.filter((r) => cfg.domains[r.domain] !== false);
}
