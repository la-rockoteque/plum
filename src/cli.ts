#!/usr/bin/env bun
/**
 * Plum CLI — entry point for all hook commands and user-facing tools.
 *
 * Hook usage (called by shell wrappers in hooks/):
 *   plum pre-tool       reads PreToolUse JSON from stdin
 *   plum post-tool      reads PostToolUse JSON from stdin
 *   plum user-prompt    reads UserPromptSubmit JSON from stdin
 *   plum session-end    reads SessionEnd JSON from stdin
 *   plum mcp            run the MCP server on stdio
 *
 * User commands:
 *   plum skill-health   print skill radar
 *   plum status         weekly summary
 *   plum predict <txt>  log a prediction (boosts synthesis score)
 *   plum verify         mark recent delegation as verified (boosts score)
 *   plum export         dump DB as JSON
 *   plum reset-scores   reset all skill scores to 50
 *   plum wipe --confirm delete all local data
 *   plum uninstall      remove legacy (pre-plugin) hooks from ~/.claude/settings.json
 */

import { getDb, latestSessionId }                     from "./db.js";
import { categorizeToolCall, categorizePrompt, isDelegationSignificant, isDecisionSeeking, isDesignRelated } from "./categorize.js";
import { detectPatterns, type PatternResult }         from "./patterns.js";
import { buildInterventions }                         from "./interventions.js";
import { updateSkillScore, getSkillSnapshot, getOverallHealthScore } from "./skill-model.js";
import { detectAndMarkVerification, manualVerify }    from "./verify.js";
import { getConfig }                                  from "./config.js";
import { weeklyStatus }                               from "./status.js";
import { loadConcepts, formatConceptList, LIBRARY_DIR } from "./library.js";
import { PLUM_DATA_DIR, DB_PATH, HOME }               from "./env.js";
import { join }                                       from "path";
import { readFileSync, writeFileSync, existsSync, rmSync } from "fs";

const command = process.argv[2] ?? "help";

async function readStdin(): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8").trim();
  try { return JSON.parse(raw); } catch { return {}; }
}

async function main(): Promise<void> {
  const cfg = getConfig();
  if (cfg.enabled === false && !["uninstall", "wipe", "export", "concepts", "help"].includes(command)) return;

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
    case "wipe":         return wipeData();
    case "concepts":     return listConcepts(process.argv[3] === "--json");
    case "mcp":          { await import("./mcp-server.js"); return; }
    case "install":      return console.log(INSTALL_HELP);
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
    status        weekly delegation, verify, predict, explain, independence summary
    predict <txt> log a prediction before asking Claude (boosts synthesis score)
    verify        manually mark last delegation as verified (boosts score)
    export        dump DB to JSON (stdout)
    reset-scores  reset all skill scores to 50
    wipe          delete all data in ~/.plum/ (irreversible)
    concepts      list the concept library (--json for the full manifests)

  Setup:
    install       show how to install Plum as a Claude Code plugin
    uninstall     remove legacy (pre-plugin) hooks + MCP entry from ~/.claude/settings.json
`.trim();

const INSTALL_HELP = `
Plum installs as a Claude Code plugin. From inside Claude Code:

  /plugin marketplace add <path-to-this-repo or github owner/repo>
  /plugin install plum@plum

Pick "project" scope to enable it only for the current repo.
If you used the old \`plum install\`, run \`plum uninstall\` first so hooks don't fire twice.
`.trim();


// ─── Hook Handlers ────────────────────────────────────────────────────────────

async function handleUserPrompt(): Promise<void> {
  const { session_id, prompt, cwd } = await readStdin() as { session_id?: string; prompt?: string; cwd?: string };
  if (!session_id || !prompt) return;

  const db  = getDb();
  const now = Date.now();
  const str      = String(prompt);
  const category = categorizePrompt(str);

  ensureSession(session_id, now, cwd);
  db.run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, metadata) VALUES (?, ?, 'user_prompt', ?, 0, ?)`,
    [session_id, now, category, JSON.stringify({
      prompt_len:         str.length,
      is_decision_seeking: isDecisionSeeking(str) ? 1 : 0,
      is_design_related:   isDesignRelated(str)   ? 1 : 0
    })]
  );
  db.run(`UPDATE sessions SET event_count = event_count + 1 WHERE id = ?`, [session_id]);
}

async function handlePreTool(): Promise<void> {
  const { session_id, tool_name, cwd } = await readStdin() as {
    session_id?: string; tool_name?: string; cwd?: string;
  };
  if (!session_id || !tool_name) return;

  // The tool call itself is logged once, by post-tool. Pre-tool only decides whether to coach.
  const now = Date.now();
  ensureSession(session_id, now, cwd);
  if (!isDelegationSignificant(tool_name)) return;

  const cfg = getConfig();
  const db  = getDb();
  // Week-wide patterns cool down globally, or every new session would repeat the same nudge
  const recentlyNudged = (p: PatternResult) => db.query(
    `SELECT 1 FROM interventions WHERE pattern = ? AND ts > ? AND (? = 'week' OR session_id = ?) LIMIT 1`
  ).get(p.pattern, now - cfg.interventionCooldownMs, p.scope, session_id) !== null;

  const patterns = detectPatterns(session_id).filter((p) => !recentlyNudged(p));
  if (patterns.length === 0) return;

  const top = buildInterventions(patterns)[0];
  if (!top) return;

  const gate = cfg.mode === "gating" && top.blocking;
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext: top.message,
      ...(gate && { permissionDecision: "ask", permissionDecisionReason: top.message })
    }
  }) + "\n");

  db.run(
    `INSERT INTO interventions (ts, session_id, pattern, intervention_type, domain, message) VALUES (?, ?, ?, ?, ?, ?)`,
    [now, session_id, top.pattern, top.type, top.domain, top.message]
  );
}

async function handlePostTool(): Promise<void> {
  const { session_id, tool_name, tool_input, tool_response } = await readStdin() as {
    session_id?: string; tool_name?: string; tool_input?: unknown; tool_response?: unknown;
  };
  if (!session_id || !tool_name) return;

  const db          = getDb();
  const now         = Date.now();
  const category    = categorizeToolCall(tool_name, tool_input);
  const outputSize  = JSON.stringify(tool_response ?? {}).length;
  const significant = isDelegationSignificant(tool_name);

  // Check before inserting so the current call can't be picked as its own verification target
  const result = detectAndMarkVerification(session_id, tool_name, now, tool_input);

  db.run(
    `INSERT INTO events (session_id, ts, event_type, tool_name, category, output_size, delegated, metadata) VALUES (?, ?, 'post_tool', ?, ?, ?, ?, ?)`,
    [session_id, now, tool_name, category, outputSize, significant ? 1 : 0, JSON.stringify({ file_path: (tool_input as any)?.file_path })]
  );
  db.run(`UPDATE sessions SET event_count = event_count + 1 WHERE id = ?`, [session_id]);

  // A delegation that isn't itself a verification of a prior one counts against the domain
  if (significant && !result.verified) updateSkillScore(category, true, false);
}

function ensureSession(sessionId: string, now: number, cwd?: string): void {
  getDb().run(
    `INSERT OR IGNORE INTO sessions (id, started_at, project_path) VALUES (?, ?, ?)`,
    [sessionId, now, cwd ?? process.cwd()]
  );
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
  console.log(weeklyStatus());
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
     VALUES (?, ?, 'predict', 'synthesis', 0, 1, ?)`,
    [latestSessionId() ?? "manual", Date.now(), JSON.stringify({ prediction: text })]
  );

  updateSkillScore("synthesis", false, true, true);
  console.log(`[Plum] Prediction logged. Synthesis score updated. ✓`);
}


// ─── Verify ──────────────────────────────────────────────────────────────────

function runManualVerify(): void {
  const sessionArg = process.argv[3];
  const count = parseInt(process.argv[4] ?? "1", 10);

  const sessionId = sessionArg ?? latestSessionId() ?? "manual";
  const marked = manualVerify(sessionId, isNaN(count) ? 1 : count);
  if (marked === 0) {
    console.log("[Plum] No recent unverified delegations found in the last hour.");
  } else {
    console.log(`[Plum] Marked ${marked} delegation${marked > 1 ? "s" : ""} as verified. Skill scores updated. ✓`);
  }
}


// ─── Concept library ─────────────────────────────────────────────────────────

function listConcepts(json: boolean): void {
  const concepts = loadConcepts();
  if (json) return console.log(JSON.stringify(concepts, null, 2));
  console.log(`Concept library (${LIBRARY_DIR})\n`);
  console.log(formatConceptList(concepts));
}


// ─── Export ──────────────────────────────────────────────────────────────────

function exportData(): void {
  const db = getDb();
  console.log(JSON.stringify({
    exported_at:   new Date().toISOString(),
    skill_scores:  db.query(`SELECT * FROM skill_scores`).all(),
    sessions:      db.query(`SELECT * FROM sessions ORDER BY started_at DESC`).all(),
    events:        db.query(`SELECT * FROM events ORDER BY ts DESC`).all(),
    interventions: db.query(`SELECT * FROM interventions ORDER BY ts DESC`).all()
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

// ─── Wipe ─────────────────────────────────────────────────────────────────────

function wipeData(): void {
  if (process.argv[3] !== "--confirm") {
    console.log(`[Plum] This will permanently delete all data in ${PLUM_DATA_DIR}`);
    console.log(`       Run again with --confirm to proceed: plum wipe --confirm`);
    return;
  }
  for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) rmSync(f, { force: true });
  console.log("[Plum] All data wiped. ✓");
}


// ─── Legacy uninstall ────────────────────────────────────────────────────────
// Before the plugin, `plum install` wrote absolute hook paths into ~/.claude/settings.json.

const SETTINGS_PATH  = join(HOME, ".claude", "settings.json");
const LEGACY_HOOK_RE = /plum.*\/hooks\/(pre-tool|post-tool|user-prompt|session-end)\.sh/i;

function uninstallHooks(): void {
  if (!existsSync(SETTINGS_PATH)) { console.log("[Plum] No settings.json found."); return; }

  const settings = JSON.parse(readFileSync(SETTINGS_PATH, "utf-8"));
  const isPlum   = (h: any) => (h.hooks ?? []).some((x: any) => LEGACY_HOOK_RE.test(x.command ?? ""));

  const hooks = Object.fromEntries(
    Object.entries(settings.hooks ?? {})
      .map(([event, list]) => [event, (list as any[]).filter((h) => !isPlum(h))])
      .filter(([, list]) => (list as any[]).length > 0)
  );
  const { plum: _, ...mcpServers } = settings.mcpServers ?? {};

  const next = { ...settings, hooks };
  if (settings.mcpServers) next.mcpServers = mcpServers;

  writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log("[Plum] Legacy hooks + MCP entry removed from ~/.claude/settings.json ✓");
}


// ─── Entry ───────────────────────────────────────────────────────────────────

// Hooks must never break Claude Code: report and exit 0 (hook stderr is only shown in debug mode)
main().catch((e) => { console.error(`[Plum] ${command} failed:`, e); process.exit(0); });
