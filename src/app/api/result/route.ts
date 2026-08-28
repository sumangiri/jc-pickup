import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { addRatingHistory } from "@/lib/players";
import { parseResult } from "@/lib/openai";

const K = 0.4;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json();
  const g = await one<any>("SELECT * FROM games WHERE id = ?", [body.gameId]);
  if (!g) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const home = JSON.parse(g.home), away = JSON.parse(g.away);
  let { scoreHome, scoreAway, motm } = body;

  if (body.text) {
    try {
      const p = await parseResult(body.text, home, away);
      scoreHome = p.scoreHome; scoreAway = p.scoreAway; motm = p.motm || null;
    } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
  }
  if (scoreHome == null || scoreAway == null)
    return NextResponse.json({ error: "Enter both scores." }, { status: 400 });

  const result = scoreHome > scoreAway ? "home" : scoreAway > scoreHome ? "away" : "draw";
  await query(
    "UPDATE games SET score_home=?, score_away=?, result=?, motm=? WHERE id=?",
    [scoreHome, scoreAway, result, motm || null, g.id]
  );

  // Elo-lite drift on the final skill, dimensions move proportionally
  const rows = await query<any>("SELECT * FROM players");
  const by = new Map(rows.map((p) => [p.name, p]));
  const H = home.map((n: string) => by.get(n)).filter(Boolean);
  const A = away.map((n: string) => by.get(n)).filter(Boolean);
  if (H.length && A.length) {
    const sum = (x: any[]) => x.reduce((a, p) => a + p.skill, 0);
    const pctH = (100 * sum(H)) / (10 * H.length), pctA = (100 * sum(A)) / (10 * A.length);
    const eff = pctH - pctA + 4 * (H.length - A.length);
    const pHome = 1 / (1 + Math.pow(10, -eff / 25));
    const R = result === "home" ? 1 : result === "away" ? 0 : 0.5;
    const delta = +(K * (R - pHome)).toFixed(3);
    const clamp = (v: number) => Math.max(1, Math.min(10, +v.toFixed(2)));
    for (const [team, dir] of [[H, 1], [A, -1]] as [any[], number][]) {
      for (const p of team) {
        const next = {
          skill: clamp(p.skill + dir * delta),
          ball_control: clamp(p.ball_control + dir * delta),
          influence: clamp(p.influence + dir * delta),
          discipline: clamp(p.discipline + dir * delta),
        };
        await query(
          "UPDATE players SET skill=?, ball_control=?, influence=?, discipline=? WHERE id=?",
          [next.skill, next.ball_control, next.influence, next.discipline, p.id]
        );
        await addRatingHistory(p.id, next as any, "drift");
      }
    }
    return NextResponse.json({ ok: true, result, delta, pHome: Math.round(pHome * 100), motm });
  }
  return NextResponse.json({ ok: true, result, motm });
}
