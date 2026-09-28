/**
 * Connectors: isolated folders under plugin/connectors/<id>/ (connector.json + instructions.md) that map Plum's
 * connector-agnostic progress and goals onto another tool. They're Claude-mediated: Plum prepares the exact
 * payload, Claude shows it to the user and — only after confirmation — calls the user's own connected MCP tools.
 * Plum holds no credentials and makes no network calls. Off by default; only personal/local config enables one.
 * Hooks never load this module.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";
import { PLUGIN_ROOT, PLUM_DATA_DIR, CONFIG_PATH } from "./env.js";
import { getConfig } from "./config.js";
import { formatValue, loadProposals, metricValue, percentDone, type GoalProposal } from "./progress.js";

export const CAPABILITIES = ["goals.create", "goals.progress", "goals.comment"] as const;
type Capability = (typeof CAPABILITIES)[number];

export interface Connector {
  id: string;
  name: string;
  kind: "mcp-mediated";
  capabilities: Capability[];
  mcp: { discover: string; requires: string };
  sends: string[];
  visibility: string;
  dir: string;
}

export interface Link { proposalId: string; connector: string; externalId: string; createdAt: string; proposal: GoalProposal }

const CONNECTORS_DIR = join(PLUGIN_ROOT, "connectors");
const ID = /^[a-z][a-z0-9-]{0,39}$/;
const EXTERNAL_ID = /^[\w.:-]{1,128}$/;

export function loadConnectors(): Connector[] {
  if (!existsSync(CONNECTORS_DIR)) return [];
  return readdirSync(CONNECTORS_DIR).flatMap((name) => {
    const manifest = join(CONNECTORS_DIR, name, "connector.json");
    if (!existsSync(manifest)) return [];
    try {
      const c = JSON.parse(readFileSync(manifest, "utf-8"));
      const valid = ID.test(c.id) && c.id === name && c.kind === "mcp-mediated" && Array.isArray(c.capabilities)
        && c.capabilities.every((x: string) => (CAPABILITIES as readonly string[]).includes(x))
        && typeof c.visibility === "string" && typeof c.mcp?.discover === "string";
      if (!valid) { console.error(`[Plum] Ignoring invalid connector manifest ${manifest}`); return []; }
      return [{ ...c, dir: join(CONNECTORS_DIR, name) } as Connector];
    } catch (e) { console.error(`[Plum] Ignoring unreadable connector manifest ${manifest}:`, e); return []; }
  });
}

function find(id: string): Connector {
  const c = loadConnectors().find((x) => x.id === id);
  if (!c) throw new Error(`Unknown connector "${id}". Available: ${loadConnectors().map((x) => x.id).join(", ") || "none"}`);
  return c;
}

export const isEnabled = (id: string) => getConfig().connectors[id]?.enabled === true;

// Writes the personal config (~/.plum/config.json), preserving everything else in it.
function setEnabled(id: string, enabled: boolean): void {
  let cfg: Record<string, any> = {};
  try { cfg = JSON.parse(readFileSync(CONFIG_PATH, "utf-8")); } catch { /* new file */ }
  const connectors = { ...(cfg.connectors ?? {}), [id]: { ...(cfg.connectors?.[id] ?? {}), enabled } };
  mkdirSync(PLUM_DATA_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify({ ...cfg, connectors }, null, 2));
}

// ─── links ───────────────────────────────────────────────────────────────────

const linksPath = (id: string) => join(PLUM_DATA_DIR, "connectors", id, "links.json");

export function loadLinks(id: string): Link[] {
  try { const v = JSON.parse(readFileSync(linksPath(id), "utf-8")); return Array.isArray(v) ? v : []; } catch { return []; }
}
function saveLinks(id: string, links: Link[]): void {
  mkdirSync(join(PLUM_DATA_DIR, "connectors", id), { recursive: true });
  writeFileSync(linksPath(id), JSON.stringify(links, null, 2));
}

export function goalProgress(connectorId?: string): (Pick<Link, "proposalId" | "connector" | "externalId"> & { title: string; current: number; target: number; percent: number; shown: string })[] {
  const ids = connectorId ? [connectorId] : loadConnectors().map((c) => c.id);
  return ids.flatMap((id) => loadLinks(id).map((l) => {
    const current = metricValue(l.proposal.metric, Date.parse(l.createdAt));
    return { proposalId: l.proposalId, connector: id, externalId: l.externalId, title: l.proposal.title,
             current, target: l.proposal.metric.target, percent: percentDone(l.proposal.metric, current),
             shown: `${formatValue(l.proposal.metric, current)} of ${formatValue(l.proposal.metric, l.proposal.metric.target)}` };
  }));
}

export function printGoalProgress(json: boolean): number {
  const rows = goalProgress();
  if (json) { console.log(JSON.stringify(rows, null, 2)); return 0; }
  if (rows.length === 0) { console.log("No linked goals yet. Use /plum:goals to set one."); return 0; }
  for (const r of rows) console.log(`- ${r.title} [${r.connector} ${r.externalId}]: ${r.shown} (${r.percent}% of the way)`);
  return 0;
}

// ─── payloads: exactly what would leave, for the user to confirm ─────────────

function goalCreatePayload(p: GoalProposal): { title: string; description: string; due: string } {
  return {
    title: p.title,
    description: `${p.why}\nPractice: ${p.suggestedPractice.join("; ")}\nTracked by Plum (counts only, no code or file names).`,
    due: p.due
  };
}

function payload(c: Connector, capability: string, proposalId?: string): string {
  if (!isEnabled(c.id)) throw new Error(`Connector ${c.id} is off. Turn it on with \`plum connectors enable ${c.id}\` (personal config only).`);
  if (!(c.capabilities as string[]).includes(capability)) throw new Error(`${c.id} doesn't support ${capability}`);
  const header = [`Connector: ${c.name} (${c.kind}) — ${capability}`, `Visibility: ${c.visibility}`, `This is exactly what would be sent:`];
  const footer = `Show this to the user; only after they confirm, send it with ${c.name}'s MCP tools (see ${join(c.dir, "instructions.md")}).`;
  if (capability === "goals.create") {
    const p = loadProposals().find((x) => x.id === proposalId);
    if (!p) throw new Error(`Unknown proposal "${proposalId ?? ""}". Run \`plum goals propose\` first.`);
    return [...header, JSON.stringify(goalCreatePayload(p), null, 2), footer].join("\n");
  }
  const updates = goalProgress(c.id).map((g) => ({
    externalId: g.externalId, progressPercent: g.percent, comment: `Plum: ${g.title} — ${g.shown} (${g.percent}% of the way)`
  }));
  if (updates.length === 0) throw new Error(`No goals are linked to ${c.id} yet.`);
  return [...header, JSON.stringify(updates, null, 2), footer].join("\n");
}

// ─── `plum connectors …` ─────────────────────────────────────────────────────

export function runConnectorsCommand(argv: string[]): number {
  const [sub = "list", id, a, b] = argv;
  try {
    switch (sub) {
      case "list":
        for (const c of loadConnectors()) console.log(`${c.id} — ${c.name} (${c.kind}): ${isEnabled(c.id) ? "on" : "off"} · ${c.capabilities.join(", ")}`);
        return 0;
      case "status":
        for (const c of id ? [find(id)] : loadConnectors()) {
          console.log(`${c.id}: ${isEnabled(c.id) ? "on" : "off"} — ${c.name} (${c.kind})\n  Needs: ${c.mcp.requires}\n  Sends: ${c.sends.join(", ")}\n  ${c.visibility}\n  Linked goals: ${loadLinks(c.id).length}`);
        }
        return 0;
      case "enable":
      case "disable":
        find(id);
        setEnabled(id, sub === "enable");
        console.log(`[Plum] ${id} ${sub === "enable" ? "on" : "off"} (personal config). ${sub === "enable" && getConfig().connectors[id]?.enabled === false ? "Note: a team config turned it off for this project." : ""}`.trim());
        return 0;
      case "payload":
        console.log(payload(find(id), a, b));
        return 0;
      case "link": {
        const c = find(id);
        if (!isEnabled(c.id)) throw new Error(`Connector ${c.id} is off.`);
        const p = loadProposals().find((x) => x.id === a);
        if (!p) throw new Error(`Unknown proposal "${a ?? ""}". Run \`plum goals propose\` first.`);
        if (!b || !EXTERNAL_ID.test(b)) throw new Error("The external id must be 1–128 letters, digits, '.', ':', '_' or '-'.");
        const links = loadLinks(c.id).filter((l) => l.proposalId !== p.id);
        saveLinks(c.id, [...links, { proposalId: p.id, connector: c.id, externalId: b, createdAt: new Date().toISOString(), proposal: p }]);
        console.log(`[Plum] Linked ${p.id} to ${c.name} goal ${b}.`);
        return 0;
      }
      case "links":
        for (const c of id ? [find(id)] : loadConnectors()) for (const l of loadLinks(c.id)) console.log(`${c.id} ${l.externalId} ← ${l.proposalId} (${l.createdAt.slice(0, 10)})`);
        return 0;
      case "unlink":
        find(id);
        saveLinks(id, loadLinks(id).filter((l) => l.proposalId !== a));
        console.log(`[Plum] Unlinked ${a} from ${id}.`);
        return 0;
      default:
        console.error("Usage: plum connectors list | status [id] | enable <id> | disable <id> | payload <id> <capability> [proposal] | link <id> <proposal> <externalId> | links [id] | unlink <id> <proposal>");
        return 1;
    }
  } catch (e) {
    console.error(`[Plum] ${(e as Error).message}`);
    return 1;
  }
}
