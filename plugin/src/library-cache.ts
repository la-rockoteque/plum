/**
 * Example code is streamed on demand instead of being installed with the plugin.
 *
 * The installed plugin ships concept manifests and narratives. When /plum:teach needs a concept's code in one
 * language, `plum library fetch` pulls exactly those files — a blobless, depth-1, sparse git fetch pinned to the
 * installed commit — into ~/.plum/library-cache/<concept>/<lang>/. A garbage collector keeps the cache small:
 * it drops entries from other plugin versions, entries unused for `cacheTtlDays`, and the least recently used ones
 * above `cacheMaxMb`. Concepts fetched `keepAfterUses` times, or kept by hand, survive the age and size limits
 * (a plugin update still refreshes them).
 *
 * Manifests are repo content, so every id, language and path from them is validated before it touches the
 * filesystem or a git command line, and fetched files must be regular files inside the checkout.
 * Running from a repo checkout reads library/examples directly and fetches nothing.
 */
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, isAbsolute, join, relative } from "path";
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

// ─── validation (pure) ───────────────────────────────────────────────────────

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
export const isSafeSegment = (s: string) => SEGMENT.test(s) && s !== "." && s !== "..";
export const isSafeRelativePath = (p: string) =>
  p.length > 0 && !isAbsolute(p) && !p.includes("\\") && p.split("/").every((seg) => isSafeSegment(seg));
export const isSafeRef = (r: string) =>
  /^[0-9a-f]{40}$/.test(r) || /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,99}$/.test(r) && !r.includes("..");
// https, ssh or scp-style git@ remotes; an absolute local path for local marketplaces and tests.
export const isSafeRepoUrl = (u: string) =>
  (/^(https:\/\/|ssh:\/\/|git@)[^\s]+$/.test(u) || /^\/[^\s]+$/.test(u)) && !u.startsWith("-") && !u.includes("::");

function inside(base: string, p: string): boolean {
  const r = relative(base, p);
  return r !== "" && !r.startsWith("..") && !isAbsolute(r);
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
  try {
    const raw = JSON.parse(readFileSync(INDEX_PATH, "utf-8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch { return {}; }
}
function writeIndex(index: Index): void {
  mkdirSync(CACHE_DIR, { recursive: true });
  const tmp = `${INDEX_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(index, null, 2));
  renameSync(tmp, INDEX_PATH);                          // atomic replace; concurrent writers can't leave half a file
}
function entryDir(key: string): string {
  const [id = "", lang = ""] = key.split("/");
  if (!isSafeSegment(id) || !isSafeSegment(lang)) throw new Error(`Invalid cache key: ${key}`);
  const dir = join(CACHE_DIR, id, lang);
  if (!inside(CACHE_DIR, dir)) throw new Error(`Invalid cache key: ${key}`);
  return dir;
}

function collect(index: Index, sha: string | undefined, now: number): Index {
  const { library } = getConfig();
  const evict = planEviction(Object.values(index), {
    maxBytes: library.cacheMaxMb * 1_000_000, ttlDays: library.cacheTtlDays,
    keepAfterUses: library.keepAfterUses, now, sha
  });
  const next = { ...index };
  for (const key of evict) {
    try { rmSync(entryDir(key), { recursive: true, force: true }); } catch { /* invalid key: nothing on disk to remove */ }
    next[key] = { ...next[key], cached: false, bytes: 0 };
  }
  // Folders the index doesn't know about (a crash, a lost write) are removed too, so nothing leaks.
  if (existsSync(CACHE_DIR)) {
    for (const id of readdirSync(CACHE_DIR)) {
      if (id.startsWith(".")) continue;                  // in-flight staging folders and the index temp file
      const idDir = join(CACHE_DIR, id);
      if (!lstatSync(idDir).isDirectory()) continue;
      for (const lang of readdirSync(idDir)) {
        const key = `${id}/${lang}`;
        if (next[key]?.cached !== true) rmSync(join(idDir, lang), { recursive: true, force: true });
      }
    }
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
  const sha = install?.sha ?? library.ref;
  if (!isSafeRepoUrl(url)) throw new Error(`Refusing to fetch from ${JSON.stringify(url)}: not an https, ssh or git@ URL.`);
  if (!isSafeRef(sha)) throw new Error(`Refusing to fetch ref ${JSON.stringify(sha)}.`);
  return { url, sha };
}

export function git(cwd: string, args: string[]): string {
  const p = Bun.spawnSync(["git", ...args], {
    cwd, timeout: FETCH_TIMEOUT_MS,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND ?? "ssh -o BatchMode=yes -o ConnectTimeout=10" }
  });
  if (p.exitCode !== 0) throw new Error(`git ${args[0]} failed: ${p.stderr.toString().trim().split("\n").pop()}`);
  return p.stdout.toString();
}

// Blobless, depth-1 fetch of one commit, then a sparse checkout of just the requested files.
function streamFiles(url: string, sha: string, lang: string, files: string[], dest: string): number {
  const tmp = mkdtempSync(join(tmpdir(), "plum-fetch-"));
  try {
    git(tmp, ["init", "-q"]);
    git(tmp, ["remote", "add", "origin", "--", url]);
    git(tmp, ["fetch", "-q", "--depth", "1", "--filter=blob:none", "--end-of-options", "origin", sha]);
    git(tmp, ["sparse-checkout", "set", "--no-cone", "--", ...files.map((f) => `/library/examples/${lang}/${f}`)]);
    git(tmp, ["-c", "core.symlinks=false", "checkout", "-q", "FETCH_HEAD"]);
    // Only regular blobs (mode 100644/100755); symlinks (120000) and submodules (160000) are refused.
    const modes = new Map(git(tmp, ["ls-files", "--stage", "-z"]).split("\0").filter(Boolean)
      .map((line) => { const [meta, path] = line.split("\t"); return [path, meta.split(" ")[0]] as const; }));
    const base = realpathSync(join(tmp, "library", "examples", lang));
    mkdirSync(CACHE_DIR, { recursive: true });
    const staging = mkdtempSync(join(CACHE_DIR, ".stage-"));    // same filesystem as dest, so rename is atomic
    let bytes = 0;
    try {
      for (const f of files) {
        const from = join(base, f);
        if (!existsSync(from)) throw new Error(`${f} is missing at ${sha.slice(0, 7)}`);
        const mode = modes.get(`library/examples/${lang}/${f}`);
        if (mode !== "100644" && mode !== "100755") throw new Error(`${f} is not a regular file (git mode ${mode}); refusing to copy it.`);
        const st = lstatSync(from);
        if (!st.isFile() || st.isSymbolicLink() || !inside(base, realpathSync(from))) {
          throw new Error(`${f} is not a regular file inside the example project; refusing to copy it.`);
        }
        mkdirSync(dirname(join(staging, f)), { recursive: true });
        cpSync(from, join(staging, f));
        bytes += st.size;
      }
      // Move into place in one step, so a concurrent fetch never sees half a folder.
      rmSync(dest, { recursive: true, force: true });
      mkdirSync(dirname(dest), { recursive: true });
      renameSync(staging, dest);
    } finally {
      rmSync(staging, { recursive: true, force: true });
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
  if (!isSafeSegment(concept.id) || !isSafeSegment(chosen) || !files.every((f) => typeof f === "string" && isSafeRelativePath(f))) {
    throw new Error(`Invalid manifest for ${id}: ids, languages and file paths must be plain relative paths.`);
  }

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
  if (!fresh) bytes = streamFiles(src.url, src.sha, chosen, files, dir);
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
        const concept = loadConcepts().find((c) => c.id === id);
        if (!concept || !isSafeSegment(id)) { console.error(`[Plum] Unknown concept "${id}".`); return 1; }
        const langs = flags.lang ? [flags.lang] : Object.keys(concept.examples).filter(isSafeSegment);
        const index = readIndex();
        const pinned = sub === "keep";
        const next = { ...index };
        for (const l of langs) {
          const key = `${id}/${l}`;
          next[key] = { ...(index[key] ?? { key, sha: "", bytes: 0, lastUsed: Date.now(), uses: 0, cached: false }), pinned };
        }
        writeIndex(next);
        console.log(`[Plum] ${pinned ? "Keeping" : "No longer pinning"} ${id} (${langs.join(", ")}).`);
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
