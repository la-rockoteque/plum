/**
 * Helpers for /plum:teach, so a lecture takes a handful of tool calls instead of dozens:
 *   match  — rank concepts for an id or a plain-language question (one line each, no manifest dump)
 *   survey  — compact profile of the consumer repo: stack, candidate files per role (per concept with --concept)
 *   outline — numbered declarations of files (classes, functions, data-access imports) instead of full reads
 *   brief   — manifest essentials + outlines of the example code (--full adds narrative and code)
 *   render  — build the deck HTML from compact slide JSON; code can be pulled by reference, so Claude never
 *             copies file bodies into the deck (escaping, template and engine handled here)
 */
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, mkdirSync } from "fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "path";
import { LIBRARY_DIR, loadConcepts, type Concept } from "./library.js";
import { fetchConcept } from "./library-cache.js";
import { PLUM_DATA_DIR } from "./env.js";
import { getDb, latestSessionId } from "./db.js";
import { parseFlags } from "./feedback.js";
import { getConfig, LOCALES, type Locale } from "./config.js";
import { ensureGraph, graphOutline, graphSurvey, indexProject, codeMapBin, graphName, INSTALL_HINT } from "./codemap.js";

// ─── match ───────────────────────────────────────────────────────────────────

const STOP = new Set(["a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "my", "our", "i",
  "it", "its", "with", "how", "what", "why", "do", "does", "can", "be", "that", "this", "we", "you", "me", "about",
  "teach", "learn", "explain", "concept", "code"]);
const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOP.has(t));
const stem = (t: string) => t.replace(/(ing|ed|es|s)$/, "");

export interface Match { id: string; title: string; summary: string; score: number }

export function matchConcepts(query: string, concepts: Concept[]): Match[] {
  const q = query.trim().toLowerCase();
  const exact = concepts.find((c) => c.id === q || c.title.toLowerCase() === q);
  const qt = new Set(tokens(q).map(stem));
  const scored = concepts.map((c) => {
    const fields: [string, number][] = [
      [c.id.replace(/-/g, " "), 4], [c.title, 3], [c.summary, 2],
      [c.signals.join(" "), 2], [Object.keys(c.roles).join(" "), 1], [c.stages.map((s) => s.idea).join(" "), 1]
    ];
    let score = 0;
    for (const [text, weight] of fields) {
      const words = new Set(tokens(text).map(stem));
      for (const t of qt) if (words.has(t)) score += weight;
    }
    return { id: c.id, title: c.title, summary: c.summary, score: c === exact ? 1000 : score };
  });
  return scored.filter((m) => m.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
}

// ─── survey ──────────────────────────────────────────────────────────────────

const SOURCE_EXT: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript", ".py": "python",
  ".go": "go", ".cs": "csharp", ".kt": "kotlin", ".java": "java", ".rb": "ruby", ".php": "php", ".rs": "rust"
};
const FRAMEWORKS: [RegExp, string][] = [
  [/@nestjs\/core/, "NestJS"], [/"express"/, "Express"], [/"next"/, "Next.js"], [/"react"/, "React"], [/"vue"/, "Vue"],
  [/"svelte"/, "Svelte"], [/@prisma\/client|"prisma"/, "Prisma"], [/"typeorm"/, "TypeORM"], [/drizzle-orm/, "Drizzle"],
  [/"mongoose"/, "Mongoose"], [/"sequelize"/, "Sequelize"], [/"fastify"/, "Fastify"],
  [/Microsoft\.EntityFrameworkCore/, "EF Core"], [/WolverineFx|Wolverine/, "Wolverine"], [/MediatR/, "MediatR"],
  [/Microsoft\.AspNetCore|Sdk="Microsoft\.NET\.Sdk\.Web"/, "ASP.NET Core"], [/Dapper/, "Dapper"],
  [/gorm\.io\/gorm/, "GORM"], [/github\.com\/gin-gonic\/gin/, "Gin"], [/sqlx/, "sqlx"],
  [/django/i, "Django"], [/fastapi/i, "FastAPI"], [/flask/i, "Flask"], [/sqlalchemy/i, "SQLAlchemy"],
  [/spring-boot|org\.springframework/, "Spring"], [/org\.jetbrains\.exposed/, "Exposed"], [/io\.ktor/, "Ktor"],
  [/hibernate/i, "Hibernate"]
];
const MANIFESTS = /(^|\/)(package\.json|[^/]+\.csproj|go\.mod|pyproject\.toml|requirements[^/]*\.txt|build\.gradle(\.kts)?|pom\.xml|Gemfile|Cargo\.toml|composer\.json)$/;
const ROLE_PATTERNS: [string, RegExp][] = [
  ["entities / models", /(entity|entities|model|models|domain|aggregate)[./_-]|\/(domain|entities|models)\//i],
  ["repositories / data access", /(repository|repositories|repo|dao|store|gateway|persistence|prisma)[./_-]/i],
  ["services / use cases", /(service|services|usecase|use-case|use_case|handler|command|interactor)[./_-]/i],
  ["controllers / endpoints", /(controller|controllers|resolver|route|routes|endpoint|api)[./_-]/i],
  ["tests", /(\.test\.|\.spec\.|_test\.|Tests?\.(cs|kt|java)$|\/tests?\/|__tests__)/i]
];
const IGNORED_DIR = /(^|\/)(node_modules|dist|build|bin|obj|out|target|vendor|\.git|\.venv|venv|coverage|\.next|\.gradle)(\/|$)/;

function listFiles(root: string): string[] {
  const git = Bun.spawnSync(["git", "-C", root, "ls-files"], { stdout: "pipe", stderr: "ignore" });
  if (git.exitCode === 0) return git.stdout.toString().split("\n").filter((f) => f && !IGNORED_DIR.test(f));
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (out.length >= 5000) return;
      const abs = join(dir, name);
      const rel = relative(root, abs);
      if (IGNORED_DIR.test(rel) || name.startsWith(".")) continue;
      if (statSync(abs).isDirectory()) walk(abs); else out.push(rel);
    }
  };
  walk(root);
  return out;
}

// Which survey categories a concept's roles need, from the words its manifest uses for them.
function categoriesFor(concept: Concept): Set<string> {
  const text = `${Object.keys(concept.roles).join(" ")} ${Object.values(concept.roles).join(" ")}`.toLowerCase();
  const want = new Set<string>();
  if (/entit|aggregate|value|model|order\b|domain/.test(text)) want.add("entities / models");
  if (/repositor|port|adapter|store|persist|orm|sql|data/.test(text)) want.add("repositories / data access");
  if (/use case|service|handler|command|query|application|policy/.test(text)) want.add("services / use cases");
  if (/controller|endpoint|presentation|request|api|http/.test(text)) want.add("controllers / endpoints");
  if (/test|double|fake|stub|spy|mock/.test(text)) want.add("tests");
  return want.size > 0 ? want : new Set(ROLE_PATTERNS.map(([n]) => n));
}

export function surveyRepo(root: string, concept?: Concept): string {
  const files = listFiles(root);
  const byLang: Record<string, number> = {};
  for (const f of files) { const l = SOURCE_EXT[extname(f)]; if (l) byLang[l] = (byLang[l] ?? 0) + 1; }
  const langs = Object.entries(byLang).sort((a, b) => b[1] - a[1]);

  const manifests = files.filter((f) => MANIFESTS.test(f) && f.split("/").length <= 4).slice(0, 12);
  const frameworks = new Set<string>();
  for (const m of manifests) {
    let text = "";
    try { text = readFileSync(join(root, m), "utf-8").slice(0, 200_000); } catch { continue; }
    for (const [re, name] of FRAMEWORKS) if (re.test(text)) frameworks.add(name);
  }

  const dirs: Record<string, number> = {};
  for (const f of files) {
    const parts = f.split("/");
    if (parts.length < 2) continue;
    const key = parts.slice(0, Math.min(parts.length - 1, 3)).join("/");
    dirs[key] = (dirs[key] ?? 0) + 1;
  }
  const layout = Object.entries(dirs).sort((a, b) => b[1] - a[1]).slice(0, 14);

  const source = files.filter((f) => SOURCE_EXT[extname(f)]);
  const isTest = (f: string) => ROLE_PATTERNS[4][1].test(f);
  const wanted = concept ? categoriesFor(concept) : null;
  const perRole = concept ? 3 : 6;
  const roles = ROLE_PATTERNS.filter(([name]) => !wanted || wanted.has(name)).map(([name, re]) => {
    const hits = source.filter((f) => re.test(f) && (name === "tests" || !isTest(f)));
    return `- ${name} (${hits.length}): ${hits.slice(0, perRole).join(", ") || "none found"}`;
  });

  const nouns: Record<string, number> = {};
  for (const f of source.filter((x) => ROLE_PATTERNS[0][1].test(x) || ROLE_PATTERNS[1][1].test(x))) {
    const n = basename(f).split(/[._-]/)[0].replace(/(Repository|Service|Entity|Model|Dto)$/i, "").toLowerCase();
    if (n.length > 2 && !["index", "base", "types", "utils", "common"].includes(n)) nouns[n] = (nouns[n] ?? 0) + 1;
  }
  const domain = Object.entries(nouns).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n]) => n);

  if (concept) {
    return [
      `# ${basename(root)} for ${concept.id}: ${langs.slice(0, 2).map(([l]) => l).join("/") || "?"} · ${[...frameworks].join(", ") || "no framework detected"} · ${files.length} files`,
      `Domain nouns: ${domain.slice(0, 8).join(", ") || "none"}`,
      ...roles,
      `Next: \`plum teach outline <file> …\` on the 1–3 files you bind to.`
    ].join("\n");
  }

  return [
    `# Repo survey: ${basename(root)} (${files.length} tracked files)`,
    `Languages: ${langs.map(([l, n]) => `${l} ${n}`).join(", ") || "none detected"}`,
    `Frameworks/ORMs: ${[...frameworks].join(", ") || "none detected"}`,
    `Manifests: ${manifests.join(", ") || "none"}`,
    `Domain nouns (from file names): ${domain.join(", ") || "none"}`,
    "",
    "## Layout (dir: files)",
    ...layout.map(([d, n]) => `- ${d}: ${n}`),
    "",
    "## Role candidates (by file name — open the ones you bind to)",
    ...roles
  ].join("\n");
}

// ─── outline ─────────────────────────────────────────────────────────────────

const DECL = [
  /^\s*(export\s+)?(default\s+)?(abstract\s+|sealed\s+|data\s+|open\s+|partial\s+|static\s+)*(public\s+|private\s+|protected\s+|internal\s+)?(abstract\s+|sealed\s+|data\s+|static\s+)*(class|interface|enum|record|struct|object|trait|module|namespace)\s+\w/,
  /^\s*(export\s+)?type\s+\w+(<[^>]*>)?\s*=/,
  /^\s*(export\s+)?(async\s+)?function\b/,
  /^\s*(async\s+)?def\s+\w+/,
  /^func\s/,
  /^\s*((public|private|protected|internal|override|open|suspend|static|async|abstract|virtual)\s+)*fun\s+/,
  // C#/Java/TS methods and constructors: modifiers, a name, a parameter list, then a body or arrow
  /^\s+((public|private|protected|internal|static|async|override|virtual|abstract|readonly)\s+)*[\w<>\[\],.?]+\s+\w+\s*\([^;]*\)\s*(\{|=>)?\s*$/,
  /^\s+((public|private|protected|static|async|readonly)\s+)*(constructor|\w+)\s*\([^;]*\)\s*(:\s*[^{=;]+)?\s*\{\s*$/,
  /^\s*export\s+(const|let)\s+\w+\s*=\s*(async\s*)?\(/
];
const DATA_IMPORT = /^\s*(import|using|from|require)\b.*\b(prisma|typeorm|sequelize|mongoose|drizzle|knex|pg\b|mysql|sqlite|sqlalchemy|django\.db|gorm|database\/sql|sqlx|EntityFrameworkCore|Dapper|Data\.Sqlite|jdbc|exposed|hibernate|jpa|repository|Repository)/i;
const OUTLINE_MAX = 30;
const CONTROL = /^\s*(if|else|for|foreach|while|switch|catch|return|using\s*\(|lock|when|try|do)\b/;

export function outlineFile(abs: string, base: string): string {
  const text = readFileSync(abs, "utf-8");
  const lines = text.split("\n");
  const picked: string[] = [];
  lines.forEach((line, i) => {
    if (picked.length >= OUTLINE_MAX) return;
    if (CONTROL.test(line)) return;
    if (DATA_IMPORT.test(line) || DECL.some((re) => re.test(line))) picked.push(`${i + 1}: ${line.trimEnd().slice(0, 140)}`);
  });
  const shown = relative(base, abs) || basename(abs);
  return [`## ${shown} (${lines.length} lines)`, ...(picked.length ? picked : ["(no declarations found)"])].join("\n");
}

function insideProject(projectDir: string, rel: string): string {
  if (!rel || isAbsolute(rel) || rel.split(/[\\/]/).includes("..")) throw new Error(`Path must be relative to the project: ${rel}`);
  const abs = resolve(projectDir, rel);
  const real = realpathSync(abs);
  const r = relative(realpathSync(projectDir), real);
  if (r.startsWith("..") || isAbsolute(r)) throw new Error(`Path escapes the project: ${rel}`);
  return real;
}

// ─── code references (resolved by the renderer) ──────────────────────────────

const LANG_OF_EXT: Record<string, string> = { ".ts": "ts", ".tsx": "tsx", ".js": "js", ".py": "python", ".go": "go",
  ".cs": "csharp", ".kt": "kotlin", ".java": "java", ".rb": "ruby", ".php": "php", ".rs": "rust", ".sql": "sql" };

function sliceLines(text: string, lines?: string): { text: string; range: string } {
  const all = text.replace(/\n$/, "").split("\n");
  if (!lines) return { text: all.join("\n"), range: `1–${all.length}` };
  const m = /^(\d+)(?:-(\d+))?$/.exec(lines.trim());
  if (!m) throw new Error(`lines must look like "12-30": ${lines}`);
  const from = Math.max(1, Number(m[1])), to = Math.min(all.length, Number(m[2] ?? m[1]));
  return { text: all.slice(from - 1, to).join("\n"), range: `${from}–${to}` };
}

export function resolveCodeRef(block: CodeBlock, projectDir: string): CodeBlock {
  if (!block.ref) return block;
  const [kind, ...restParts] = block.ref.split(":");
  const target = restParts.join(":");
  if (kind === "repo") {
    const abs = insideProject(projectDir, target);
    const { text, range } = sliceLines(readFileSync(abs, "utf-8"), block.lines);
    return { lang: block.lang ?? LANG_OF_EXT[extname(abs)], text, src: block.src ?? `${target}:${range}` };
  }
  if (kind === "example") {
    const [id, lang, ...fileParts] = target.split("/");
    const file = fileParts.join("/");
    const { dir, files } = fetchConcept(id, lang);
    if (!files.includes(file)) throw new Error(`${file} is not part of ${id}'s ${lang} example (files: ${files.join(", ")})`);
    const { text, range } = sliceLines(readFileSync(join(dir, file), "utf-8"), block.lines);
    return { lang: block.lang ?? LANG_OF_EXT[extname(file)], text, src: block.src ?? `Plum library · ${lang}/${file}:${range}` };
  }
  throw new Error(`Unknown code ref "${block.ref}" (use repo:<path> or example:<concept>/<lang>/<file>)`);
}

// ─── brief ───────────────────────────────────────────────────────────────────

const FENCE: Record<string, string> = { python: "python", typescript: "ts", go: "go", dotnet: "csharp", kotlin: "kotlin", react: "tsx", infra: "" };

export function conceptBrief(id: string, lang: string | undefined, full = false): string {
  const c = loadConcepts().find((x) => x.id === id);
  if (!c) throw new Error(`Unknown concept "${id}". Try \`plum teach match "<question>"\`.`);
  const chosen = lang && c.examples[lang] ? lang : Object.keys(c.examples)[0];
  const lines = [
    `# ${c.title} (${c.id}) — ${c.category}, ${c.level}, Plum domain: ${c.domain}`,
    c.summary,
    `Prerequisites: ${c.prerequisites.join(", ") || "none"} · Related: ${c.related.join(", ") || "none"}`,
    `Languages: ${Object.keys(c.examples).join(", ")}${lang && !c.examples[lang] ? ` (no ${lang}; using ${chosen})` : ""}`,
    "", "## Roles", ...Object.entries(c.roles).map(([k, v]) => `- ${k}: ${v}`),
    "", "## Signals", ...c.signals.map((s) => `- ${s}`),
    "", "## Stages", ...c.stages.map((s) => `- ${s.id} — ${s.title}: ${s.idea}`),
    "", "## Checks", ...c.checks.map((q, i) => `${i + 1}. ${q}`),
    "", `## Run (${chosen}, from Plum's library/examples/${chosen}): ${c.examples[chosen].run}`
  ];
  if (full) {
    const md = join(LIBRARY_DIR, "concepts", c.id, "CONCEPT.md");
    if (existsSync(md)) lines.push("", "## Narrative", readFileSync(md, "utf-8").trim());
  }
  try {
    const { dir, files } = fetchConcept(c.id, chosen);
    const stageOf = (f: string) => Object.entries(c.examples[chosen].stages).find(([, fs]) => fs.includes(f))?.[0] ?? "test";
    if (full) {
      lines.push("", `## Code (${chosen})`);
      for (const f of files) {
        lines.push("", `### ${f} [${stageOf(f)}]`, "```" + (FENCE[chosen] ?? ""), readFileSync(join(dir, f), "utf-8").trimEnd(), "```");
      }
    } else {
      lines.push("", `## Outlines (${chosen}) — put code on slides with {"ref": "example:${c.id}/${chosen}/<file>", "lines": "a-b"}`);
      for (const f of files) lines.push("", outlineFile(join(dir, f), dir).replace(/^## /, `### [${stageOf(f)}] `));
    }
  } catch (e) {
    lines.push("", `## Code unavailable: ${(e as Error).message}`, "Teach from the narrative and say so on the title slide.");
  }
  return lines.join("\n");
}

// ─── deck chrome, per locale ─────────────────────────────────────────────────
// Concept prose is translated per deck by Claude (the `translations` slot); only the fixed labels live here.

const UI = {
  en: {
    lecture: (t: string) => `${t} Lecture`, kicker: (cat: string) => `Lecture · ${cat}`,
    predict: "Before we start — predict", predictLede: "Write your guess down. We'll come back to it.",
    problem: "The problem in your code", hurts: "Where it hurts", idea: "The idea",
    roles: "Roles", rolesTitle: "The roles, in your repo", headers: ["Role", "What it is", "Yours"],
    stage: (i: number, n: number) => `Stage ${i} of ${n} · canonical example`,
    domain: "In your domain (illustrative)", sameMove: "The same move, in your code",
    canonical: "Canonical", yours: "Yours (illustrative)",
    tradeoffs: "Trade-offs", whenNot: "When not to", watch: "Watch out", misconceptions: "Common misconceptions",
    check: "Check your understanding", explainBack: "Explain it back", tryIt: "Try it", exercise: "Your exercise",
    run: (cmd: string, lang: string) => `Run the canonical example: \`${cmd}\` (in Plum's library/examples/${lang}).`,
    recap: "Recap", keep: "Three things to keep", recapLede: "Now check your opening prediction.",
    reveal: "Reveal", notes: "Notes", keys: "Scroll, ← → or space to move · N for notes"
  },
  fr: {
    lecture: (t: string) => `Cours : ${t}`, kicker: (cat: string) => `Cours · ${cat}`,
    predict: "Avant de commencer — prédis", predictLede: "Note ta réponse. On y reviendra.",
    problem: "Le problème dans ton code", hurts: "Là où ça fait mal", idea: "L'idée",
    roles: "Rôles", rolesTitle: "Les rôles, dans ton repo", headers: ["Rôle", "Ce que c'est", "Chez toi"],
    stage: (i: number, n: number) => `Étape ${i} sur ${n} · exemple canonique`,
    domain: "Dans ton domaine (illustratif)", sameMove: "Le même geste, dans ton code",
    canonical: "Canonique", yours: "Chez toi (illustratif)",
    tradeoffs: "Compromis", whenNot: "Quand s'en passer", watch: "Attention", misconceptions: "Idées reçues",
    check: "Vérifie ta compréhension", explainBack: "Explique-le en retour", tryIt: "À toi", exercise: "Ton exercice",
    run: (cmd: string, lang: string) => `Lance l'exemple canonique : \`${cmd}\` (dans library/examples/${lang} de Plum).`,
    recap: "Récap", keep: "Trois choses à retenir", recapLede: "Reviens maintenant à ta prédiction de départ.",
    reveal: "Réponse", notes: "Notes", keys: "Défile, ← → ou espace pour avancer · N pour les notes"
  }
} satisfies Record<Locale, unknown>;

const LOCALE_NAME: Record<Locale, string> = { en: "English", fr: "French" };

function checkLocale(locale: string | undefined): Locale {
  const l = locale ?? getConfig().locale;
  if (!LOCALES.includes(l as Locale)) throw new Error(`Unknown locale "${l}" — expected one of ${LOCALES.join("|")}`);
  return l as Locale;
}

// ─── render ──────────────────────────────────────────────────────────────────

export const SLIDE_KINDS = ["title", "question", "problem", "idea", "diagram", "binding", "before", "after", "compare",
  "tradeoff", "quiz", "exercise", "recap"] as const;

// Either literal text, or a ref the renderer resolves: "repo:<path>" or "example:<concept>/<lang>/<file>".
export interface CodeBlock { lang?: string; text?: string; ref?: string; lines?: string; src?: string }
export interface Slide {
  kind: (typeof SLIDE_KINDS)[number];
  title: string;
  eyebrow?: string;
  lede?: string;
  meta?: string;
  text?: string[];
  bullets?: string[];
  code?: CodeBlock;
  cols?: { tag?: "before" | "after" | "yours"; label: string; code?: CodeBlock; bullets?: string[] }[];
  table?: { headers: string[]; rows: string[][]; missing?: [number, number][] };
  diagram?: string;
  mermaid?: string;
  quiz?: { q: string; a: string }[];
  notes?: string;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inline text: HTML-escaped, then `code` and **bold** only.
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

let refRoot = process.cwd();
let ui: (typeof UI)[Locale] = UI.en;

function codeHtml(block: CodeBlock): string {
  const c = resolveCodeRef(block, refRoot);
  const cls = c.lang ? ` class="language-${esc(c.lang)}"` : "";
  return `<pre><code${cls}>${esc(c.text ?? "")}</code></pre>` + (c.src ? `\n<p class="src">${esc(c.src)}</p>` : "");
}

function slideHtml(s: Slide, index: number): string {
  if (!SLIDE_KINDS.includes(s.kind)) throw new Error(`Unknown slide kind "${s.kind}" (use: ${SLIDE_KINDS.join(", ")})`);
  const out: string[] = [];
  if (s.eyebrow) out.push(`<p class="eyebrow">${inline(s.eyebrow)}</p>`);
  out.push(s.kind === "title" ? `<h1>${inline(s.title)}</h1>` : `<h2>${inline(s.title)}</h2>`);
  if (s.lede) out.push(`<p class="lede">${inline(s.lede)}</p>`);
  if (s.meta) out.push(`<p class="meta">${inline(s.meta)}</p>`);
  for (const p of s.text ?? []) out.push(`<p>${inline(p)}</p>`);
  if (s.bullets?.length) out.push(`<ul>${s.bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`);
  if (s.diagram) out.push(`<div class="diagram"><pre>${esc(s.diagram)}</pre></div>`);
  if (s.mermaid) out.push(`<pre class="mermaid">${esc(s.mermaid)}</pre>`);
  if (s.code) out.push(codeHtml(s.code));
  if (s.cols?.length) {
    out.push(`<div class="cols">${s.cols.map((c) => [
      `<div class="pane">`,
      c.tag ? `<span class="tag ${c.tag}">${inline(c.label)}</span>` : `<h3>${inline(c.label)}</h3>`,
      c.code ? codeHtml(c.code) : "",
      c.bullets?.length ? `<ul>${c.bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>` : "",
      `</div>`
    ].join("\n")).join("\n")}</div>`);
  }
  if (s.table) {
    const missing = new Set((s.table.missing ?? []).map(([r, c]) => `${r},${c}`));
    out.push(`<div class="table-wrap"><table><thead><tr>${s.table.headers.map((h) => `<th>${inline(h)}</th>`).join("")}</tr></thead><tbody>` +
      s.table.rows.map((row, r) => `<tr>${row.map((cell, c) =>
        `<td${missing.has(`${r},${c}`) ? ' class="missing"' : ""}>${inline(cell)}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></div>`);
  }
  if (s.quiz?.length) {
    out.push(`<ol class="quiz-list">${s.quiz.map((q) =>
      `<li><p>${inline(q.q)}</p><details class="answer"><summary>${ui.reveal}</summary><p>${inline(q.a)}</p></details></li>`).join("")}</ol>`);
  }
  if (s.notes) out.push(`<aside class="notes">${inline(s.notes)}</aside>`);
  return `<section class="slide" id="s${index + 1}" data-kind="${s.kind}">\n  ${out.join("\n  ")}\n</section>`;
}

export function renderDeck(title: string, slides: Slide[], projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), locale: Locale = "en"): string {
  refRoot = projectDir;
  ui = UI[locale];
  const template = readFileSync(join(LIBRARY_DIR, "deck", "template.html"), "utf-8");
  const start = template.indexOf("<!-- SLIDES:START -->");
  const end = template.indexOf("<!-- SLIDES:END -->");
  if (start < 0 || end < 0) throw new Error("deck template is missing its SLIDES markers");
  const body = slides.map((slide, i) => slideHtml(slide, i)).join("\n\n");
  return (template.slice(0, start) + `<!-- SLIDES:START -->\n\n${body}\n\n` + template.slice(end))
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(`>${UI.en.notes}<`, `>${ui.notes}<`).replace(UI.en.keys, ui.keys);
}

// ─── reusable plans ──────────────────────────────────────────────────────────
// Most of a lecture is the same for every repo, so it's generated from the manifest and narrative. Claude fills
// only the repo-specific slots (a small JSON object) and the renderer merges them.

type CodeSlot = CodeBlock | null;
export interface Fills {
  meta?: string;
  question?: string;
  problem?: CodeSlot;          // a real excerpt from their repo ({ref:"repo:…", lines}); null = use the canonical before
  problemText?: string;
  bindings?: Record<string, string>;   // canonical role → their type/file, or "missing"
  yours?: CodeBlock;           // the after stage, rewritten in their domain (illustrative)
  answers?: string[];          // one per manifest check
  exercise?: string[];
  recap?: string[];
  notes?: Record<string, string>;      // optional speaker notes by slide title
  translations?: string[];     // non-English decks: one per plan source string, same order
}
const REQUIRED: (keyof Fills)[] = ["meta", "question", "problem", "problemText", "bindings", "yours", "answers", "exercise", "recap"];

// `sources` are the concept strings shown on slides; a non-English deck needs one translation for each.
export interface Plan { concept: Concept; lang: string; locale: Locale; slides: Slide[]; sources: string[]; slots: { name: string; hint: string }[] }

function sections(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  let current = "";
  for (const line of md.split("\n")) {
    const h = /^##\s+(.+)$/.exec(line);
    if (h) { current = h[1].toLowerCase(); out[current] = ""; continue; }
    if (current) out[current] += line + "\n";
  }
  return out;
}
const plain = (s: string) => s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\s+/g, " ").trim();
function listItems(text: string, max = 4): string[] {
  const items = text.split("\n").filter((l) => /^\s*([-*]|\d+\.)\s+/.test(l)).map((l) => plain(l.replace(/^\s*([-*]|\d+\.)\s+/, "")));
  if (items.length) return items.slice(0, max);
  return plain(text.replace(/```[\s\S]*?```/g, "")).split(/(?<=\.)\s+/).filter((x) => x.length > 20).slice(0, max);
}
const firstParagraph = (text: string) => plain(text.replace(/```[\s\S]*?```/g, "").split(/\n\s*\n/).find((p) => p.trim() && !/^\s*[|>-]/.test(p)) ?? "");
const firstFence = (text: string) => /```[^\n]*\n([\s\S]*?)```/.exec(text)?.[1]?.trimEnd();
const section = (secs: Record<string, string>, re: RegExp) => Object.entries(secs).find(([k]) => re.test(k))?.[1] ?? "";

export function buildPlan(id: string, lang?: string, localeArg?: string): Plan {
  const locale = checkLocale(localeArg);
  const t = UI[locale];
  const c = loadConcepts().find((x) => x.id === id);
  if (!c) throw new Error(`Unknown concept "${id}". Try \`plum teach match "<question>"\`.`);
  const chosen = lang && c.examples[lang] ? lang : Object.keys(c.examples)[0];
  const ex = c.examples[chosen];
  const mdPath = join(LIBRARY_DIR, "concepts", c.id, "CONCEPT.md");
  const secs = existsSync(mdPath) ? sections(readFileSync(mdPath, "utf-8")) : {};
  const idea = section(secs, /the idea/);
  const ref = (file: string) => ({ ref: `example:${c.id}/${chosen}/${file}` });
  const stageFile = (stageId: string) => ex.stages[stageId]?.find((f) => !/test|spec/i.test(f)) ?? ex.stages[stageId]?.[0];

  const ideaText = firstParagraph(idea);
  const trade = listItems(section(secs, /trade-?off|when not|cost/));
  const mis = listItems(section(secs, /misconception/));
  const slides: Slide[] = [
    { kind: "title", eyebrow: t.kicker(c.category), title: c.title, lede: c.summary, meta: "{{meta}}" },
    { kind: "question", eyebrow: t.predict, title: "{{question}}", lede: t.predictLede },
    { kind: "problem", eyebrow: t.problem, title: t.hurts, text: ["{{problemText}}"], code: { ref: "{{problem}}" } },
    { kind: "idea", eyebrow: t.idea, title: c.title, text: [ideaText].filter(Boolean), diagram: firstFence(idea) },
    { kind: "binding", eyebrow: t.roles, title: t.rolesTitle,
      table: { headers: t.headers, rows: Object.entries(c.roles).map(([k, v]) => [`\`${k}\``, v, `{{bindings.${k}}}`]) } }
  ];
  const stages = c.stages;
  stages.forEach((st, i) => {
    const kind: Slide["kind"] = i === 0 ? "before" : i === stages.length - 1 ? "after" : "compare";
    const f = stageFile(st.id);
    slides.push({ kind, eyebrow: t.stage(i + 1, stages.length), title: st.title, text: [st.idea],
      ...(f ? { code: ref(f) } : {}) });
  });
  slides.push({ kind: "compare", eyebrow: t.domain, title: t.sameMove,
    cols: [
      { tag: "after", label: t.canonical, ...(stageFile(stages.at(-1)!.id) ? { code: ref(stageFile(stages.at(-1)!.id)!) } : {}) },
      { tag: "yours", label: t.yours, code: { ref: "{{yours}}" } }
    ] });
  if (trade.length) slides.push({ kind: "tradeoff", eyebrow: t.tradeoffs, title: t.whenNot, bullets: trade });
  if (mis.length) slides.push({ kind: "idea", eyebrow: t.watch, title: t.misconceptions, bullets: mis });
  slides.push({ kind: "quiz", eyebrow: t.check, title: t.explainBack, quiz: c.checks.map((q, i) => ({ q, a: `{{answers.${i}}}` })) });
  slides.push({ kind: "exercise", eyebrow: t.tryIt, title: t.exercise, bullets: ["{{exercise}}"],
    text: [t.run(ex.run, chosen)] });
  slides.push({ kind: "recap", eyebrow: t.recap, title: t.keep, bullets: ["{{recap}}"], lede: t.recapLede });
  const sources = [...new Set([c.title, c.summary, c.category, ideaText, ...Object.values(c.roles),
    ...stages.flatMap((st) => [st.title, st.idea]), ...trade, ...mis, ...c.checks].filter(Boolean))];

  const roles = Object.keys(c.roles);
  return {
    concept: c, lang: chosen, locale, slides, sources,
    slots: [
      { name: "meta", hint: `string — "Bound to: <repo> · ${chosen} · <framework> · ~N min"` },
      { name: "question", hint: "string — a predict-first question about their code" },
      { name: "problem", hint: '{ "ref": "repo:<path>", "lines": "a-b" } — a real excerpt showing the problem, or null to use the canonical before' },
      { name: "problemText", hint: "string — one sentence on what's wrong in that excerpt" },
      { name: "bindings", hint: `object — their type/file (or "missing") for each role: ${roles.join(", ")}` },
      { name: "yours", hint: '{ "lang": "…", "text": "…" } — the after stage rewritten in their domain, short (illustrative)' },
      { name: "answers", hint: `string[${c.checks.length}] — one answer per quiz question, referencing their code` },
      { name: "exercise", hint: "string[] — 1–3 concrete changes in their repo, with file paths" },
      { name: "recap", hint: "string[3] — three takeaways" },
      ...(locale === "en" ? [] : [{ name: "translations",
        hint: `string[${sources.length}] — the ${LOCALE_NAME[locale]} translation of each numbered source string below, same order; keep \`code\` spans and identifiers as-is` }])
    ]
  };
}

export function renderPlan(id: string, lang: string | undefined, fills: Fills, projectDir?: string, locale?: string): string {
  const plan = buildPlan(id, lang, locale);
  const missing = [...REQUIRED, ...(plan.locale === "en" ? [] : ["translations" as const])].filter((k) => fills[k] === undefined);
  if (missing.length) throw new Error(`Missing slots: ${missing.join(", ")}`);
  const roles = Object.keys(plan.concept.roles);
  const unbound = roles.filter((r) => !(r in (fills.bindings ?? {})));
  if (unbound.length) throw new Error(`bindings is missing roles: ${unbound.join(", ")}`);
  if ((fills.answers ?? []).length !== plan.concept.checks.length) throw new Error(`answers needs ${plan.concept.checks.length} entries`);
  if (plan.locale !== "en" && fills.translations!.length !== plan.sources.length) throw new Error(`translations needs ${plan.sources.length} entries`);
  const translated = new Map(plan.locale === "en" ? [] : plan.sources.map((src, i) => [src, fills.translations![i]]));
  const tr = (v: string) => translated.get(v) ?? v;

  const str = (v: string) => tr(v)
    .replace("{{meta}}", fills.meta!).replace("{{question}}", fills.question!).replace("{{problemText}}", fills.problemText!)
    .replace(/\{\{bindings\.(.+?)\}\}/, (_, k) => fills.bindings![k])
    .replace(/\{\{answers\.(\d+)\}\}/, (_, i) => fills.answers![Number(i)]);
  const firstStageCode = plan.slides.find((s) => s.kind === "before")?.code;
  const slides = plan.slides.map((s): Slide => {
    const next: Slide = { ...s, title: str(s.title) };
    if (s.kind === "title") next.eyebrow = UI[plan.locale].kicker(tr(plan.concept.category));
    if (next.meta) next.meta = str(next.meta);
    if (next.text) next.text = next.text.map(str);
    if (next.bullets) next.bullets = next.bullets.flatMap((b) => b === "{{exercise}}" ? fills.exercise! : b === "{{recap}}" ? fills.recap! : [str(b)]);
    if (next.code?.ref === "{{problem}}") next.code = fills.problem ?? firstStageCode;
    if (next.cols) next.cols = next.cols.map((c) => c.code?.ref === "{{yours}}" ? { ...c, code: fills.yours! } : c);
    if (next.table) {
      const missingCells: [number, number][] = [];
      next.table = { ...next.table, rows: next.table.rows.map((row, r) => row.map((cell, col) => {
        const v = str(cell);
        if (col === 2 && /^(missing|manquant)$/i.test(v.trim())) missingCells.push([r, col]);
        return v;
      })), missing: missingCells };
    }
    if (next.lede) next.lede = str(next.lede);
    if (next.quiz) next.quiz = next.quiz.map((q) => ({ q: str(q.q), a: str(q.a) }));
    const note = fills.notes?.[s.title];
    if (note) next.notes = note;
    return next;
  });
  return renderDeck(UI[plan.locale].lecture(tr(plan.concept.title)), slides, projectDir, plan.locale);
}

// A rendered lecture counts as studying the concept (used by progress and concept goals). Counts only.
function recordLecture(c: Concept): void {
  try {
    getDb().run(
      `INSERT INTO events (session_id, ts, event_type, category, delegated, verified, metadata) VALUES (?, ?, 'lecture', ?, 0, 0, ?)`,
      [latestSessionId() ?? "manual", Date.now(), c.domain, JSON.stringify({ concept: c.id })]
    );
  } catch (e) { console.error(`[Plum] Couldn't record the lecture: ${(e as Error).message}`); }
}

// ─── `plum teach …` ──────────────────────────────────────────────────────────

export async function runTeachCommand(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  const flags = parseFlags(rest);
  const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--") && flags[rest[i - 1].slice(2)] === a));
  try {
    switch (sub) {
      case "match": {
        const matches = matchConcepts(positional.join(" "), loadConcepts());
        if (matches.length === 0) { console.log("No concept matches. Available: " + loadConcepts().map((c) => c.id).join(", ")); return 0; }
        for (const m of matches) console.log(`${m.id} — ${m.title}: ${m.summary}`);
        return 0;
      }
      case "survey": {
        const concept = flags.concept ? loadConcepts().find((c) => c.id === flags.concept) : undefined;
        if (flags.concept && !concept) throw new Error(`Unknown concept "${flags.concept}"`);
        const root = positional[0] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
        const { status, note } = ensureGraph(root);
        console.log([surveyRepo(root, concept), ...graphSurvey(status, root), ...(note ? ["", note] : [])].join("\n"));
        return 0;
      }
      case "outline": {
        const root = realpathSync(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());   // /var vs /private/var on macOS
        if (positional.length === 0) { console.error("Usage: plum teach outline <file> [file …] (paths relative to the project)"); return 1; }
        const { status } = ensureGraph(root);
        console.log(positional.map((f) => {
          const abs = insideProject(root, f);
          return graphOutline(status, root, abs) ?? outlineFile(abs, root);
        }).join("\n\n"));
        return 0;
      }
      case "index": {
        const root = positional[0] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
        const bin = codeMapBin();
        if (!bin) throw new Error(`code-map isn't installed. Install it:\n${INSTALL_HINT}`);
        const graph = graphName(root);
        const r = indexProject(root, bin, graph);
        console.log(`[Plum] Indexed ${root} into code-map graph "${graph}" (${r.files} files, ${r.entities} entities).`);
        return 0;
      }
      case "brief":
        if (!positional[0]) { console.error("Usage: plum teach brief <concept> [--lang L] [--full]"); return 1; }
        console.log(conceptBrief(positional[0], flags.lang, flags.full === "true"));
        return 0;
      case "plan": {
        if (!positional[0]) { console.error("Usage: plum teach plan <concept> [--lang L]"); return 1; }
        const plan = buildPlan(positional[0], flags.lang, flags.locale);
        const loc = plan.locale === "en" ? "" : ` --locale ${plan.locale}`;
        console.log([
          `Plan for ${plan.concept.id} (${plan.lang}${loc ? `, ${LOCALE_NAME[plan.locale]}` : ""}): ${plan.slides.length} slides generated. Fill these slots as one JSON object,`,
          `then: plum teach render --plan ${plan.concept.id} --lang ${plan.lang}${loc} --fill <fills.json>`,
          ...plan.slots.map((s) => `- ${s.name}: ${s.hint}`),
          ...(loc ? ["", `Write every slot in ${LOCALE_NAME[plan.locale]}. Source strings to translate:`, ...plan.sources.map((x, i) => `${i}. ${x}`)] : [])
        ].join("\n"));
        return 0;
      }
      case "render": {
        if (flags.plan) {
          const fillsRaw = flags.fill ? readFileSync(flags.fill, "utf-8") : await Bun.stdin.text();
          const plan = buildPlan(flags.plan, flags.lang, flags.locale);
          const out = flags.out ?? join(PLUM_DATA_DIR, "sessions", `${plan.concept.id}-${basename(process.env.CLAUDE_PROJECT_DIR ?? process.cwd())}.html`);
          mkdirSync(dirname(out), { recursive: true });
          writeFileSync(out, renderPlan(flags.plan, flags.lang, JSON.parse(fillsRaw) as Fills, undefined, plan.locale));
          recordLecture(plan.concept);
          console.log(`${out}\n${plan.slides.length} slides`);
          return 0;
        }
        const raw = flags.in ? readFileSync(flags.in, "utf-8") : await Bun.stdin.text();
        const slides = JSON.parse(raw) as Slide[];
        if (!Array.isArray(slides) || slides.length === 0) throw new Error("render expects a non-empty JSON array of slides");
        const title = flags.title ?? slides[0].title;
        const out = flags.out ?? join(PLUM_DATA_DIR, "sessions", `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.html`);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, renderDeck(title, slides, undefined, checkLocale(flags.locale)));
        console.log(`${out}\n${slides.length} slides`);
        return 0;
      }
      default:
        console.error("Usage: plum teach match <query> | survey [dir] [--concept id] | outline <file…> | index [dir] | plan <concept> [--lang L] [--locale en|fr] | render --plan <concept> --fill F [--locale en|fr] | brief <concept> [--lang L] [--full] | render --title T [--out F] [--in slides.json]");
        return 1;
    }
  } catch (e) {
    console.error(`[Plum] ${(e as Error).message}`);
    return 1;
  }
}
