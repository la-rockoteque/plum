// Teach helpers: concept matching, repo survey, one-call brief, and deck rendering from compact JSON.
import { test, expect } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { matchConcepts, surveyRepo, renderDeck, type Slide } from "./teach.js";
import { loadConcepts } from "./library.js";

const CLI = join(import.meta.dir, "cli.ts");

// ── match ────────────────────────────────────────────────────────────────────

test("match ranks an exact id first", () => {
  expect(matchConcepts("unit-of-work", loadConcepts())[0].id).toBe("unit-of-work");
});

test("match finds concepts from a plain-language question", () => {
  const ids = matchConcepts("my service calls SQL directly and tests need a database", loadConcepts()).map((m) => m.id);
  expect(ids.slice(0, 3)).toContain("repository");
});

test("match returns nothing for an unrelated question", () => {
  expect(matchConcepts("zzqx flibbertigibbet", loadConcepts())).toEqual([]);
});

// ── survey ───────────────────────────────────────────────────────────────────

test("survey reports stack, layout and role candidates without reading file contents", () => {
  const repo = mkdtempSync(join(tmpdir(), "plum-survey-"));
  const files: Record<string, string> = {
    "package.json": JSON.stringify({ dependencies: { "@nestjs/core": "1", "@prisma/client": "5", react: "19" } }),
    "src/orders/order.entity.ts": "export class Order {}",
    "src/orders/order.repository.ts": "export interface OrderRepository {}",
    "src/orders/order.service.ts": "export class OrderService {}",
    "src/orders/orders.controller.ts": "export class OrdersController {}",
    "src/orders/__tests__/order.service.spec.ts": "test('x', () => {})",
    "README.md": "# app"
  };
  for (const [p, c] of Object.entries(files)) {
    mkdirSync(join(repo, p, ".."), { recursive: true });
    writeFileSync(join(repo, p), c);
  }
  const s = surveyRepo(repo);
  expect(s).toContain("typescript");
  expect(s).toMatch(/NestJS/);
  expect(s).toMatch(/Prisma/);
  expect(s).toContain("src/orders/order.repository.ts");
  expect(s).toContain("src/orders/orders.controller.ts");
  expect(s).toMatch(/entities[^\n]*order\.entity\.ts/);
  expect(s).toMatch(/tests[^\n]*order\.service\.spec\.ts/);
});

// ── render ───────────────────────────────────────────────────────────────────

const slides: Slide[] = [
  { kind: "title", eyebrow: "Lecture", title: "Unit of Work", lede: "One operation, one commit.", meta: "Bound to: shop · TypeScript" },
  { kind: "question", eyebrow: "Predict", title: "What happens if the second save fails?" },
  {
    kind: "compare", title: "Same rule, two homes",
    cols: [
      { tag: "before", label: "Before", code: { lang: "ts", text: "if (a < b && c > d) { save(x); }", src: "src/a.ts:1–3" } },
      { tag: "yours", label: "Your repo", code: { lang: "ts", text: "const x = <T>y;" } }
    ]
  },
  {
    kind: "binding", title: "Roles in your repo",
    table: { headers: ["Role", "Yours"], rows: [["Port", "`OrderRepository`"], ["Fake", "missing"]], missing: [[1, 1]] }
  },
  { kind: "idea", title: "The idea", bullets: ["Open **one** scope", "Commit `once`"], diagram: "begin → write → commit" },
  { kind: "quiz", title: "Explain it back", quiz: [{ q: "Flush vs commit?", a: "Flush sends SQL; commit makes it durable." }] },
  { kind: "recap", title: "Recap", bullets: ["a", "b"], notes: "Ask for the prediction again." }
];

test("render fills the template, escapes code and text, and keeps the slide engine", () => {
  const html = renderDeck("Unit of Work Lecture", slides);
  expect(html).toContain("<title>Unit of Work Lecture</title>");
  expect(html).not.toContain("The Repository Pattern");                // the template's sample slides are replaced
  expect(html.match(/<section class="slide" id="s\d+"/g)?.length).toBe(slides.length);
  expect(html).toContain("if (a &lt; b &amp;&amp; c &gt; d)");
  expect(html).toContain("const x = &lt;T&gt;y;");
  expect(html).toContain('class="language-ts"');
  expect(html).toContain('<p class="src">src/a.ts:1–3</p>');
  expect(html).toContain('<span class="tag yours">Your repo</span>');
  expect(html).toContain('<td class="missing">missing</td>');
  expect(html).toContain("<code>OrderRepository</code>");
  expect(html).toContain("<strong>one</strong>");
  expect(html).toContain('<details class="answer"><summary>Reveal</summary>');
  expect(html).toContain('<aside class="notes">Ask for the prediction again.</aside>');
  expect(html).toContain("<h1>Unit of Work</h1>");
  expect(html).toContain("function go(i, instant)");               // engine script kept
});

test("render refuses unknown slide kinds and script injection in text", () => {
  expect(() => renderDeck("x", [{ kind: "bogus" as never, title: "t" }])).toThrow();
  const html = renderDeck("x", [{ kind: "idea", title: "<script>alert(1)</script>" }]);
  expect(html).not.toContain("<script>alert(1)");
});

test("`plum teach render` writes the deck from JSON on stdin", () => {
  const out = join(mkdtempSync(join(tmpdir(), "plum-deck-")), "deck.html");
  const p = Bun.spawnSync(["bun", CLI, "teach", "render", "--title", "Unit of Work Lecture", "--out", out], {
    stdin: new TextEncoder().encode(JSON.stringify(slides))
  });
  expect(p.exitCode).toBe(0);
  expect(p.stdout.toString()).toContain(out);
  expect(readFileSync(out, "utf-8")).toContain("<title>Unit of Work Lecture</title>");
});

test("`plum teach brief --full` bundles manifest, narrative and code for one language", () => {
  const p = Bun.spawnSync(["bun", CLI, "teach", "brief", "unit-of-work", "--lang", "go", "--full"]);
  const out = p.stdout.toString();
  expect(p.exitCode).toBe(0);
  expect(out).toContain("# Unit of Work (unit-of-work)");
  expect(out).toContain("## Roles");
  expect(out).toContain("## Checks");
  expect(out).toContain("## Narrative");
  expect(out).toContain("uow/batch.go");
  expect(out).toContain("```go");
});

// ── token-lean exploration ───────────────────────────────────────────────────

import { outlineFile, resolveCodeRef } from "./teach.js";

test("outline shows numbered declarations and data-access imports, not bodies", () => {
  const dir = mkdtempSync(join(tmpdir(), "plum-outline-"));
  const f = join(dir, "order.service.ts");
  writeFileSync(f, [
    'import { PrismaService } from "../prisma/prisma.service";',
    'import { format } from "date-fns";',
    "",
    "export class OrderService {",
    "  constructor(private readonly prisma: PrismaService) {}",
    "",
    "  async cancel(id: number): Promise<void> {",
    "    const row = await this.prisma.order.findUnique({ where: { id } });",
    "    if (row.status === 'shipped') throw new Error('nope');",
    "  }",
    "}",
    "",
    "export function helper(x: number) { return x * 2; }"
  ].join("\n"));
  const out = outlineFile(f, dir);
  expect(out).toContain("order.service.ts (13 lines)");
  expect(out).toContain("1: import { PrismaService }");
  expect(out).not.toContain("date-fns");
  expect(out).toContain("4: export class OrderService {");
  expect(out).toContain("7:   async cancel(id: number): Promise<void> {");
  expect(out).toContain("13: export function helper");
  expect(out).not.toContain("findUnique");
});

test("survey --concept keeps only the role categories that concept binds", () => {
  const repo = mkdtempSync(join(tmpdir(), "plum-survey-c-"));
  for (const p of ["src/orders/order.repository.ts", "src/orders/order.service.ts", "src/orders/orders.controller.ts", "src/orders/order.entity.ts"]) {
    mkdirSync(join(repo, p, ".."), { recursive: true });
    writeFileSync(join(repo, p), "x");
  }
  const s = surveyRepo(repo, loadConcepts().find((c) => c.id === "repository"));
  expect(s).toContain("order.repository.ts");
  expect(s).not.toContain("## Layout");
  expect(s.split("\n").length).toBeLessThan(15);
});

test("code refs pull repo and example lines into slides, and can't escape the project", () => {
  const repo = mkdtempSync(join(tmpdir(), "plum-ref-"));
  mkdirSync(join(repo, "src"));
  writeFileSync(join(repo, "src", "a.ts"), ["one", "two", "three <T>", "four"].join("\n"));
  expect(resolveCodeRef({ ref: "repo:src/a.ts", lines: "2-3" }, repo)).toEqual({ lang: "ts", text: "two\nthree <T>", src: "src/a.ts:2–3" });
  expect(() => resolveCodeRef({ ref: "repo:../../etc/passwd" }, repo)).toThrow();
  expect(() => resolveCodeRef({ ref: "repo:/etc/passwd" }, repo)).toThrow();
  const ex = resolveCodeRef({ ref: "example:unit-of-work/go/uow/batch.go", lines: "1-3" }, repo);
  expect(ex.src).toBe("Plum library · go/uow/batch.go:1–3");
  expect(ex.text?.split("\n").length).toBe(3);
});

test("brief defaults to essentials plus outlines; --full adds narrative and code", () => {
  const lean = Bun.spawnSync(["bun", CLI, "teach", "brief", "unit-of-work", "--lang", "go"]).stdout.toString();
  const full = Bun.spawnSync(["bun", CLI, "teach", "brief", "unit-of-work", "--lang", "go", "--full"]).stdout.toString();
  expect(lean).toContain("## Outlines");
  expect(lean).not.toContain("## Narrative");
  expect(full).toContain("## Narrative");
  expect(full).toContain("```go");
  expect(lean.length).toBeLessThan(full.length / 2);
});

// ── reusable slide plans ─────────────────────────────────────────────────────

import { buildPlan, renderPlan } from "./teach.js";

const fills = {
  meta: "Bound to: shop · TypeScript · NestJS · ~20 min",
  question: "If a second save fails, what is left in the database?",
  problem: { ref: "example:unit-of-work/typescript/src/orm/repository.ts", lines: "1-10" },
  problemText: "Each save commits on its own.",
  bindings: { "batch cancellation": "`CancelOrdersHandler`", "flush": "missing" },
  yours: { lang: "ts", text: "await prisma.$transaction(async (tx) => { /* … */ });" },
  answers: ["a1", "a2", "a3", "a4"],
  exercise: ["Wrap `cancelMany` in one transaction."],
  recap: ["one", "two", "three"]
};

test("a plan lists only the repo-specific slots, and generated slides come from the manifest", () => {
  const plan = buildPlan("unit-of-work", "typescript");
  expect(plan.slots.map((s) => s.name)).toEqual(["meta", "question", "problem", "problemText", "bindings", "yours", "answers", "exercise", "recap"]);
  expect(plan.slots.find((s) => s.name === "answers")?.hint).toContain("4");
  const kinds = plan.slides.map((s) => s.kind);
  expect(kinds[0]).toBe("title");
  expect(kinds).toContain("quiz");
  expect(plan.slides.some((s) => s.cols?.some((c) => c.code?.ref?.startsWith("example:unit-of-work/typescript/")))).toBe(true);
});

test("render --plan merges fills into the generated deck", () => {
  const roles = Object.keys(buildPlan("unit-of-work", "typescript").concept.roles);
  const bindings = Object.fromEntries(roles.map((r, i) => [r, i === 0 ? "`CancelOrdersHandler`" : i === 1 ? "missing" : "`x`"]));
  const html = renderPlan("unit-of-work", "typescript", { ...fills, bindings });
  expect(html).toContain("<title>Unit of Work Lecture</title>");
  expect(html).toContain("If a second save fails");
  expect(html).toContain("<code>CancelOrdersHandler</code>");
  expect(html).toContain('<td class="missing">missing</td>');
  expect(html).toContain("prisma.$transaction");
  expect(html).toContain("<p>a3</p>");
  expect(html.match(/<section class="slide"/g)!.length).toBeGreaterThanOrEqual(10);
});

test("render --plan refuses missing slots and names them", () => {
  const { answers: _a, question: _q, ...partial } = fills;
  expect(() => renderPlan("unit-of-work", "typescript", partial)).toThrow(/question.*answers|answers.*question/);
});

test("`plum teach plan` prints slots compactly", () => {
  const out = Bun.spawnSync(["bun", CLI, "teach", "plan", "unit-of-work", "--lang", "typescript"]).stdout.toString();
  expect(out).toContain("bindings");
  expect(out.length).toBeLessThan(2500);
});

test("every concept in the library produces a plan that renders", () => {
  for (const c of loadConcepts()) {
    for (const lang of Object.keys(c.examples)) {
      const plan = buildPlan(c.id, lang);
      const html = renderPlan(c.id, lang, {
        meta: "m", question: "q", problem: null, problemText: "p",
        bindings: Object.fromEntries(Object.keys(c.roles).map((r) => [r, "x"])),
        yours: { lang: "ts", text: "x" }, answers: c.checks.map(() => "a"), exercise: ["e"], recap: ["r1", "r2", "r3"]
      });
      expect({ id: c.id, lang, ok: html.includes("</section>") && !/\{\{(meta|question|problem|problemText|bindings|yours|answers|exercise|recap)/.test(html) }).toEqual({ id: c.id, lang, ok: true });
      expect(plan.slides.length).toBeGreaterThanOrEqual(9);
    }
  }
});
