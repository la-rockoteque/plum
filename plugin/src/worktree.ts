// Passive independence: edits the user made between Claude's turns are their own work.
// When Claude stops, snapshot the working tree as a git tree object. At the next prompt, diff the tree against a fresh
// snapshot. Lines changed in files Claude didn't touch since the snapshot count as one `independence` event.
import { copyFileSync, existsSync, mkdtempSync, realpathSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { getDb } from "./db.js";

const MIN_LINES = 3;   // below this it's a typo fix, not work
const LOCKFILE_RE = /(^|\/)(bun\.lockb?|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|poetry\.lock|go\.sum|composer\.lock|Gemfile\.lock)$/;
const GIT_TIMEOUT_MS = 5000;
export const TEST_FILE_RE = /(^|\/)(tests?|__tests__|spec)\/|[._-](test|spec)\.[a-z]+$|(^|\/)test_[^/]*\.py$/i;

function git(cwd: string, args: string[], env?: Record<string, string>): string | null {
  if (!existsSync(cwd)) return null;
  try {
    const p = Bun.spawnSync(["git", ...args], {
      cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "ignore", timeout: GIT_TIMEOUT_MS
    });
    return p.exitCode === 0 ? p.stdout.toString().trim() : null;
  } catch {
    return null;   // no git binary
  }
}

// Tree of the working tree, untracked files included (.gitignore respected), without touching the real index.
// Seeding the temp index from the real one keeps `add -A` to a stat check on big repos.
export function snapshotTree(cwd: string): { head: string; tree: string } | null {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  const head = top && (git(top, ["rev-parse", "HEAD"]) ?? "none");
  const realIndex = top && git(top, ["rev-parse", "--git-path", "index"]);
  if (!top || !head || !realIndex) return null;
  const dir = mkdtempSync(join(tmpdir(), "plum-index-"));
  try {
    const index = join(dir, "index");
    const indexPath = resolve(top, realIndex);
    if (existsSync(indexPath)) copyFileSync(indexPath, index);
    const env = { GIT_INDEX_FILE: index };
    if (git(top, ["add", "-A"], env) === null) return null;
    const tree = git(top, ["write-tree"], env);
    return tree ? { head, tree } : null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export interface OwnEdits { files: string[]; added: number; removed: number }

// Lines changed between two trees, minus lockfiles, binaries and the files Claude edited.
// With `typed` (files an editor extension saw the user type in), only those count: a formatter or a second session
// writes files without the user typing.
export function ownEdits(cwd: string, from: string, to: string, claudeFiles: Set<string>, typed?: Set<string>): OwnEdits {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  // -z: paths arrive raw (no C-quoting), and may themselves contain tabs
  const out = top && git(top, ["diff", "--numstat", "-z", "--no-renames", from, to]);
  const edits: OwnEdits = { files: [], added: 0, removed: 0 };
  if (!top || !out) return edits;
  for (const record of out.split("\0")) {
    const [a, r, ...rest] = record.split("\t");
    const path = rest.join("\t");
    if (!path || a === "-" || LOCKFILE_RE.test(path)) continue;
    const abs = resolve(top, path);
    if (claudeFiles.has(abs) || (typed && !typed.has(abs))) continue;
    edits.files.push(path);
    edits.added += Number(a);
    edits.removed += Number(r);
  }
  return edits;
}

// git reports real paths (/private/var on macOS), Claude's tool input may not
const real = (p: string) => existsSync(p) ? realpathSync(p) : p;

export const domainOf = (files: string[]) => files.some((f) => TEST_FILE_RE.test(f)) ? "testing" : "implementation";

function store(sessionId: string, now: number, snap: { head: string; tree: string }): void {
  getDb().run(`INSERT OR REPLACE INTO worktree_snapshots (session_id, ts, head, tree) VALUES (?, ?, ?, ?)`,
    [sessionId, now, snap.head, snap.tree]);
}

export function saveSnapshot(sessionId: string, cwd: string, now = Date.now()): void {
  const snap = snapshotTree(cwd);
  if (snap) store(sessionId, now, snap);
}

// Called on each prompt: log what the user changed since Claude's last turn, then re-baseline.
// ponytail: skips the gap when HEAD moved (a pull or checkout would look like user work), so edits the user committed
// themselves between turns are missed; upgrade by diffing only the new commits whose author is `git config user.email`.
// Claude's own Bash edits are in the Stop snapshot already; they only leak in when Stop didn't run (see below).
// Without the IDE extension, an editor auto-formatter or a second Claude session in the same repo counts as the user.
// ponytail: with it, edits typed in another editor while VS Code is open are missed; upgrade with an IDE heartbeat.
export function detectOwnEdits(sessionId: string, cwd: string, now = Date.now()): OwnEdits | null {
  const db = getDb();
  const prev = db.query(`SELECT ts, head, tree FROM worktree_snapshots WHERE session_id = ?`)
    .get(sessionId) as { ts: number; head: string; tree: string } | null;
  const snap = snapshotTree(cwd);
  if (!snap) return null;
  store(sessionId, now, snap);
  if (!prev || prev.head !== snap.head || prev.tree === snap.tree) return null;

  // Tool calls after the snapshot mean Stop didn't run (an interrupted turn). Edit/Write files are excluded by path;
  // a Bash call could have changed anything, so the gap is skipped.
  const tools = db.query(
    `SELECT tool_name AS t, json_extract(metadata, '$.file_path') AS f FROM events
     WHERE session_id = ? AND event_type = 'post_tool' AND ts >= ?`
  ).all(sessionId, prev.ts) as { t: string; f: string | null }[];
  if (tools.some((r) => r.t === "Bash")) return null;
  const claudeFiles = new Set(tools.flatMap((r) => r.f ? [real(resolve(cwd, r.f))] : []));
  const typedRows = db.query(
    `SELECT DISTINCT json_extract(metadata, '$.file_path') AS f FROM events WHERE session_id = ? AND event_type = 'ide_edit' AND ts >= ?`
  ).all(sessionId, prev.ts) as { f: string }[];
  const typed = typedRows.length ? new Set(typedRows.map((r) => real(resolve(r.f)))) : undefined;

  const edits = ownEdits(cwd, prev.tree, snap.tree, claudeFiles, typed);
  if (edits.added + edits.removed < MIN_LINES) return null;
  db.run(
    `INSERT INTO events (session_id, ts, event_type, category, delegated, verified, metadata) VALUES (?, ?, 'independence', ?, 0, 1, ?)`,
    [sessionId, now, domainOf(edits.files), JSON.stringify({ source: "git", files: edits.files.length, added: edits.added, removed: edits.removed })]
  );
  return edits;
}
