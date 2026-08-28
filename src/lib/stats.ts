import { query } from "./db";

export type GameRow = {
  id: string; date: string; label?: string; home: string; away: string;
  captains: string; swing?: string; score_home?: number; score_away?: number;
  result?: string; motm?: string; sheet_url?: string;
};

export async function allGames() {
  return query<GameRow>("SELECT * FROM games ORDER BY date DESC");
}

export async function standings() {
  const games = await query<GameRow>("SELECT * FROM games");
  const st: Record<string, { gp: number; w: number; motm: number }> = {};
  const touch = (n: string) => (st[n] ||= { gp: 0, w: 0, motm: 0 });
  for (const g of games) {
    if (g.motm) touch(g.motm).motm++;
    if (!g.result) continue;
    const home = JSON.parse(g.home), away = JSON.parse(g.away);
    const winners = new Set(g.result === "home" ? home : g.result === "away" ? away : []);
    for (const n of [...home, ...away]) { touch(n).gp++; if (winners.has(n)) st[n].w++; }
    if (g.swing && g.result !== "draw" && !winners.has(g.swing)) touch(g.swing).w++;
  }
  return st;
}

/** Carry: actual margin vs what the REST of the team projected. */
export async function influence() {
  const games = (await query<GameRow>("SELECT * FROM games")).filter((g) => g.result);
  const players = await query<any>("SELECT name, skill FROM players");
  const sk = new Map(players.map((p) => [p.name, p.skill]));
  const S = (n: string) => sk.get(n) ?? 4;
  const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

  let num = 0, den = 0;
  for (const g of games) {
    const H = JSON.parse(g.home).map(S), A = JSON.parse(g.away).map(S);
    const gap = mean(H) - mean(A), m = (g.score_home ?? 0) - (g.score_away ?? 0);
    num += gap * m; den += gap * gap;
  }
  const k = den ? num / den : 1;

  const acc: Record<string, { gp: number; carry: number }> = {};
  for (const g of games) {
    const home = JSON.parse(g.home), away = JSON.parse(g.away);
    const m = (g.score_home ?? 0) - (g.score_away ?? 0);
    for (const [names, opp, sign] of [[home, away, 1], [away, home, -1]] as [string[], string[], number][]) {
      for (const n of names) {
        const mates = names.filter((x) => x !== n).map(S);
        const exp = k * (mean(mates.length ? mates : [S(n)]) - mean(opp.map(S)));
        const a = (acc[n] ||= { gp: 0, carry: 0 });
        a.gp++; a.carry += sign * m - exp;
      }
    }
  }
  return { k, table: acc };
}
