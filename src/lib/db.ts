/**
 * Dual-driver data layer.
 *  - Local dev: Node 22's built-in SQLite (zero install, file ./dev.db)
 *  - Vercel:    Postgres (set POSTGRES_URL from the Vercel Postgres/Neon integration)
 * Same SQL is used for both; placeholders are translated automatically.
 */
import fs from "fs";
import path from "path";

const usePg = !!process.env.POSTGRES_URL;

let sqlite: any = null;
function getSqlite() {
  if (sqlite) return sqlite;
  const { DatabaseSync } = require("node:sqlite");
  const file = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
  const abs = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  sqlite = new DatabaseSync(abs);
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  return sqlite;
}

let pgPool: any = null;
async function getPg() {
  if (pgPool) return pgPool;
  const { Pool } = require("pg");
  pgPool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  return pgPool;
}

/** `?` placeholders → `$1,$2…` for Postgres */
function toPg(sql: string) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (usePg) {
    const pool = await getPg();
    const res = await pool.query(toPg(sql), params);
    return res.rows as T[];
  }
  const db = getSqlite();
  const trimmed = sql.trim().toUpperCase();
  if (trimmed.startsWith("SELECT") || trimmed.includes("RETURNING")) {
    // node:sqlite returns null-prototype objects; React can't serialise those.
    const rows = db.prepare(sql).all(...params) as any[];
    return rows.map((r) => ({ ...r })) as T[];
  }
  db.prepare(sql).run(...params);
  return [];
}

export async function one<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length ? rows[0] : null;
}

export async function exec(sql: string) {
  if (usePg) {
    const pool = await getPg();
    await pool.query(sql);
    return;
  }
  getSqlite().exec(sql);
}

/** Types differ slightly between engines; keep DDL portable. */
const AUTO_ID = () => (usePg ? "TEXT PRIMARY KEY" : "TEXT PRIMARY KEY");
const BOOL = () => (usePg ? "BOOLEAN" : "INTEGER");
const TS = () => (usePg ? "TIMESTAMPTZ DEFAULT NOW()" : "TEXT DEFAULT CURRENT_TIMESTAMP");

export async function migrate() {
  await exec(`CREATE TABLE IF NOT EXISTS users (
    id ${AUTO_ID()},
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    created_at ${TS()}
  )`);

  await exec(`CREATE TABLE IF NOT EXISTS players (
    id ${AUTO_ID()},
    name TEXT UNIQUE NOT NULL,
    aliases TEXT DEFAULT '',
    phone TEXT,
    photo_url TEXT,
    primary_pos TEXT DEFAULT 'D',
    secondary TEXT,
    ball_control REAL DEFAULT 5,
    influence REAL DEFAULT 5,
    discipline REAL DEFAULT 5,
    skill REAL DEFAULT 5,
    active ${BOOL()} DEFAULT 1,
    note TEXT
  )`);

  await exec(`CREATE TABLE IF NOT EXISTS games (
    id ${AUTO_ID()},
    date TEXT NOT NULL,
    label TEXT,
    home TEXT NOT NULL,
    away TEXT NOT NULL,
    captains TEXT NOT NULL,
    swing TEXT,
    score_home INTEGER,
    score_away INTEGER,
    result TEXT,
    motm TEXT,
    created_at ${TS()}
  )`);

  await exec(`CREATE TABLE IF NOT EXISTS proposals (
    id ${AUTO_ID()},
    player_id TEXT NOT NULL,
    field TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    note TEXT,
    status TEXT DEFAULT 'pending',
    proposed_by TEXT,
    decided_by TEXT,
    created_at ${TS()},
    decided_at TEXT
  )`);

  await exec(`CREATE TABLE IF NOT EXISTS rating_history (
    id ${AUTO_ID()},
    player_id TEXT NOT NULL,
    ts ${TS()},
    skill REAL,
    ball_control REAL,
    influence REAL,
    discipline REAL,
    source TEXT
  )`);
}

/** Additive schema for newer features; safe on both engines. */
export async function migrateExtras() {
  await exec(`CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    caption TEXT,
    game_date TEXT,
    uploaded_by TEXT,
    created_at ${TS()}
  )`);
  await exec(`CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    week_label TEXT,
    content TEXT NOT NULL,
    games_covered INTEGER,
    created_by TEXT,
    created_at ${TS()}
  )`);
  for (const ddl of [
    `ALTER TABLE games ADD COLUMN sheet_url TEXT`,
    `ALTER TABLE games ADD COLUMN drift_delta REAL`,
    `ALTER TABLE games ADD COLUMN approval_status TEXT`,
    `ALTER TABLE games ADD COLUMN submitted_by TEXT`,
    `ALTER TABLE games ADD COLUMN pending_result TEXT`,
    `ALTER TABLE rating_history ADD COLUMN game_id TEXT`,
  ]) { try { await exec(ddl); } catch {} }
}

export function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}
