/**
 * Hands-on formations from the formation repos, offered when a concept has a matching module.
 *
 * library/formations.json maps each formation's modules to Plum concept ids. `plum formations fetch` makes a
 * sparse, blobless, depth-1 checkout of one formation in one language, pinned to its ref: the coach skills,
 * CLAUDE.md, and the curriculum without its solutions. The learner then runs `/start` inside that folder.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "fs";
import { join, resolve } from "path";
import { LIBRARY_DIR } from "./library.js";
import { git, isSafeRef, isSafeRelativePath, isSafeRepoUrl, isSafeSegment } from "./library-cache.js";
import { parseFlags } from "./feedback.js";

export interface Formation {
  title: string;
  repoUrl: string;
  ref: string;
  root: string;                        // the curriculum folder, relative to the repo
  languages?: string[];                // one starter per language under project/<lang>/; absent = a single project/
  modules: Record<string, string[]>;   // module id → Plum concept ids
}

export interface FormationMatch { id: string; title: string; module: string; languages?: string[] }

export function loadFormations(): Record<string, Formation> {
  const path = join(LIBRARY_DIR, "formations.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf-8")) : {};
}

export function matchFormations(concept: string, formations = loadFormations()): FormationMatch[] {
  return Object.entries(formations).flatMap(([id, f]) =>
    Object.entries(f.modules).filter(([, concepts]) => concepts.includes(concept))
      .map(([module]) => ({ id, title: f.title, module, languages: f.languages })));
}

// Non-cone sparse patterns: what a learner's copy needs, never solutions/.
// A curriculum lives at curricula/<domain>/<track>/ and may use the domain's shared modules in curricula/<domain>/modules/.
export function sparsePatterns(f: Formation, lang?: string): string[] {
  const root = `/${f.root}`;
  const shared = `${root.slice(0, root.lastIndexOf("/"))}/modules/`;
  return ["/CLAUDE.md", "/.claude/settings.json", "/.claude/skills/", "/learner/.gitkeep",
    `${root}/curriculum.md`, `${root}/modules/`, `${root}/questions/`, `${root}/docs/`, shared,
    lang ? `${root}/project/${lang}/` : `${root}/project/`];
}

export function fetchFormation(id: string, lang: string | undefined, dirArg?: string): string {
  const f = loadFormations()[id];
  if (!f) throw new Error(`Unknown formation "${id}". Run \`plum formations\` to list them.`);
  const langs = f.languages ?? [];
  if (langs.length === 0 && lang) throw new Error(`${id} has a single starter; drop --lang.`);
  const chosen = lang ?? langs[0];
  if (chosen && !langs.includes(chosen)) throw new Error(`${id} has no ${chosen} starter (available: ${langs.join(", ")}).`);
  if (!isSafeSegment(id) || (chosen && !isSafeSegment(chosen)) || !isSafeRelativePath(f.root)) throw new Error(`Invalid entry for ${id} in formations.json.`);
  if (!isSafeRepoUrl(f.repoUrl)) throw new Error(`Refusing to fetch from ${JSON.stringify(f.repoUrl)}.`);
  if (!isSafeRef(f.ref)) throw new Error(`Refusing to fetch ref ${JSON.stringify(f.ref)}.`);

  const dest = resolve(dirArg ?? `formation-${id}`);
  if (existsSync(dest) && readdirSync(dest).length > 0) throw new Error(`${dest} already exists and isn't empty.`);
  mkdirSync(dest, { recursive: true });
  try {
    git(dest, ["init", "-q"]);
    git(dest, ["remote", "add", "origin", "--", f.repoUrl]);
    git(dest, ["fetch", "-q", "--depth", "1", "--filter=blob:none", "--end-of-options", "origin", f.ref]);
    git(dest, ["sparse-checkout", "set", "--no-cone", "--", ...sparsePatterns(f, chosen)]);
    // core.symlinks=false writes any symlink as a plain text file, so nothing can point outside the folder.
    git(dest, ["config", "core.symlinks", "false"]);
    git(dest, ["checkout", "-q", "-b", "learner", "FETCH_HEAD"]);
  } catch (e) {
    rmSync(dest, { recursive: true, force: true });
    throw e;
  }
  return dest;
}

const langList = (langs?: string[]) => langs?.length ? ` (${langs.join(", ")})` : "";

export function runFormationsCommand(argv: string[]): number {
  const [sub = "list", ...rest] = argv;
  const flags = parseFlags(rest);
  const arg = rest.find((a) => !a.startsWith("--") && a !== flags.lang && a !== flags.dir);
  try {
    switch (sub) {
      case "list":
        for (const [id, f] of Object.entries(loadFormations())) {
          console.log(`${id} — ${f.title}${langList(f.languages)}`);
          for (const [m, cs] of Object.entries(f.modules)) console.log(`  ${m.padEnd(26)} ${cs.join(", ")}`);
        }
        return 0;
      case "match": {
        if (!arg) { console.error("Usage: plum formations match <concept>"); return 1; }
        for (const m of matchFormations(arg)) {
          console.log(`${m.id} ${m.module} — ${m.title}${langList(m.languages)}`);
          console.log(`  fetch: plum formations fetch ${m.id}${m.languages?.length ? " --lang <language>" : ""}, then /start in that folder`);
        }
        return 0;
      }
      case "fetch": {
        if (!arg) { console.error("Usage: plum formations fetch <formation> [--lang L] [--dir D]"); return 1; }
        const dest = fetchFormation(arg, flags.lang, flags.dir);
        console.log(dest);
        console.log(`  Open Claude Code in that folder and run /start.`);
        return 0;
      }
      default:
        console.error("Usage: plum formations [list] | match <concept> | fetch <formation> [--lang L] [--dir D]");
        return 1;
    }
  } catch (e) {
    console.error(`[Plum] ${(e as Error).message}`);
    return 1;
  }
}
