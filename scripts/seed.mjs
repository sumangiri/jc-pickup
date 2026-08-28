/**
 * Seeds the database from the pickup-soccer skill data.
 * Works against SQLite (local) or Postgres (Vercel/Neon).
 *
 *   local:      node scripts/seed.mjs
 *   production: POSTGRES_URL="postgres://…" node scripts/seed.mjs
 */
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";

const root = process.cwd();
const usePg = !!process.env.POSTGRES_URL;

const roster = JSON.parse(fs.readFileSync(path.join(root, "data/roster.json"), "utf8"));
const games = JSON.parse(fs.readFileSync(path.join(root, "data/games.json"), "utf8"));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ---------- driver ----------
let run, all, close;
if (usePg) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });
  const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
  run = async (sql, p = []) => { await pool.query(toPg(sql), p); };
  all = async (sql, p = []) => (await pool.query(toPg(sql), p)).rows;
  close = async () => pool.end();
  console.log("→ seeding Postgres");
} else {
  const { DatabaseSync } = await import("node:sqlite");
  const file = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
  const db = new DatabaseSync(path.join(root, file));
  db.exec("PRAGMA busy_timeout = 5000;");
  run = async (sql, p = []) => { db.prepare(sql).run(...p); };
  all = async (sql, p = []) => db.prepare(sql).all(...p).map((r) => ({ ...r }));
  close = async () => {};
  console.log(`→ seeding SQLite (${file})`);
}

// ---------- schema ----------
const BOOL = usePg ? "BOOLEAN" : "INTEGER";
const TRUE = usePg ? "TRUE" : "1";
const TS = usePg ? "TIMESTAMPTZ DEFAULT NOW()" : "TEXT DEFAULT CURRENT_TIMESTAMP";
const DDL = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', created_at ${TS})`,
  `CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL,
    aliases TEXT DEFAULT '', phone TEXT, photo_url TEXT, primary_pos TEXT DEFAULT 'D',
    secondary TEXT, ball_control REAL DEFAULT 5, influence REAL DEFAULT 5,
    discipline REAL DEFAULT 5, skill REAL DEFAULT 5, active ${BOOL} DEFAULT ${TRUE}, note TEXT)`,
  `CREATE TABLE IF NOT EXISTS games (id TEXT PRIMARY KEY, date TEXT NOT NULL, label TEXT,
    home TEXT NOT NULL, away TEXT NOT NULL, captains TEXT NOT NULL, swing TEXT,
    score_home INTEGER, score_away INTEGER, result TEXT, motm TEXT, created_at ${TS})`,
  `CREATE TABLE IF NOT EXISTS proposals (id TEXT PRIMARY KEY, player_id TEXT NOT NULL,
    field TEXT NOT NULL, old_value TEXT, new_value TEXT, note TEXT,
    status TEXT DEFAULT 'pending', proposed_by TEXT, decided_by TEXT,
    created_at ${TS}, decided_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS rating_history (id TEXT PRIMARY KEY, player_id TEXT NOT NULL,
    ts ${TS}, skill REAL, ball_control REAL, influence REAL, discipline REAL, source TEXT)`,
];
for (const d of DDL) await run(d);

// ---------- dimension derivation ----------
// skill = 0.40*ballControl + 0.35*influence + 0.25*discipline, solved so the
// weighted sum reproduces each player's EXISTING skill. Position sets the lean.
const W = { bc: 0.4, inf: 0.35, dis: 0.25 };
const hash = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
};
function deriveDims(p) {
  const s = p.skill;
  const lean = { A: [0.9, 0.1, -1.0], M: [0.0, 0.9, -0.4], D: [-0.9, -0.2, 1.0] }[p.primary] || [0, 0, 0];
  let bc = s + lean[0] + (hash(p.name) - 0.5) * 1.6;
  let inf = s + lean[1] + (hash(p.name + "x") - 0.5) * 1.6;
  let dis = s + lean[2] + (hash(p.name + "yz") - 0.5) * 1.6;
  const err = s - (W.bc * bc + W.inf * inf + W.dis * dis);
  bc += err; inf += err; dis += err;
  const clamp = (v) => Math.max(1, Math.min(10, +v.toFixed(2)));
  bc = clamp(bc); inf = clamp(inf); dis = clamp(dis);
  const resid = s - (W.bc * bc + W.inf * inf + W.dis * dis);
  if (Math.abs(resid) > 0.005) inf = clamp(inf + resid / W.inf);
  return { bc, inf, dis };
}

// ---------- players ----------
let nP = 0, maxErr = 0;
for (const p of roster.players) {
  const exists = await all("SELECT id FROM players WHERE name = ?", [p.name]);
  const { bc, inf, dis } = deriveDims(p);
  maxErr = Math.max(maxErr, Math.abs(W.bc * bc + W.inf * inf + W.dis * dis - p.skill));
  const phone = (p.aliases || []).find((a) => /^[\d-]{7,}$/.test(a)) || null;
  if (exists.length) {
    await run(`UPDATE players SET aliases=?, phone=?, primary_pos=?, secondary=?,
      ball_control=?, influence=?, discipline=?, skill=? WHERE name=?`,
      [(p.aliases || []).join(","), phone, p.primary, p.secondary || null,
       bc, inf, dis, p.skill, p.name]);
  } else {
    const id = uid();
    await run(`INSERT INTO players (id,name,aliases,phone,primary_pos,secondary,
      ball_control,influence,discipline,skill,active,note)
      VALUES (?,?,?,?,?,?,?,?,?,?,${TRUE},?)`,
      [id, p.name, (p.aliases || []).join(","), phone, p.primary, p.secondary || null,
       bc, inf, dis, p.skill, p.note || null]);
    await run(`INSERT INTO rating_history
      (id,player_id,ts,skill,ball_control,influence,discipline,source)
      VALUES (?,?,?,?,?,?,?,?)`,
      [uid(), id, new Date().toISOString(), p.skill, bc, inf, dis, "seed"]);
  }
  nP++;
}

// ---------- games ----------
let nG = 0;
for (const g of games.games) {
  const exists = await all("SELECT id FROM games WHERE id = ?", [g.id]);
  if (exists.length) continue;
  await run(`INSERT INTO games
    (id,date,label,home,away,captains,swing,score_home,score_away,result,motm)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [g.id, g.date, g.id, JSON.stringify(g.home), JSON.stringify(g.away),
     JSON.stringify(g.captains || {}), g.swing || null,
     g.score?.home ?? null, g.score?.away ?? null, g.result || null, g.motm || null]);
  nG++;
}

// ---------- superadmin ----------
const pw = process.env.SUPERADMIN_PASSWORD;
if (!pw || pw === "change-me-before-first-run") {
  console.log("⚠  SUPERADMIN_PASSWORD not set — skipped creating the 'suman' account.");
} else {
  const hashed = bcrypt.hashSync(pw, 10);
  const ex = await all("SELECT id FROM users WHERE username = 'suman'");
  if (ex.length) {
    await run("UPDATE users SET password=?, role='superadmin' WHERE username='suman'", [hashed]);
    console.log("✓ updated superadmin 'suman'");
  } else {
    await run("INSERT INTO users (id,username,password,role) VALUES (?,?,?,?)",
      [uid(), "suman", hashed, "superadmin"]);
    console.log("✓ created superadmin 'suman'");
  }
}

const done = await all("SELECT COUNT(*) AS c FROM games WHERE result IS NOT NULL");
console.log(`✓ ${nP} players, ${nG} new games (${done[0].c} with results)`);
console.log(`✓ dimensions reconstruct existing skills to ±${maxErr.toFixed(4)}`);
await close();
