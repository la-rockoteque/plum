/**
 * Example code is streamed on demand instead of being installed with the plugin.
 *
 * The installed plugin ships concept manifests and narratives. When /plum:teach needs a concept's code in one
 * language, `plum library fetch` pulls exactly those files — a blobless, depth-1, sparse git fetch pinned to the
 * installed commit — into ~/.plum/library-cache/<concept>/<lang>/. A garbage collector keeps the cache small:
 * it drops entries from other plugin versions, entries unused for `cacheTtlDays`, and the least recently used ones
 * above `cacheMaxMb`. Concepts fetched `keepAfterUses` times, or kept by hand, are never collected.
 * Running from a repo checkout reads library/examples directly and fetches nothing.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { getConfig } from "./config.js";
import { PLUM_DATA_DIR, PLUGIN_ROOT } from "./env.js";
import { loadConcepts } from "./library.js";
import { currentInstall } from "./update.js";
import { parseFlags } from "./feedback.js";

const CACHE_DIR  = join(PLUM_DATA_DIR, "library-cache");
const INDEX_PATH = join(CACHE_DIR, "index.json");
const DAY_MS     = 86_400_000;
const FETCH_TIMEOUT_MS = 60_000;

export interface CacheEntry {
  key: string;        // "<concept>/<lang>"
  sha: string;        // commit the files came from
  bytes: number;
  lastUsed: number;
  uses: number;
  pinned: boolean;
  cached?: boolean;   // false once evicted; the counters survive so a favourite stays a favourite
}

// ─── eviction policy (pure) ──────────────────────────────────────────────────

export function planEviction(entries: CacheEntry[], o: {
  maxBytes: number; ttlDays: number; keepAfterUses: number; now: number; sha?: string;
}): string[] {
  const live = entries.filter((e) => e.cached !== false);
  const kept = (e: CacheEntry) => e.pinned || e.uses >= o.keepAfterUses;
  const evict = new Set<string>();

  for (const e of live) {
    if (o.sha && e.sha !== o.sha) evict.add(e.key);                                  // another plugin version
    else if (!kept(e) && e.lastUsed < o.now - o.ttlDays * DAY_MS) evict.add(e.key); // unused too long
  }
  let total = live.filter((e) => !evict.has(e.key)).reduce((n, e) => n + e.bytes, 0);
  for (const e of live.filter((x) => !evict.has(x.key) && !kept(x)).sort((a, b) => a.lastUsed - b.lastUsed)) {
    if (total <= o.maxBytes) break;
    evict.add(e.key);
    total -= e.bytes;
  }
  return live.map((e) => e.key).filter((k) => evict.has(k));
}

// ─── index ───────────────────────────────────────────────────────────────────

type Index = Record<string, CacheEntry>;

function readIndex(): Index {
  try { return JSON.parse(readFileSync(INDEX_PATH, "utf-8")); } catch { return {}; }
}
function writeIndex(index: Index): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}
const entryDir = (key: string) => join(CACHE_DIR, ...key.split("/"));

function collect(index: Index, sha: string | undefined, now: number): Index {
  const { library } = getConfig();
  const evict = planEviction(Object.values(index), {
    maxBytes: library.cacheMaxMb * 1_000_000, ttlDays: library.cacheTtlDays,
    keepAfterUses: library.keepAfterUses, now, sha
  });
  const next = { ...index };
  for (const key of evict) {
    rmSync(entryDir(key), { recursive: true, force: true });
    next[key] = { ...next[key], cached: false, bytes: 0 };
  }
  return next;
}

// ─── where the code comes from ───────────────────────────────────────────────

// A repo checkout has library/examples next to (or one level above) the plugin root.
function localExamplesDir(): string | null {
  for (const dir of [join(PLUGIN_ROOT, "library", "examples"), join(PLUGIN_ROOT, "..", "library", "examples")]) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function source(): { url: string; sha: string } | null {
  const { library } = getConfig();
  const install = currentInstall();
  const url = library.repoUrl ?? install?.url ?? null;
  if (!url) return null;
  return { url, sha: install?.sha ?? library.ref };
}

function git(cwd: string, args: string[]): void {
  const p = Bun.spawnSync(["git", ...args], {
    cwd, timeout: FETCH_TIMEOUT_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes -o ConnectTimeout=10" }
  });
  if (p.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${p.stderr.toString().trim().split("\n").pop()}`);
}

// Blobless, depth-1 fetch of one commit, then a sparse checkout of just the requested files.
function streamFiles(url: string, sha: string, lang: string, files: string[], dest: string): number {
  const tmp = mkdtempSync(join(tmpdir(), "plum-fetch-"));
  try {
    git(tmp, ["init", "-q"]);
    git(tmp, ["remote", "add", "origin", url]);
    git(tmp, ["fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", sha]);
    git(tmp, ["sparse-checkout", "set", "--no-cone", ...files.map((f) => `/library/examples/${lang}/${f}`)]);
    git(tmp, ["checkout", "-q", "FETCH_HEAD"]);
    let bytes = 0;
    for (const f of files) {
      const from = join(tmp, "library", "examples", lang, f);
      if (!existsSync(from)) throw new Error(`${f} is missing at ${sha.slice(0, 7)}`);
      mkdirSync(dirname(join(dest, f)), { recursive: true });
      cpSync(from, join(dest, f));
      bytes += statSync(from).size;
    }
    return bytes;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ─── `plum library …` ────────────────────────────────────────────────────────

export function fetchConcept(id: string, lang: string | undefined): { dir: string; files: string[] } {
  const concept = loadConcepts().find((c) => c.id === id);
  if (!concept) throw new Error(`Unknown concept "${id}". Run \`plum concepts\` to list them.`);
  const langs = Object.keys(concept.examples);
  const chosen = lang ?? langs[0];
  const example = concept.examples[chosen];
  if (!example) throw new Error(`Concept ${id} has no ${chosen} example (available: ${langs.join(", ")}).`);
  const files = [...new Set([...Object.values(example.stages).flat(), ...example.tests])];

  const local = localExamplesDir();
  if (local) return { dir: join(local, chosen), files };

  const src = source();
  if (!src) throw new Error("Can't locate Plum's repository to stream examples from; set library.repoUrl in config.");

  const key = `${id}/${chosen}`;
  const now = Date.now();
  let index = collect(readIndex(), src.sha, now);
  const prior = index[key];
  const dir = entryDir(key);
  const fresh = prior?.cached !== false && prior?.sha === src.sha && files.every((f) => existsSync(join(dir, f)));

  let bytes = prior?.bytes ?? 0;
  if (!fresh) {
    rmSync(dir, { recursive: true, force: true });
    bytes = streamFiles(src.url, src.sha, chosen, files, dir);
  }
  index = { ...index, [key]: {
    key, sha: src.sha, bytes, lastUsed: now, uses: (prior?.uses ?? 0) + 1, pinned: prior?.pinned ?? false, cached: true
  } };
  writeIndex(index);
  return { dir, files };
}

export function runLibraryCommand(argv: string[]): number {
  const [sub = "status", ...rest] = argv;
  const flags = parseFlags(rest);
  const id = rest.find((a) => !a.startsWith("--") && a !== flags.lang);
  try {
    switch (sub) {
      case "fetch": {
        if (!id) { console.error("Usage: plum library fetch <concept> [--lang <language>]"); return 1; }
        const { dir, files } = fetchConcept(id, flags.lang);
        console.log(dir);
        for (const f of files) console.log(`  ${f}`);
        return 0;
      }
      case "status": return printStatus();
      case "gc": {
        const before = readIndex();
        const after = collect(before, source()?.sha, Date.now());
        writeIndex(after);
        const n = Object.keys(after).filter((k) => before[k]?.cached !== false && after[k].cached === false).length;
        console.log(`[Plum] Removed ${n} cached example set${n === 1 ? "" : "s"}.`);
        return 0;
      }
      case "keep":
      case "unkeep": {
        if (!id) { console.error(`Usage: plum library ${sub} <concept> [--lang <language>]`); return 1; }
        const index = readIndex();
        const keys = Object.keys(index).filter((k) => k.startsWith(`${id}/`) && (!flags.lang || k === `${id}/${flags.lang}`));
        if (keys.length === 0) { console.error(`[Plum] ${id} isn't in the cache yet; fetch it first.`); return 1; }
        writeIndex(Object.fromEntries(Object.entries(index).map(([k, e]) => [k, keys.includes(k) ? { ...e, pinned: sub === "keep" } : e])));
        console.log(`[Plum] ${sub === "keep" ? "Keeping" : "No longer pinning"} ${keys.join(", ")}.`);
        return 0;
      }
      case "clear":
        rmSync(CACHE_DIR, { recursive: true, force: true });
        console.log("[Plum] Library cache cleared.");
        return 0;
      default:
        console.error("Usage: plum library fetch <concept> [--lang L] | status | gc | keep <concept> | unkeep <concept> | clear");
        return 1;
    }
  } catch (e) {
    console.error(`[Plum] ${(e as Error).message}`);
    return 1;
  }
}

function printStatus(): number {
  const { library } = getConfig();
  const local = localExamplesDir();
  if (local) console.log(`Examples are read from the checkout: ${local}`);
  const entries = Object.values(readIndex()).sort((a, b) => b.lastUsed - a.lastUsed);
  if (entries.length === 0) { console.log("Library cache is empty."); return 0; }
  const total = entries.reduce((n, e) => n + (e.cached === false ? 0 : e.bytes), 0);
  console.log(`Library cache: ${CACHE_DIR} — ${(total / 1000).toFixed(1)} KB of ${library.cacheMaxMb} MB`);
  for (const e of entries) {
    const state = e.cached === false ? "evicted" : e.pinned || e.uses >= library.keepAfterUses ? "kept" : "cached";
    console.log(`  ${e.key.padEnd(40)} ${(e.bytes / 1000).toFixed(1).padStart(7)} KB  uses ${e.uses}  ` +
                `last used ${new Date(e.lastUsed).toISOString().slice(0, 10)}  ${state}`);
  }
  return 0;
}
