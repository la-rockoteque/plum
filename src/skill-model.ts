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

export function getSkillSnapshot(): SkillSnapshot[] {
  const db = getDb();
  const rows = db.query(`SELECT * FROM skill_scores ORDER BY domain`).all() as any[];

  return rows.map((row) => {
    const total = (row.delegation_count as number) + (row.verification_count as number);
    const delegationRate = total > 0
      ? Math.round(((row.delegation_count as number) / total) * 100)
      : 50;
    const score = Math.round(row.score as number);

    let trend: "up" | "down" | "stable" = "stable";
    if (score > 57) trend = "up";
    else if (score < 43) trend = "down";

    return {
      domain:       row.domain as SkillDomain,
      score,
      trend,
      delegationRate,
      label:        LABELS[row.domain] ?? row.domain,
      atRisk:       score < 40
    };
  });
}

export function getOverallHealthScore(): number {
  const snapshot = getSkillSnapshot();
  if (snapshot.length === 0) return 50;
  return Math.round(snapshot.reduce((s, x) => s + x.score, 0) / snapshot.length);
}
