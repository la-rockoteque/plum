import { Database } from "bun:sqlite";
import { mkdirSync, existsSync } from "fs";
import { PLUM_DATA_DIR, DB_PATH } from "./env.js";

let _db: Database | null = null;

export function getDb(): Database {
  if (_db) return _db;

  if (!existsSync(PLUM_DATA_DIR)) mkdirSync(PLUM_DATA_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.run("PRAGMA journal_mode = WAL");
  _db.run("PRAGMA synchronous = NORMAL");
  _db.run("PRAGMA busy_timeout = 5000");

  migrate(_db);
  return _db;
}

function migrate(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT    PRIMARY KEY,
      started_at  INTEGER NOT NULL,
      ended_at    INTEGER,
      project_path TEXT,
      event_count INTEGER DEFAULT 0
    )
  `);

  // event_type: user_prompt | pre_tool | post_tool | predict | session_end
  // category:   implementation | debugging | testing | architecture | synthesis | search
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  TEXT    NOT NULL,
      ts          INTEGER NOT NULL,
      event_type  TEXT    NOT NULL,
      tool_name   TEXT,
      category    TEXT,
      output_size INTEGER DEFAULT 0,
      delegated   INTEGER DEFAULT 1,
      verified    INTEGER DEFAULT 0,
      metadata    TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_scores (
      domain             TEXT    PRIMARY KEY,
      score              REAL    DEFAULT 50.0,
      delegation_count   INTEGER DEFAULT 0,
      verification_count INTEGER DEFAULT 0,
      prediction_count   INTEGER DEFAULT 0,
      recurrence_count   INTEGER DEFAULT 0,
      updated_at         INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS interventions (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      ts                INTEGER NOT NULL,
      session_id        TEXT,
      pattern           TEXT    NOT NULL,
      intervention_type TEXT    NOT NULL,
      domain            TEXT,
      message           TEXT,
      dismissed         INTEGER DEFAULT 0
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_events_session  ON events(session_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_ts       ON events(ts)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_category ON events(category)`);

  const now = Date.now();
  for (const domain of ["implementation", "debugging", "testing", "architecture", "synthesis"]) {
    db.run(
      `INSERT OR IGNORE INTO skill_scores (domain, score, updated_at) VALUES (?, 50.0, ?)`,
      [domain, now]
    );
  }
}
