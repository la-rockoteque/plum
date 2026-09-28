/**
 * Helpers for /plum:teach, so a lecture takes a handful of tool calls instead of dozens:
 *   match  — rank concepts for an id or a plain-language question (one line each, no manifest dump)
 *   survey — compact profile of the consumer repo: stack, layout, candidate files per role
 *   brief  — one bundle: manifest essentials, narrative and the example code in one language
 *   render — build the deck HTML from compact slide JSON (escaping, template and engine handled here)
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "fs";
import { basename, dirname, extname, join, relative } from "path";
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

export function surveyRepo(root: string): string {
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
  const roles = ROLE_PATTERNS.map(([name, re]) => {
    const hits = source.filter((f) => re.test(f) && (name === "tests" || !isTest(f)));
    return `- ${name} (${hits.length}): ${hits.slice(0, 6).join(", ") || "none found"}`;
  });

  const nouns: Record<string, number> = {};
  for (const f of source.filter((x) => ROLE_PATTERNS[0][1].test(x) || ROLE_PATTERNS[1][1].test(x))) {
    const n = basename(f).split(/[._-]/)[0].replace(/(Repository|Service|Entity|Model|Dto)$/i, "").toLowerCase();
    if (n.length > 2 && !["index", "base", "types", "utils", "common"].includes(n)) nouns[n] = (nouns[n] ?? 0) + 1;
  }
  const domain = Object.entries(nouns).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([n]) => n);

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

// ─── brief ───────────────────────────────────────────────────────────────────

const FENCE: Record<string, string> = { python: "python", typescript: "ts", go: "go", dotnet: "csharp", kotlin: "kotlin", react: "tsx", infra: "" };

export function conceptBrief(id: string, lang: string | undefined, withNarrative = true): string {
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
  if (withNarrative) {
    const md = join(LIBRARY_DIR, "concepts", c.id, "CONCEPT.md");
    if (existsSync(md)) lines.push("", "## Narrative", readFileSync(md, "utf-8").trim());
  }
  try {
    const { dir, files } = fetchConcept(c.id, chosen);
    const stageOf = (f: string) => Object.entries(c.examples[chosen].stages).find(([, fs]) => fs.includes(f))?.[0] ?? "test";
    lines.push("", `## Code (${chosen})`);
    for (const f of files) {
      lines.push("", `### ${f} [${stageOf(f)}]`, "```" + (FENCE[chosen] ?? ""), readFileSync(join(dir, f), "utf-8").trimEnd(), "```");
    }
  } catch (e) {
    lines.push("", `## Code unavailable: ${(e as Error).message}`, "Teach from the narrative and say so on the title slide.");
  }
  return lines.join("\n");
}

// ─── render ──────────────────────────────────────────────────────────────────

export const SLIDE_KINDS = ["title", "question", "problem", "idea", "diagram", "binding", "before", "after", "compare",
  "tradeoff", "quiz", "exercise", "recap"] as const;

export interface CodeBlock { lang?: string; text: string; src?: string }
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

function codeHtml(c: CodeBlock): string {
  const cls = c.lang ? ` class="language-${esc(c.lang)}"` : "";
  return `<pre><code${cls}>${esc(c.text)}</code></pre>` + (c.src ? `\n<p class="src">${esc(c.src)}</p>` : "");
}

function slideHtml(s: Slide): string {
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
  return `<section class="slide" data-kind="${s.kind}">\n  ${out.join("\n  ")}\n</section>`;
}

export function renderDeck(title: string, slides: Slide[]): string {
  const template = readFileSync(join(LIBRARY_DIR, "deck", "template.html"), "utf-8");
  const start = template.indexOf("<!-- SLIDES:START -->");
  const end = template.indexOf("<!-- SLIDES:END -->");
  if (start < 0 || end < 0) throw new Error("deck template is missing its SLIDES markers");
  const body = slides.map(slideHtml).join("\n\n");
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
      case "survey":
        console.log(surveyRepo(positional[0] ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd()));
        return 0;
      case "brief":
        if (!positional[0]) { console.error("Usage: plum teach brief <concept> [--lang L] [--no-narrative]"); return 1; }
        console.log(conceptBrief(positional[0], flags.lang, flags["no-narrative"] !== "true"));
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
        console.error("Usage: plum teach match <query> | survey [dir] | brief <concept> [--lang L] | render --title T [--out F] [--in slides.json]");
        return 1;
    }
  } catch (e) {
    console.error(`[Plum] ${(e as Error).message}`);
    return 1;
  }
}
