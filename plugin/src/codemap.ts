/**
 * Optional code-map integration for /plum:teach.
 *
 * code-map (a tree-sitter → FalkorDB structural graph) turns role binding from file-name guessing into facts:
 * which files import an ORM, which classes implement which interfaces, who calls a repository, and exact
 * declarations with line numbers. `teach.codeMap` chooses how Plum uses it:
 *   auto (default) — use it when installed and the repo is indexed; otherwise recommend it and fall back
 *   required       — refuse to survey without it; index the repo automatically if needed
 *   off            — never call it
 * Indexing is local (the graph lives in code-map's own store) and writes nothing into the repository.
 */
import { existsSync, readFileSync } from "fs";
import { basename, join, relative, resolve } from "path";
import { getConfig } from "./config.js";

export type CodeMapMode = "auto" | "required" | "off";

export const INSTALL_HINT = [
  "CARGO_NET_GIT_FETCH_WITH_CLI=true cargo install --git ssh://git@git.nexapptech.com/internal/code-map.git --locked code-map",
  "pip install --user falkordblite   # embedded FalkorDB (see docs/code-map.md for CODE_MAP_FALKOR_BIN)"
].join("\n");

const TIMEOUT_MS = 20_000;
const INDEX_TIMEOUT_MS = 10 * 60_000;
const ORM = "prisma|typeorm|sequelize|mongoose|drizzle|knex|mikro-orm|sqlalchemy|django|gorm|sqlx|database/sql|EntityFrameworkCore|Dapper|Data.Sqlite|jdbc|exposed|hibernate|jpa|pg|mysql|sqlite";
const PORT_NAMES = "repository|repo|store|gateway|port|notifier|sender|client|provider|reader|writer|dao|service";

export function codeMapMode(): CodeMapMode {
  const m = getConfig().teach.codeMap;
  return m === "required" || m === "off" ? m : "auto";
}

export function codeMapBin(): string | null {
  const override = process.env.PLUM_CODE_MAP_BIN;
  if (override) return existsSync(override) ? override : null;
  return Bun.which("code-map");
}

// Graph name: the project's label in .code-map/projects.json when it has one, else the directory name.
export function graphName(projectDir: string): string {
  const cfg = join(projectDir, ".code-map", "projects.json");
  try {
    const raw = JSON.parse(readFileSync(cfg, "utf-8"));
    const projects = (Array.isArray(raw) ? raw : raw.projects ?? []) as { path?: string; label?: string }[];
    const own = projects.find((p) => p.path && resolve(projectDir, p.path) === resolve(projectDir)) ?? (projects.length === 1 ? projects[0] : undefined);
    if (own?.label && /^[\w.-]+$/.test(own.label)) return own.label;
  } catch { /* no project config */ }
  return basename(resolve(projectDir)).toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "project";
}

function run(bin: string, args: string[], cwd: string, timeout = TIMEOUT_MS): string | null {
  const p = Bun.spawnSync([bin, ...args], { cwd, timeout, stdout: "pipe", stderr: "ignore" });
  return p.exitCode === 0 ? p.stdout.toString() : null;
}

function cypher<T>(bin: string, graph: string, query: string, cwd: string): T[] | null {
  const out = run(bin, ["cypher", "--graph", graph, "--json", query], cwd);
  if (out === null) return null;
  try { const rows = JSON.parse(out); return Array.isArray(rows) ? rows as T[] : null; } catch { return null; }
}

// A string literal safe to embed in Cypher (the CLI takes no parameters): only plain repo paths get through.
function literal(s: string): string {
  if (!/^[\w./@+ -]+$/.test(s)) throw new Error(`Unsupported characters in path: ${s}`);
  return `'${s.replace(/'/g, "\\'")}'`;
}

export interface CodeMapStatus { mode: CodeMapMode; bin: string | null; graph: string; indexed: boolean }

export function codeMapStatus(projectDir: string): CodeMapStatus {
  const mode = codeMapMode();
  const graph = graphName(projectDir);
  if (mode === "off") return { mode, bin: null, graph, indexed: false };
  const bin = codeMapBin();
  if (!bin) return { mode, bin, graph, indexed: false };
  const rows = cypher<{ c: number }>(bin, graph, "MATCH (f:File) RETURN count(f) AS c", projectDir);
  return { mode, bin, graph, indexed: (rows?.[0]?.c ?? 0) > 0 };
}

export function indexProject(projectDir: string, bin: string, graph: string): { files: number; entities: number } {
  const out = run(bin, ["index", projectDir, "--name", graph, "--json"], projectDir, INDEX_TIMEOUT_MS);
  if (out === null) throw new Error(`code-map index failed for ${projectDir}; run \`code-map index ${projectDir} --name ${graph}\` to see why.`);
  try { const s = JSON.parse(out); return { files: s.files ?? 0, entities: s.entities ?? 0 }; } catch { return { files: 0, entities: 0 }; }
}

// Resolve the mode into a usable graph, or explain why there isn't one. `required` indexes on demand.
export function ensureGraph(projectDir: string): { status: CodeMapStatus; note: string | null } {
  const status = codeMapStatus(projectDir);
  if (status.mode === "off") return { status, note: null };
  if (!status.bin) {
    if (status.mode === "required") {
      throw new Error(`teach.codeMap is "required" but code-map isn't installed. Install it:\n${INSTALL_HINT}`);
    }
    return { status, note: `Strongly recommended: install code-map for precise role binding (implementations, ORM users, callers) and cheaper outlines:\n${INSTALL_HINT}` };
  }
  if (!status.indexed) {
    if (status.mode === "required") {
      indexProject(projectDir, status.bin, status.graph);
      return { status: { ...status, indexed: true }, note: null };
    }
    return { status, note: "code-map is installed but this repo isn't indexed: run `plum teach index` (local, incremental) for precise role binding." };
  }
  return { status, note: null };
}

// ─── queries ─────────────────────────────────────────────────────────────────

export function graphSurvey(s: CodeMapStatus, projectDir: string): string[] {
  if (!s.bin || !s.indexed) return [];
  const bin = s.bin, g = s.graph;
  const orm = cypher<{ f: string; l: string }>(bin, g,
    `MATCH (f:File)-[:DEPENDS_ON]->(l:Library) WHERE NOT f.is_test AND l.id =~ '(?i).*(${ORM}).*' RETURN DISTINCT f.id AS f, l.id AS l LIMIT 12`, projectDir) ?? [];
  const impl = cypher<{ a: string; af: string; b: string }>(bin, g,
    `MATCH (a:Entity)-[:INHERITS]->(b:Entity) WHERE b.name =~ '(?i).*(${PORT_NAMES}).*' RETURN a.name AS a, a.file AS af, b.name AS b LIMIT 12`, projectDir) ?? [];
  const callers = cypher<{ f: string; n: string }>(bin, g,
    `MATCH (a:Entity)-[:CALLS]->(b:Entity) WHERE b.name =~ '(?i).*(repository|repo|store|dao).*' AND NOT a.file =~ '.*(spec|test).*' RETURN DISTINCT a.file AS f, b.name AS n LIMIT 10`, projectDir) ?? [];
  const lines = [`## From code-map (graph ${g})`];
  lines.push(`- files importing a DB/ORM library (${orm.length}): ${orm.map((r) => `${r.f} → ${r.l}`).join(", ") || "none"}`);
  lines.push(`- implementations of port-like interfaces (${impl.length}): ${impl.map((r) => `${r.a} (${r.af}) → ${r.b}`).join(", ") || "none"}`);
  lines.push(`- callers of repository-like types (${callers.length}): ${callers.map((r) => `${r.f} → ${r.n}`).join(", ") || "none"}`);
  return lines;
}

export function graphOutline(s: CodeMapStatus, projectDir: string, absFile: string): string | null {
  if (!s.bin || !s.indexed) return null;
  const rel = relative(projectDir, absFile);
  const rows = cypher<{ k: string; n: string; s: number; m?: string; ms?: number }>(s.bin, s.graph,
    `MATCH (f:File {id: ${literal(rel)}})-[:CONTAINS]->(e:Entity) OPTIONAL MATCH (e)-[:HAS_METHOD]->(m) ` +
    `RETURN labels(e)[1] AS k, e.name AS n, e.start_line AS s, m.name AS m, m.start_line AS ms ORDER BY s, ms LIMIT 80`, projectDir);
  if (!rows || rows.length === 0) return null;
  // Methods are also CONTAINed by the file; show them once, under their class.
  const methods = new Set(rows.filter((r) => r.m).map((r) => `${r.m}@${r.ms}`));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const key = `${r.n}@${r.s}`;
    if (!seen.has(key) && !methods.has(key)) { seen.add(key); out.push(`${r.s}: ${r.k ?? "Entity"} ${r.n}`); }
    if (r.m && r.ms !== undefined && r.ms !== null && !seen.has(`m:${r.m}@${r.ms}`)) { seen.add(`m:${r.m}@${r.ms}`); out.push(`${r.ms}:   ${r.m}()`); }
  }
  return [`## ${rel} (from code-map)`, ...out.slice(0, 40)].join("\n");
}
