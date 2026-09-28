import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { PLUGIN_ROOT } from "./env.js";

export const LIBRARY_DIR = join(PLUGIN_ROOT, "library");
// Example code lives outside the installed plugin, at the repository root (streamed on demand when installed).
export const EXAMPLES_DIR = join(PLUGIN_ROOT, "..", "library", "examples");

export const CATEGORIES = ["principles", "testing", "architecture", "backend", "frontend", "infra", "refactoring", "security"] as const;
export const DOMAINS    = ["implementation", "debugging", "testing", "architecture", "synthesis"] as const;
export const LEVELS     = ["foundation", "intermediate", "advanced"] as const;
export const BACKEND_LANGUAGES = ["python", "typescript", "go", "dotnet", "kotlin"] as const;
export const LANGUAGES  = [...BACKEND_LANGUAGES, "react", "infra"] as const;

// One concept = concept.json (machine index) + CONCEPT.md (agnostic narrative).
// Example code lives in shared, runnable per-language projects under library/examples/<lang>/.
export interface Concept {
  id: string;
  title: string;
  category: (typeof CATEGORIES)[number];
  domain: (typeof DOMAINS)[number];    // the Plum skill domain this concept strengthens
  level: (typeof LEVELS)[number];
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
  const width = Math.max(0, ...concepts.map((c) => c.id.length)) + 2;
  return concepts
    .map((c) => `${c.id.padEnd(width)} ${c.category.padEnd(13)} ${c.level.padEnd(12)} ${c.summary}`)
    .join("\n");
}

export function conceptsForDomain(domain: string): Concept[] {
  return loadConcepts().filter((c) => c.domain === domain);
}
