#!/usr/bin/env bun
/**
 * Plum MCP Server
 *
 * Exposes Plum's skill model and cognitive event logging as MCP tools so Claude
 * can call them during a conversation. Registered by the plugin's .mcp.json.
 *
 * Tools:
 *   get_skill_context    — returns skill scores + at-risk domains + active patterns
 *   log_explanation      — records user explained something (explanation_rate++)
 *   log_independence     — records user solved independently (independence_recovery++)
 *   get_weekly_status    — returns 7-day summary metrics
 *
 * Transport: stdio, newline-delimited JSON-RPC (MCP spec)
 */

import { getSkillSnapshot, getOverallHealthScore, updateSkillScore } from "./skill-model.js";
import { detectPatterns }                                             from "./patterns.js";
import { getDb, latestSessionId }                                     from "./db.js";
import { weeklyStatus }                                               from "./status.js";

// ─── stdio framing ───────────────────────────────────────────────────────────

let buffer = "";

process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let nl: number;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    try { handleMessage(JSON.parse(line)); } catch { respondError(null, -32700, "Parse error"); }
  }
});

process.stdin.on("end", () => process.exit(0));

function send(msg: object): void {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function respond(id: unknown, result: unknown): void {
  send({ jsonrpc: "2.0", id, result });
}

function respondError(id: unknown, code: number, message: string): void {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

// ─── Message dispatch ─────────────────────────────────────────────────────────

function handleMessage(msg: any): void {
  const { id, method, params } = msg;

  // Notifications have no id — don't respond
  if (id === undefined) return;

  switch (method) {
    case "initialize":
      respond(id, {
        protocolVersion: params?.protocolVersion ?? "2024-11-05",
        serverInfo: { name: "plum", version: "0.1.0" },
        capabilities: { tools: {} }
      });
      break;

    case "ping":
      respond(id, {});
      break;

    case "tools/list":
      respond(id, { tools: TOOLS });
      break;

    case "tools/call": {
      const { name, arguments: args } = params ?? {};
      try {
        const result = dispatchTool(name, args ?? {});
        respond(id, { content: [{ type: "text", text: result }] });
      } catch (e) {
        respondError(id, -32603, String(e));
      }
      break;
    }

    default:
      respondError(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "get_skill_context",
    description:
      "Get the user's current skill health scores, at-risk domains, and active cognitive patterns. " +
      "Call this at the start of a session to inform your coaching approach — e.g. if Debugging is at-risk, " +
      "ask for a hypothesis before helping debug.",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  {
    name: "log_explanation",
    description:
      "Record that the user provided an explanation demonstrating they understood an output. " +
      "Call this when the user successfully explains back a concept, diff, or solution in response " +
      "to a Plum explain_back intervention. Boosts the domain's skill score.",
    inputSchema: {
      type: "object",
      properties: {
        domain:     { type: "string", description: "Skill domain: implementation|debugging|testing|architecture|synthesis" },
        session_id: { type: "string", description: "Current Claude Code session ID (optional)" },
        quality:    { type: "string", enum: ["partial", "full"], description: "How complete the explanation was" }
      },
      required: ["domain"]
    }
  },
  {
    name: "log_independence",
    description:
      "Record that the user solved something independently without delegating to Claude. " +
      "Call this when the user figures out a solution themselves, especially after a Plum nudge. " +
      "This is the strongest positive signal in the skill model.",
    inputSchema: {
      type: "object",
      properties: {
        domain:     { type: "string", description: "Skill domain: implementation|debugging|testing|architecture|synthesis" },
        session_id: { type: "string", description: "Current Claude Code session ID (optional)" }
      },
      required: ["domain"]
    }
  },
  {
    name: "get_weekly_status",
    description: "Get a summary of the user's cognitive engagement metrics for the past 7 days.",
    inputSchema: { type: "object", properties: {}, required: [] }
  }
];

// ─── Tool implementations ─────────────────────────────────────────────────────

const DOMAINS = ["implementation", "debugging", "testing", "architecture", "synthesis"];

function domainArg(args: Record<string, unknown>, fallback: string): string {
  const d = String(args.domain ?? fallback);
  if (!DOMAINS.includes(d)) throw new Error(`Unknown domain "${d}" — expected one of ${DOMAINS.join("|")}`);
  return d;
}

function dispatchTool(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "get_skill_context":    return toolGetSkillContext();
    case "log_explanation":      return toolLogExplanation(args);
    case "log_independence":     return toolLogIndependence(args);
    case "get_weekly_status":    return weeklyStatus();
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function toolGetSkillContext(): string {
  const snapshot = getSkillSnapshot();
  const overall  = getOverallHealthScore();
  const atRisk   = snapshot.filter((s) => s.atRisk);

  // Use the most recent session for pattern detection
  const sessionId = latestSessionId();
  const patterns  = sessionId ? detectPatterns(sessionId) : [];

  const lines: string[] = [
    `Professor Plum — Skill Context`,
    `Overall health: ${overall}/100`,
    ``,
    `Skill scores:`
  ];

  for (const s of snapshot) {
    const flag  = s.atRisk ? " ⚠ AT RISK" : s.score >= 70 ? " ✓" : "";
    const trend = { up: "↑", down: "↓", stable: "→" }[s.trend];
    lines.push(`  ${s.label.padEnd(14)} ${s.score}/100 ${trend}${flag}  (${s.delegationRate}% delegated)`);
  }

  if (atRisk.length > 0) {
    lines.push(``, `Coaching guidance for at-risk domains:`);
    for (const s of atRisk) {
      const guidance: Record<string, string> = {
        debugging:      "Ask for a hypothesis before debugging. Don't start until they attempt.",
        testing:        "Ask the user to write the test spec before you implement tests.",
        implementation: "After each change, ask the user to explain what it does.",
        architecture:   "Ask the user to sketch an approach before you design.",
        synthesis:      "Ask the user to predict the answer before you explain."
      };
      lines.push(`  ${s.label}: ${guidance[s.domain] ?? "require engagement before answering"}`);
    }
  }

  if (patterns.length > 0) {
    lines.push(``, `Active patterns detected this session:`);
    for (const p of patterns) {
      lines.push(`  [${p.severity.toUpperCase()}] ${p.pattern}: ${p.context}`);
    }
  }

  return lines.join("\n");
}

function toolLogExplanation(args: Record<string, unknown>): string {
  const domain     = domainArg(args, "synthesis");
  const sessionId  = String(args.session_id ?? latestSessionId() ?? "mcp");
  const quality    = String(args.quality ?? "full");
  const db         = getDb();
  const now        = Date.now();

  db.run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, verified, metadata)
     VALUES (?, ?, 'explanation', ?, 0, 1, ?)`,
    [sessionId, now, domain, JSON.stringify({ quality })]
  );

  // Explanation is the second-strongest positive signal
  const bonus = quality === "full" ? 3 : 1;
  updateSkillScore(domain, false, true);
  // Apply extra bonus beyond the standard updateSkillScore delta
  const row = db.query(`SELECT score FROM skill_scores WHERE domain = ?`).get(domain) as any;
  if (row) {
    const newScore = Math.min(100, (row.score as number) + bonus);
    db.run(`UPDATE skill_scores SET score = ?, updated_at = ? WHERE domain = ?`, [newScore, now, domain]);
  }

  return `[Plum] Explanation logged for ${domain} (${quality}). Skill score updated. ✓`;
}

function toolLogIndependence(args: Record<string, unknown>): string {
  const domain    = domainArg(args, "implementation");
  const sessionId = String(args.session_id ?? latestSessionId() ?? "mcp");
  const db        = getDb();
  const now       = Date.now();

  db.run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, verified, metadata)
     VALUES (?, ?, 'independence', ?, 0, 1, ?)`,
    [sessionId, now, domain, JSON.stringify({ source: "mcp" })]
  );

  // Independence is the strongest positive signal — worth +4
  updateSkillScore(domain, false, true, true);
  const row = db.query(`SELECT score FROM skill_scores WHERE domain = ?`).get(domain) as any;
  if (row) {
    const newScore = Math.min(100, (row.score as number) + 1); // extra +1 on top of updateSkillScore
    db.run(`UPDATE skill_scores SET score = ?, updated_at = ? WHERE domain = ?`, [newScore, now, domain]);
  }

  return `[Plum] Independence logged for ${domain}. Strong positive signal — skill score updated. ✓`;
}
