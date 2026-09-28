import { getDb } from "./db.js";

const WEEK_MS = 604_800_000;

// 7-day engagement summary (spec metrics RQ1–RQ5). Shared by the CLI and the MCP server.
export function weeklyStatus(): string {
  const db   = getDb();
  const week = Date.now() - WEEK_MS;
  const q    = (sql: string) => ((db.query(sql).get(week) as any)?.c ?? 0) as number;

  const sessions      = q(`SELECT COUNT(*) as c FROM sessions WHERE started_at > ?`);
  const delegated     = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND delegated = 1`);
  const verified      = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND delegated = 1 AND verified = 1`);
  const predicts      = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND event_type = 'predict'`);
  const explanations  = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND event_type = 'explanation'`);
  const independence  = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND event_type = 'independence'`);
  const nudges        = q(`SELECT COUNT(*) as c FROM interventions WHERE ts > ?`);
  const explainNudges = q(`SELECT COUNT(*) as c FROM interventions WHERE ts > ? AND intervention_type = 'explain_back'`);

  const pct = (n: number, d: number) => d > 0 ? `${Math.round((n / d) * 100)}%` : "n/a";
  const pad = (n: number) => n.toString().padStart(3);

  return [
    `Professor Plum — last 7 days  (spec metrics RQ1–RQ5)`,
    `  Sessions:            ${sessions}`,
    `  Delegations:         ${delegated}`,
    `  Verified:            ${pad(verified)}  (${pct(verified, delegated)} verify rate)`,
    `  Predictions:         ${pad(predicts)}  (${pct(predicts, delegated)} predict rate)`,
    `  Explanations:        ${pad(explanations)}  (${pct(explanations, explainNudges)} explain rate)`,
    `  Independence events: ${pad(independence)}`,
    `  Nudges fired:        ${nudges}`
  ].join("\n");
}
