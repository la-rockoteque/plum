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
  expect(html.match(/<section class="slide"/g)?.length).toBe(slides.length);
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
  expect(html).toContain("function go(i)");                        // engine script kept
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

test("`plum teach brief` bundles manifest, narrative and code for one language", () => {
  const p = Bun.spawnSync(["bun", CLI, "teach", "brief", "unit-of-work", "--lang", "go"]);
  const out = p.stdout.toString();
  expect(p.exitCode).toBe(0);
  expect(out).toContain("# Unit of Work (unit-of-work)");
  expect(out).toContain("## Roles");
  expect(out).toContain("## Checks");
  expect(out).toContain("## Narrative");
  expect(out).toContain("uow/batch.go");
  expect(out).toContain("```go");
});
