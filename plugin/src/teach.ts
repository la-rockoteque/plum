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
import { parseFlags } from "./feedback.js";

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
      `<li><p>${inline(q.q)}</p><details class="answer"><summary>Reveal</summary><p>${inline(q.a)}</p></details></li>`).join("")}</ol>`);
  }
  if (s.notes) out.push(`<aside class="notes">${inline(s.notes)}</aside>`);
  return `<section class="slide" id="s${index + 1}" data-kind="${s.kind}">\n  ${out.join("\n  ")}\n</section>`;
}

export function renderDeck(title: string, slides: Slide[], projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()): string {
  refRoot = projectDir;
  const template = readFileSync(join(LIBRARY_DIR, "deck", "template.html"), "utf-8");
  const start = template.indexOf("<!-- SLIDES:START -->");
  const end = template.indexOf("<!-- SLIDES:END -->");
  if (start < 0 || end < 0) throw new Error("deck template is missing its SLIDES markers");
  const body = slides.map((slide, i) => slideHtml(slide, i)).join("\n\n");
  return (template.slice(0, start) + `<!-- SLIDES:START -->\n\n${body}\n\n` + template.slice(end))
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`);
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
        console.log(surveyRepo(positional[0] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), concept));
        return 0;
      }
      case "outline": {
        const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
        if (positional.length === 0) { console.error("Usage: plum teach outline <file> [file …] (paths relative to the project)"); return 1; }
        console.log(positional.map((f) => outlineFile(insideProject(root, f), root)).join("\n\n"));
        return 0;
      }
      case "brief":
        if (!positional[0]) { console.error("Usage: plum teach brief <concept> [--lang L] [--full]"); return 1; }
        console.log(conceptBrief(positional[0], flags.lang, flags.full === "true"));
        return 0;
      case "render": {
        const raw = flags.in ? readFileSync(flags.in, "utf-8") : await Bun.stdin.text();
        const slides = JSON.parse(raw) as Slide[];
        if (!Array.isArray(slides) || slides.length === 0) throw new Error("render expects a non-empty JSON array of slides");
        const title = flags.title ?? slides[0].title;
        const out = flags.out ?? join(PLUM_DATA_DIR, "sessions", `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.html`);
        mkdirSync(dirname(out), { recursive: true });
        writeFileSync(out, renderDeck(title, slides));
        console.log(`${out}\n${slides.length} slides`);
        return 0;
      }
      default:
        console.error("Usage: plum teach match <query> | survey [dir] [--concept id] | outline <file…> | brief <concept> [--lang L] [--full] | render --title T [--out F] [--in slides.json]");
        return 1;
    }
  } catch (e) {
    console.error(`[Plum] ${(e as Error).message}`);
    return 1;
  }
}
