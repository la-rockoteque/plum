import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { PLUM_REPO_DIR } from "./env.js";

export const LIBRARY_DIR = join(PLUM_REPO_DIR, "library");

// One concept = concept.json (machine index) + CONCEPT.md (agnostic narrative).
// Example code lives in shared, runnable per-language projects under library/examples/<lang>/.
export interface Concept {
  id: string;
  title: string;
  category: string;
  level: "foundation" | "intermediate" | "advanced";
  summary: string;
  prerequisites: string[];
  related: string[];
  signals: string[];                 // what in a consumer repo suggests this concept is relevant
  roles: Record<string, string>;     // canonical example name → domain-agnostic role
  stages: { id: string; title: string; idea: string }[];
  checks: string[];                  // recall / explain-back questions
  examples: Record<string, {
    stages: Record<string, string[]>; // stage id → files, relative to library/examples/<lang>/
    tests: string[];
    run: string;
  }>;
}

export function loadConcepts(): Concept[] {
  const dir = join(LIBRARY_DIR, "concepts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "concept.json")))
    .map((d) => JSON.parse(readFileSync(join(dir, d.name, "concept.json"), "utf-8")) as Concept)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function formatConceptList(concepts: Concept[]): string {
  return concepts
    .map((c) => `${c.id.padEnd(22)} ${c.category.padEnd(13)} ${c.level.padEnd(12)} ${c.summary}`)
    .join("\n");
}
