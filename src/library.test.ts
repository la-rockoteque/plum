// Guards the concept library: manifests must stay in sync with the example code they point at.
import { test, expect } from "bun:test";
import { existsSync } from "fs";
import { join } from "path";
import { loadConcepts, LIBRARY_DIR, CATEGORIES, DOMAINS, LEVELS } from "./library.js";

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
    expect(CATEGORIES).toContain(c.category);
    expect(DOMAINS).toContain(c.domain);
    expect(LEVELS).toContain(c.level);
    expect(c.summary.length).toBeGreaterThan(20);
    expect(c.stages.length).toBeGreaterThanOrEqual(2);
    expect(c.signals.length).toBeGreaterThan(0);
    expect(c.checks.length).toBeGreaterThan(0);
    expect(Object.keys(c.roles).length).toBeGreaterThan(0);

    for (const ref of [...c.prerequisites, ...c.related]) expect(ids.has(ref)).toBe(true);

    const stageIds = c.stages.map((s) => s.id);
    for (const [lang, ex] of Object.entries(c.examples)) {
      expect(Object.keys(ex.stages).sort()).toEqual([...stageIds].sort());
      const files = [...Object.values(ex.stages).flat(), ...ex.tests];
      for (const f of files) {
        expect({ lang, file: f, exists: existsSync(join(LIBRARY_DIR, "examples", lang, f)) })
          .toEqual({ lang, file: f, exists: true });
      }
    }
  });
}

test("`plum concepts --json` lists every concept", () => {
  const p = Bun.spawnSync(["bun", join(import.meta.dir, "cli.ts"), "concepts", "--json"]);
  const listed = JSON.parse(p.stdout.toString()) as { id: string }[];
  expect(listed.map((c) => c.id).sort()).toEqual([...ids].sort());
});
