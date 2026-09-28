// Guards the concept library: manifests must stay in sync with the example code they point at.
import { test, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { loadConcepts, LIBRARY_DIR, EXAMPLES_DIR, CATEGORIES, DOMAINS, LEVELS, LANGUAGES, BACKEND_LANGUAGES } from "./library.js";

// Stage ids become package/module/namespace names in every language.
const STAGE_ID   = /^[a-z]+$/;
const KEYWORDS   = new Set(["as", "break", "case", "class", "default", "do", "else", "for", "func", "go", "if", "import",
  "in", "interface", "is", "new", "object", "package", "return", "select", "struct", "switch", "type", "val", "var",
  "when", "while", "with", "yield", "fun", "def", "del", "from", "global", "lambda", "pass", "raise", "try", "base",
  "checked", "event", "fixed", "internal", "lock", "namespace", "operator", "out", "params", "ref", "sealed", "static",
  "this", "throw", "using", "virtual", "void", "async", "await", "not", "and", "or", "none", "true", "false", "null"]);
// Concepts whose lessons are backend code ship in every backend language; frontend and deployment media don't.
const SINGLE_MEDIUM = new Set(["react", "infra"]);

const concepts = loadConcepts();
const ids      = new Set(concepts.map((c) => c.id));

test("the library ships the imported formation-backend concepts", () => {
  for (const id of ["repository", "dependency-inversion", "cqrs", "orm", "unit-of-work"]) {
    expect(ids.has(id)).toBe(true);
  }
});

for (const c of concepts) {
  test(`${c.id}: manifest is complete and every referenced file exists`, () => {
    expect(existsSync(join(LIBRARY_DIR, "concepts", c.id, "CONCEPT.md"))).toBe(true);
    expect(c.title?.length ?? 0).toBeGreaterThan(3);
    expect(c.id).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
    expect(CATEGORIES).toContain(c.category);
    expect(DOMAINS).toContain(c.domain);
    expect(LEVELS).toContain(c.level);
    expect(c.summary.length).toBeGreaterThan(20);
    expect(c.stages.length).toBeGreaterThanOrEqual(2);
    expect(c.signals.length).toBeGreaterThanOrEqual(3);
    expect(c.signals.length).toBeLessThanOrEqual(5);
    expect(c.checks.length).toBeGreaterThanOrEqual(3);
    expect(c.checks.length).toBeLessThanOrEqual(5);
    for (const st of c.stages) {
      expect({ stage: st.id, valid: STAGE_ID.test(st.id) && !KEYWORDS.has(st.id) }).toEqual({ stage: st.id, valid: true });
      expect(st.title.length > 0 && st.idea.length > 10).toBe(true);
    }

    const langs = Object.keys(c.examples);
    expect(langs.length).toBeGreaterThan(0);
    for (const l of langs) expect(LANGUAGES as readonly string[]).toContain(l);
    if (!langs.some((l) => SINGLE_MEDIUM.has(l))) expect([...langs].sort()).toEqual([...BACKEND_LANGUAGES].sort());
    expect(Object.keys(c.roles).length).toBeGreaterThan(0);

    for (const ref of [...c.prerequisites, ...c.related]) expect(ids.has(ref)).toBe(true);

    const stageIds = c.stages.map((s) => s.id);
    for (const [lang, ex] of Object.entries(c.examples)) {
      expect(Object.keys(ex.stages).sort()).toEqual([...stageIds].sort());
      expect(ex.tests.length).toBeGreaterThan(0);
      expect(ex.run.trim().length).toBeGreaterThan(0);
      // dotnet exits 0 when a filter matches nothing; the trailing "Tests." keeps one class from prefix-matching another.
      if (lang === "dotnet" && ex.run.includes("--filter")) expect(ex.run).toMatch(/FullyQualifiedName~RepositoryExample\.Tests\.\w+Tests\.(\s|$)/);
      const files = [...Object.values(ex.stages).flat(), ...ex.tests];
      for (const f of files) {
        expect({ lang, file: f, exists: existsSync(join(EXAMPLES_DIR, lang, f)) })
          .toEqual({ lang, file: f, exists: true });
      }
    }
  });
}

test("`plum concepts --json` lists every concept", () => {
  const p = Bun.spawnSync(["bun", join(import.meta.dir, "cli.ts"), "concepts", "--json"], {
    env: { ...process.env, PLUM_DATA_DIR: join(tmpdir(), "plum-library-test") }
  });
  const listed = JSON.parse(p.stdout.toString()) as { id: string }[];
  expect(listed.map((c) => c.id).sort()).toEqual([...ids].sort());
});
