#!/usr/bin/env bun
/**
 * Plum CLI — entry point for all hook commands and user-facing tools.
 *
 * Hook usage (called by shell wrappers in hooks/):
 *   plum pre-tool       reads PreToolUse JSON from stdin
 *   plum post-tool      reads PostToolUse JSON from stdin
 *   plum user-prompt    reads UserPromptSubmit JSON from stdin
 *   plum session-end    reads SessionEnd JSON from stdin
 *
 * User commands:
 *   plum skill-health   print skill radar
 *   plum status         weekly summary
 *   plum predict <txt>  log a prediction (boosts synthesis score)
 *   plum verify         mark recent delegation as verified (boosts score)
 *   plum export         dump DB as JSON
 *   plum reset-scores   reset all skill scores to 50
 *   plum install        wire hooks into ~/.claude/settings.json
 *   plum uninstall      remove hooks from ~/.claude/settings.json
 */

import { getDb }                                      from "./db.js";
import { categorizeToolCall, categorizePrompt, isDelegationSignificant } from "./categorize.js";
import { detectPatterns }                             from "./patterns.js";
import { buildInterventions }                         from "./interventions.js";
import { updateSkillScore, getSkillSnapshot, getOverallHealthScore } from "./skill-model.js";
import { detectAndMarkVerification, manualVerify }    from "./verify.js";
import { getConfig }                                  from "./config.js";
import { PLUM_REPO_DIR }                              from "./env.js";
import { join }                                       from "path";
import { readFileSync, writeFileSync, existsSync }    from "fs";

const command = process.argv[2] ?? "help";

async function readStdin(): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  try { return JSON.parse(raw); } catch { return {}; }
}

async function main(): Promise<void> {
  const cfg = getConfig();
  if (cfg.enabled === false && !["install", "uninstall", "help"].includes(command)) return;

  switch (command) {
    case "pre-tool":     return handlePreTool();
    case "post-tool":    return handlePostTool();
    case "user-prompt":  return handleUserPrompt();
    case "session-end":  return handleSessionEnd();
    case "skill-health": return printSkillHealth();
    case "status":       return printStatus();
    case "predict":      return logPrediction(process.argv.slice(3).join(" "));
    case "verify":       return runManualVerify();
    case "export":       return exportData();
    case "reset-scores": return resetScores();
    case "install":      return installHooks();
    case "uninstall":    return uninstallHooks();
    default:
      console.log(HELP);
  }
}

const HELP = `
Plum — Professor Plum cognitive atrophy harness

  Hook commands (called automatically by Claude Code):
    pre-tool      log PreToolUse event + emit coaching intervention if pattern detected
    post-tool     log PostToolUse event + auto-detect verification + update skill scores
    user-prompt   log UserPromptSubmit + classify intent domain
    session-end   finalize session row + print summary

  User commands:
    skill-health  print skill radar (5 domains, scores 0–100)
    status        weekly delegation + prediction summary
    predict <txt> log a prediction before asking Claude (boosts synthesis score)
    verify        manually mark last delegation as verified (boosts score)
    export        dump DB to JSON (stdout)
    reset-scores  reset all skill scores to 50

  Setup:
    install       wire Plum hooks into ~/.claude/settings.json
    uninstall     remove Plum hooks from ~/.claude/settings.json
`.trim();


// ─── Hook Handlers ────────────────────────────────────────────────────────────

async function handleUserPrompt(): Promise<void> {
  const { session_id, message } = await readStdin() as { session_id?: string; message?: string };
  if (!session_id || !message) return;

  const db  = getDb();
  const now = Date.now();
  const category = categorizePrompt(String(message));

  db.run(
    `INSERT OR IGNORE INTO sessions (id, started_at, project_path) VALUES (?, ?, ?)`,
    [session_id, now, process.cwd()]
  );
  db.run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, metadata) VALUES (?, ?, 'user_prompt', ?, 0, ?)`,
    [session_id, now, category, JSON.stringify({ prompt_len: message.length })]
  );
  db.run(`UPDATE sessions SET event_count = event_count + 1 WHERE id = ?`, [session_id]);
}

async function handlePreTool(): Promise<void> {
  const { session_id, tool_name, tool_input } = await readStdin() as {
    session_id?: string; tool_name?: string; tool_input?: unknown;
  };
  if (!session_id || !tool_name) return;

  const db       = getDb();
  const now      = Date.now();
  const category = categorizeToolCall(tool_name, tool_input);

  db.run(
    `INSERT OR IGNORE INTO sessions (id, started_at, project_path) VALUES (?, ?, ?)`,
    [session_id, now, process.cwd()]
  );
  db.run(
    `INSERT INTO events (session_id, ts, event_type, tool_name, category, delegated, metadata) VALUES (?, ?, 'pre_tool', ?, ?, 1, ?)`,
    [session_id, now, tool_name, category, JSON.stringify({ input_keys: Object.keys((tool_input as object) ?? {}) })]
  );
  db.run(`UPDATE sessions SET event_count = event_count + 1 WHERE id = ?`, [session_id]);

  if (!isDelegationSignificant(tool_name)) return;

  const patterns = detectPatterns(session_id);
  if (patterns.length === 0) return;

  const interventions = buildInterventions(patterns);
  if (interventions.length === 0) return;

  const top = interventions[0];
  process.stdout.write(top.message + "\n");

  db.run(
    `INSERT INTO interventions (ts, session_id, pattern, intervention_type, domain, message) VALUES (?, ?, ?, ?, ?, ?)`,
    [now, session_id, patterns[0].pattern, top.type, top.domain, top.message]
  );
}

async function handlePostTool(): Promise<void> {
  const { session_id, tool_name, tool_input, tool_response } = await readStdin() as {
    session_id?: string; tool_name?: string; tool_input?: unknown; tool_response?: unknown;
  };
  if (!session_id || !tool_name) return;

  const db         = getDb();
  const now        = Date.now();
  const category   = categorizeToolCall(tool_name, tool_input);
  const outputSize = JSON.stringify(tool_response ?? {}).length;

  db.run(
    `INSERT INTO events (session_id, ts, event_type, tool_name, category, output_size, delegated, metadata) VALUES (?, ?, 'post_tool', ?, ?, ?, 1, ?)`,
    [session_id, now, tool_name, category, outputSize, JSON.stringify({ file_path: (tool_input as any)?.file_path })]
  );

  if (isDelegationSignificant(tool_name)) {
    // Check whether this tool use looks like the user verifying a prior delegation
    const result = detectAndMarkVerification(session_id, tool_name, now, tool_input);
    if (!result.verified) {
      // New delegation, not a verification — score goes down slightly
      updateSkillScore(category, true, false);
    }
    // If result.verified, detectAndMarkVerification already updated the score
  }
}

async function handleSessionEnd(): Promise<void> {
  const { session_id } = await readStdin() as { session_id?: string };
  if (!session_id) return;

  const db  = getDb();
  const now = Date.now();
  db.run(`UPDATE sessions SET ended_at = ? WHERE id = ?`, [now, session_id]);

  const session = db.query(`SELECT * FROM sessions WHERE id = ?`).get(session_id) as any;
  const durationMin = session?.started_at ? Math.round((now - session.started_at) / 60_000) : 0;

  const events = db.query(`
    SELECT category, COUNT(*) as cnt
    FROM events WHERE session_id = ? AND category != 'search'
    GROUP BY category ORDER BY cnt DESC
  `).all(session_id) as any[];

  if (events.length > 0) {
    const breakdown = events.map((e) => `${e.category}:${e.cnt}`).join("  ");
    const health    = getOverallHealthScore();
    console.log(`[Plum] Session ${durationMin}m  ${breakdown}  health:${health}/100`);
  }
}


// ─── Skill Health Dashboard ───────────────────────────────────────────────────

function printSkillHealth(): void {
  const snapshot = getSkillSnapshot();
  const overall  = getOverallHealthScore();
  const BAR      = 20;
  const TREND    = { up: "↑", down: "↓", stable: "→" };

  const w = 52;
  const line = (s: string) => `║  ${s.padEnd(w - 4)}║`;

  const rows = [
    `╔${"═".repeat(w)}╗`,
    line("Professor Plum — Skill Health"),
    `╠${"═".repeat(w)}╣`
  ];

  for (const s of snapshot) {
    const filled = Math.round((s.score / 100) * BAR);
    const bar    = "█".repeat(filled) + "░".repeat(BAR - filled);
    const flag   = s.atRisk ? "⚠" : s.score >= 70 ? "✓" : " ";
    const label  = s.label.padEnd(14);
    const score  = String(s.score).padStart(3);
    rows.push(line(`${label} ${bar} ${score} ${TREND[s.trend]} ${flag}`));
  }

  rows.push(`╠${"═".repeat(w)}╣`);
  rows.push(line(`Overall health: ${overall}/100`));
  rows.push(`╚${"═".repeat(w)}╝`);

  console.log(rows.join("\n"));

  for (const s of snapshot.filter((x) => x.atRisk)) {
    console.log(`  ⚠  ${s.label}: ${s.delegationRate}% delegated — use /predict before asking`);
  }
}


// ─── Status ──────────────────────────────────────────────────────────────────

function printStatus(): void {
  const db   = getDb();
  const week = Date.now() - 604_800_000;
  const q    = (sql: string, ...args: unknown[]) =>
    ((db.query(sql).get(...(args as [])) as any)?.c ?? 0) as number;

  const sessions   = q(`SELECT COUNT(*) as c FROM sessions WHERE started_at > ?`, week);
  const delegated  = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND delegated = 1`, week);
  const verified   = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND delegated = 1 AND verified = 1`, week);
  const predicts   = q(`SELECT COUNT(*) as c FROM events WHERE ts > ? AND event_type = 'predict'`, week);
  const nudges     = q(`SELECT COUNT(*) as c FROM interventions WHERE ts > ?`, week);
  const predictRate  = delegated > 0 ? Math.round((predicts  / delegated) * 100) : 0;
  const verifyRate   = delegated > 0 ? Math.round((verified  / delegated) * 100) : 0;

  console.log([
    `Professor Plum — last 7 days`,
    `  Sessions:     ${sessions}`,
    `  Delegations:  ${delegated}`,
    `  Verified:     ${verified}  (${verifyRate}% verify rate)`,
    `  Predictions:  ${predicts}  (${predictRate}% predict rate)`,
    `  Nudges sent:  ${nudges}`
  ].join("\n"));
}


// ─── Predict ─────────────────────────────────────────────────────────────────

function logPrediction(text: string): void {
  if (!text.trim()) {
    console.log("Usage: plum predict <your hypothesis before asking Claude>");
    return;
  }

  const db = getDb();
  db.run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, verified, metadata)
     VALUES ('manual', ?, 'predict', 'synthesis', 0, 1, ?)`,
    [Date.now(), JSON.stringify({ prediction: text })]
  );

  updateSkillScore("synthesis", false, true, true);
  console.log(`[Plum] Prediction logged. Synthesis score updated. ✓`);
}


// ─── Verify ──────────────────────────────────────────────────────────────────

function runManualVerify(): void {
  const sessionArg = process.argv[3];
  const count = parseInt(process.argv[4] ?? "1", 10);

  // Try to find the most recent session if none given
  const db = getDb();
  let sessionId = sessionArg;
  if (!sessionId) {
    const latest = db.query(
      `SELECT id FROM sessions ORDER BY started_at DESC LIMIT 1`
    ).get() as any;
    sessionId = latest?.id ?? "manual";
  }

  const marked = manualVerify(sessionId, isNaN(count) ? 1 : count);
  if (marked === 0) {
    console.log("[Plum] No recent unverified delegations found in the last hour.");
  } else {
    console.log(`[Plum] Marked ${marked} delegation${marked > 1 ? "s" : ""} as verified. Skill scores updated. ✓`);
  }
}


// ─── Export ──────────────────────────────────────────────────────────────────

function exportData(): void {
  const db = getDb();
  console.log(JSON.stringify({
    exported_at:   new Date().toISOString(),
    skill_scores:  db.query(`SELECT * FROM skill_scores`).all(),
    sessions:      db.query(`SELECT * FROM sessions ORDER BY started_at DESC LIMIT 100`).all(),
    events:        db.query(`SELECT * FROM events ORDER BY ts DESC LIMIT 2000`).all(),
    interventions: db.query(`SELECT * FROM interventions ORDER BY ts DESC LIMIT 200`).all()
  }, null, 2));
}


// ─── Reset ───────────────────────────────────────────────────────────────────

function resetScores(): void {
  getDb().run(
    `UPDATE skill_scores SET score = 50.0, delegation_count = 0, verification_count = 0,
     prediction_count = 0, recurrence_count = 0, updated_at = ?`,
    [Date.now()]
  );
  console.log("[Plum] All skill scores reset to 50.");
}


// ─── Install / Uninstall ─────────────────────────────────────────────────────

const SETTINGS_PATH = join(process.env.HOME ?? "~", ".claude", "settings.json");
const HOOK_MARKER   = "plum-";

function plumHooks() {
  const repoDir = PLUM_REPO_DIR;
  return {
    PreToolUse: {
      matcher: "",
      hooks: [{ type: "command", command: `${repoDir}/hooks/pre-tool.sh`, timeout: 10, async: false }]
    },
    PostToolUse: {
      matcher: "",
      hooks: [{ type: "command", command: `${repoDir}/hooks/post-tool.sh`, timeout: 5, async: true }]
    },
    UserPromptSubmit: {
      matcher: "",
      hooks: [{ type: "command", command: `${repoDir}/hooks/user-prompt.sh`, timeout: 5, async: true }]
    },
    SessionEnd: {
      matcher: "",
      hooks: [{ type: "command", command: `${repoDir}/hooks/session-end.sh`, timeout: 10, async: false }]
    }
  };
}

function installHooks(): void {
  const settings = existsSync(SETTINGS_PATH)
    ? JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"))
    : {};

  if (!settings.hooks) settings.hooks = {};

  const hooks = plumHooks();

  for (const [event, hook] of Object.entries(hooks)) {
    if (!settings.hooks[event]) settings.hooks[event] = [];
    // Remove any stale Plum hooks first
    settings.hooks[event] = settings.hooks[event].filter(
      (h: any) => !h.hooks?.[0]?.command?.includes(HOOK_MARKER) &&
                  !h.hooks?.[0]?.command?.includes("/Plum/hooks/")
    );
    settings.hooks[event].unshift(hook);
  }

  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  console.log("[Plum] Hooks installed in ~/.claude/settings.json ✓");
  console.log("       Restart Claude Code for hooks to take effect.");
}

function uninstallHooks(): void {
  if (!existsSync(SETTINGS_PATH)) { console.log("[Plum] No settings.json found."); return; }

  const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
  if (!settings.hooks) { console.log("[Plum] No hooks to remove."); return; }

  for (const event of Object.keys(settings.hooks)) {
    settings.hooks[event] = (settings.hooks[event] as any[]).filter(
      (h: any) => !h.hooks?.[0]?.command?.includes("/Plum/hooks/")
    );
  }

  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
  console.log("[Plum] Hooks removed from ~/.claude/settings.json ✓");
}


// ─── Entry ───────────────────────────────────────────────────────────────────

main().catch(() => process.exit(0));
