/**
 * Creates the initial member accounts. Idempotent — safe to re-run.
 *   local:      node scripts/add-users.mjs
 *   production: POSTGRES_URL="postgres://…" node scripts/add-users.mjs
 */
import path from "path";
import bcrypt from "bcryptjs";

const usePg = !!process.env.POSTGRES_URL;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

const USERS = ["milan", "kwasi", "biswas", "shailesh", "ashim", "pranay", "pradhumna"]
  .map((u) => ({ username: u, password: [...u].reverse().join("") }));

let run, all, close;
if (usePg) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
  const toPg = (sql) => { let i = 0; return sql.replace(/\?/g, () => `$${++i}`); };
  run = async (sql, p = []) => pool.query(toPg(sql), p);
  all = async (sql, p = []) => (await pool.query(toPg(sql), p)).rows;
  close = () => pool.end();
} else {
  const { DatabaseSync } = await import("node:sqlite");
  const file = (process.env.DATABASE_URL || "file:./dev.db").replace(/^file:/, "");
  const db = new DatabaseSync(path.join(process.cwd(), file));
  db.exec("PRAGMA busy_timeout = 5000;");
  run = async (sql, p = []) => db.prepare(sql).run(...p);
  all = async (sql, p = []) => db.prepare(sql).all(...p).map((r) => ({ ...r }));
  close = () => {};
}

for (const u of USERS) {
  const ex = await all("SELECT id FROM users WHERE username = ?", [u.username]);
  if (ex.length) { console.log(`• ${u.username} already exists — skipped`); continue; }
  await run("INSERT INTO users (id,username,password,role) VALUES (?,?,?,?)",
    [uid(), u.username, bcrypt.hashSync(u.password, 10), "member"]);
  console.log(`✓ created ${u.username}  (password: ${u.password})`);
}
console.log("\nAll set. They should change nothing — just sign in and play.");
await close();
