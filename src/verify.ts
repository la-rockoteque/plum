/**
 * Verification signal detection.
 *
 * "Verified" means the user did something that demonstrates they checked or engaged
 * with a prior delegation, rather than just accepting it blindly.
 *
 * Detection heuristics (in order of confidence):
 *   HIGH   — Bash with test command after Edit/Write/Agent     (user ran tests)
 *   HIGH   — Read of a file that was just edited               (user read the diff)
 *   MEDIUM — Any Bash within 5 min of an Edit/Write/Agent      (user ran the code)
 *   LOW    — Another Edit/Write that modifies same file        (user iterated)
 *
 * Manual signal:
 *   `plum verify`  — explicit opt-in, strongest signal
 */

import { getDb } from "./db.js";
import { updateSkillScore } from "./skill-model.js";

const VERIFICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const TEST_CMD_RE = /\btest\b|jest|vitest|pytest|rspec|cargo test|go test|npm test|bun test|mocha|coverage/i;

export type VerificationConfidence = "high" | "medium" | "low";

export interface VerificationResult {
  verified: boolean;
  confidence: VerificationConfidence;
  targetEventId: number | null;
  reason: string;
}

/**
 * Called from handlePostTool — checks whether the current tool use looks like
 * verification of a recent delegation in the same session.
 */
export function detectAndMarkVerification(
  sessionId: string,
  currentTool: string,
  currentTs: number,
  toolInput: unknown
): VerificationResult {
  const db = getDb();

  // Find the most recent unverified delegation event in this session
  const recent = db.query(`
    SELECT id, tool_name, category, ts, metadata
    FROM events
    WHERE session_id = ?
      AND delegated = 1
      AND verified  = 0
      AND event_type IN ('pre_tool', 'post_tool')
      AND tool_name IN ('Edit', 'Write', 'Agent')
      AND ts > ?
    ORDER BY ts DESC
    LIMIT 1
  `).get(sessionId, currentTs - VERIFICATION_WINDOW_MS) as any;

  if (!recent) {
    return { verified: false, confidence: "low", targetEventId: null, reason: "no recent unverified delegation" };
  }

  const inputStr = JSON.stringify(toolInput ?? "");
  let confidence: VerificationConfidence = "low";
  let reason = "";

  if (currentTool === "Bash") {
    if (TEST_CMD_RE.test(inputStr)) {
      confidence = "high";
      reason = "ran tests after delegation";
    } else {
      confidence = "medium";
      reason = "ran command after delegation";
    }
  } else if (currentTool === "Read") {
    // Check if the file being read matches the file that was just edited
    const meta = safeJson(recent.metadata);
    const editedFile = meta?.file_path ?? "";
    const readFile = (toolInput as any)?.file_path ?? "";
    if (editedFile && readFile && editedFile === readFile) {
      confidence = "high";
      reason = "read the file that was just edited";
    } else {
      confidence = "medium";
      reason = "read a file after delegation";
    }
  } else {
    return { verified: false, confidence: "low", targetEventId: null, reason: "tool is not a verification signal" };
  }

  // Mark the target event as verified
  db.run(`UPDATE events SET verified = 1 WHERE id = ?`, [recent.id]);

  // Update skill score with the verified signal
  updateSkillScore(recent.category, true, true);

  return { verified: true, confidence, targetEventId: recent.id, reason };
}

/**
 * Called from `plum verify` command — marks the N most recent unverified
 * delegations in the current (or given) session as manually verified.
 */
export function manualVerify(sessionId: string = "manual", count: number = 1): number {
  const db = getDb();
  const now = Date.now();

  const targets = db.query(`
    SELECT id, category
    FROM events
    WHERE session_id = ?
      AND delegated = 1
      AND verified  = 0
      AND event_type IN ('pre_tool', 'post_tool')
      AND tool_name IN ('Edit', 'Write', 'Agent', 'Bash')
      AND ts > ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(sessionId, now - VERIFICATION_WINDOW_MS * 12, count) as any[];

  for (const t of targets) {
    db.run(`UPDATE events SET verified = 1 WHERE id = ?`, [t.id]);
    updateSkillScore(t.category, true, true);
  }

  return targets.length;
}

function safeJson(s: string | null): Record<string, unknown> {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
}
