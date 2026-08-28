import { query, one, uid } from "./db";

export type DbPlayer = {
  id: string; name: string; aliases: string; phone?: string; photo_url?: string;
  primary_pos: string; secondary?: string; ball_control: number; influence: number;
  discipline: number; skill: number; active: number; note?: string;
};

export const W = { bc: 0.4, inf: 0.35, dis: 0.25 };
export const composite = (bc: number, inf: number, dis: number) =>
  +(W.bc * bc + W.inf * inf + W.dis * dis).toFixed(2);

export function toBalancer(p: DbPlayer) {
  return {
    id: p.id, name: p.name, primaryPos: p.primary_pos as any, secondary: p.secondary,
    ballControl: p.ball_control, influence: p.influence, discipline: p.discipline,
    skill: p.skill, photoUrl: p.photo_url,
  };
}

export async function allPlayers() {
  return query<DbPlayer>("SELECT * FROM players WHERE active = 1 ORDER BY skill DESC");
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Match poll names (nicknames, phones, "You") to roster rows. */
export async function matchNames(names: string[], meName = "Suman") {
  const players = await query<DbPlayer>("SELECT * FROM players");
  const lookup = new Map<string, DbPlayer>();
  for (const p of players) {
    lookup.set(norm(p.name), p);
    for (const a of (p.aliases || "").split(",")) if (a.trim()) lookup.set(norm(a), p);
  }
  const matched: DbPlayer[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  for (let raw of names) {
    raw = String(raw).replace(/^~/, "").trim();
    if (!raw) continue;
    const key = /^you$/i.test(raw) ? norm(meName) : norm(raw);
    const hit = lookup.get(key);
    if (hit && !seen.has(hit.id)) { matched.push(hit); seen.add(hit.id); }
    else if (!hit) missing.push(raw);
  }
  return { matched, missing };
}

/** net home-lean per player, from completed + pending games */
export async function sideHistory() {
  const games = await query<any>("SELECT home, away FROM games");
  const net: Record<string, number> = {};
  for (const g of games) {
    for (const n of JSON.parse(g.home)) net[n] = (net[n] || 0) + 1;
    for (const n of JSON.parse(g.away)) net[n] = (net[n] || 0) - 1;
  }
  return net;
}

export async function addRatingHistory(playerId: string, p: Partial<DbPlayer>, source: string) {
  await query(
    `INSERT INTO rating_history (id,player_id,ts,skill,ball_control,influence,discipline,source)
     VALUES (?,?,?,?,?,?,?,?)`,
    [uid(), playerId, new Date().toISOString(), p.skill, p.ball_control, p.influence, p.discipline, source]
  );
}
