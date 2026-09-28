// Coaching commands Claude runs during a conversation: read the skill context, and log explain-back and
// independence events. Plain CLI (`plum context`, `plum explained`, `plum independent`) over the local DB.
import { getDb, latestSessionId } from "./db.js";
import { getSkillSnapshot, getOverallHealthScore, updateSkillScore } from "./skill-model.js";
import { detectPatterns } from "./patterns.js";
import { conceptsForDomain } from "./library.js";

const DOMAINS = ["implementation", "debugging", "testing", "architecture", "synthesis"];

const GUIDANCE: Record<string, string> = {
  debugging:      "Ask for a hypothesis before debugging. Don't start until they attempt.",
  testing:        "Ask the user to write the test spec before you implement tests.",
  implementation: "After each change, ask the user to explain what it does.",
  architecture:   "Ask the user to sketch an approach before you design.",
  synthesis:      "Ask the user to predict the answer before you explain."
};

function checkDomain(domain: string): string {
  if (!DOMAINS.includes(domain)) throw new Error(`Unknown domain "${domain}" — expected one of ${DOMAINS.join("|")}`);
  return domain;
}

export function skillContext(): string {
  const snapshot = getSkillSnapshot();
  const sessionId = latestSessionId();
  const patterns = sessionId ? detectPatterns(sessionId) : [];
  const lines = [`Professor Plum — Skill Context`, `Overall health: ${getOverallHealthScore()}/100`, ``, `Skill scores:`];
  for (const s of snapshot) {
    const flag = s.atRisk ? " ⚠ AT RISK" : s.score >= 70 ? " ✓" : "";
    lines.push(`  ${s.label.padEnd(14)} ${s.score}/100 ${{ up: "↑", down: "↓", stable: "→" }[s.trend]}${flag}  (${s.delegationRate}% delegated)`);
  }
  const atRisk = snapshot.filter((s) => s.atRisk);
  if (atRisk.length > 0) {
    lines.push(``, `Coaching guidance for at-risk domains:`);
    for (const s of atRisk) {
      lines.push(`  ${s.label}: ${GUIDANCE[s.domain] ?? "require engagement before answering"}`);
      const concepts = conceptsForDomain(s.domain).map((c) => `/plum:teach ${c.id}`);
      if (concepts.length > 0) lines.push(`    Offer a lecture: ${concepts.join(", ")}`);
    }
  }
  if (patterns.length > 0) {
    lines.push(``, `Active patterns detected this session:`);
    for (const p of patterns) lines.push(`  [${p.severity.toUpperCase()}] ${p.pattern}: ${p.context}`);
  }
  return lines.join("\n");
}

function logEvent(kind: "explanation" | "independence", domain: string, metadata: object, bonus: number, predicted: boolean): void {
  const db = getDb();
  const now = Date.now();
  db.run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, verified, metadata) VALUES (?, ?, ?, ?, 0, 1, ?)`,
    [latestSessionId() ?? "manual", now, kind, domain, JSON.stringify(metadata)]
  );
  updateSkillScore(domain, false, true, predicted);
  const row = db.query(`SELECT score FROM skill_scores WHERE domain = ?`).get(domain) as { score: number } | null;
  if (row) db.run(`UPDATE skill_scores SET score = ?, updated_at = ? WHERE domain = ?`, [Math.min(100, row.score + bonus), now, domain]);
}

// An explanation is the second-strongest positive signal (full +3 on top of the verified delta, partial +1).
export function logExplanation(domain: string, quality: "full" | "partial"): string {
  logEvent("explanation", checkDomain(domain), { quality }, quality === "full" ? 3 : 1, false);
  return `[Plum] Explanation logged for ${domain} (${quality}). Skill score updated. ✓`;
}

// Solving it without delegating is the strongest signal.
export function logIndependence(domain: string): string {
  logEvent("independence", checkDomain(domain), { source: "cli" }, 1, true);
  return `[Plum] Independence logged for ${domain}. Strong positive signal — skill score updated. ✓`;
}
