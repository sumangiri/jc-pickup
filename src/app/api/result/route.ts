import { NextResponse } from "next/server";
import { getSession, isSuper } from "@/lib/auth";
import { migrate, migrateExtras, query, one, uid } from "@/lib/db";
import { parseResult } from "@/lib/openai";

const K = 0.4;
const clamp = (v: number) => Math.max(1, Math.min(10, +v.toFixed(2)));

async function computePreview(g: any, scoreHome: number, scoreAway: number) {
  const home = JSON.parse(g.home), away = JSON.parse(g.away);
  const rows = await query<any>("SELECT * FROM players");
  const by = new Map(rows.map((p) => [p.name, p]));
  const H = home.map((n: string) => by.get(n)).filter(Boolean);
  const A = away.map((n: string) => by.get(n)).filter(Boolean);
  const result = scoreHome > scoreAway ? "home" : scoreAway > scoreHome ? "away" : "draw";
  if (!H.length || !A.length) return { result, pHome: 50, delta: 0, H, A };
  const sum = (x: any[]) => x.reduce((a, p) => a + p.skill, 0);
  const eff = (100 * sum(H)) / (10 * H.length) - (100 * sum(A)) / (10 * A.length)
    + 4 * (H.length - A.length);
  const pHome = 1 / (1 + Math.pow(10, -eff / 25));
  const R = result === "home" ? 1 : result === "away" ? 0 : 0.5;
  return { result, pHome: Math.round(pHome * 100), delta: +(K * (R - pHome)).toFixed(3), H, A };
}

/** Apply drift in one direction. dir=+1 publishes, dir=-1 reverses. */
async function applyDrift(H: any[], A: any[], delta: number, dir: number, gameId: string | null) {
  for (const [team, side] of [[H, 1], [A, -1]] as [any[], number][]) {
    for (const p of team) {
      const d = dir * side * delta;
      const next = {
        skill: clamp(p.skill + d), ball_control: clamp(p.ball_control + d),
        influence: clamp(p.influence + d), discipline: clamp(p.discipline + d),
      };
      await query("UPDATE players SET skill=?, ball_control=?, influence=?, discipline=? WHERE id=?",
        [next.skill, next.ball_control, next.influence, next.discipline, p.id]);
      if (dir > 0) {
        await query(
          `INSERT INTO rating_history (id,player_id,ts,skill,ball_control,influence,discipline,source,game_id)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [uid(), p.id, new Date().toISOString(), next.skill, next.ball_control,
           next.influence, next.discipline, "drift", gameId]);
      }
    }
  }
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await migrate(); await migrateExtras();
  const b = await req.json();
  const action = b.action || "preview";

  const g = await one<any>("SELECT * FROM games WHERE id = ?", [b.gameId]);
  if (!g) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  const home = JSON.parse(g.home), away = JSON.parse(g.away);

  // ---------- PREVIEW (no writes) ----------
  if (action === "preview" || action === "submit") {
    let { scoreHome, scoreAway, motm } = b;
    if (b.text) {
      try {
        const p = await parseResult(b.text, home, away);
        scoreHome = p.scoreHome; scoreAway = p.scoreAway; motm = p.motm || null;
      } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
    }
    if (scoreHome == null || scoreAway == null || scoreHome === "" || scoreAway === "")
      return NextResponse.json({ error: "Enter both scores." }, { status: 400 });
    scoreHome = +scoreHome; scoreAway = +scoreAway;
    const pv = await computePreview(g, scoreHome, scoreAway);

    if (action === "preview")
      return NextResponse.json({ ok: true, scoreHome, scoreAway, motm: motm || null,
        result: pv.result, pHome: pv.pHome, delta: pv.delta });

    // submit: superadmin auto-approves, everyone else queues
    if (isSuper(s)) {
      await query("UPDATE games SET score_home=?, score_away=?, result=?, motm=?, drift_delta=?, pending_result=NULL WHERE id=?",
        [scoreHome, scoreAway, pv.result, motm || null, pv.delta, g.id]);
      await applyDrift(pv.H, pv.A, pv.delta, 1, g.id);
      return NextResponse.json({ ok: true, published: true, result: pv.result, delta: pv.delta, pHome: pv.pHome });
    }
    await query("UPDATE games SET pending_result=? WHERE id=?", [JSON.stringify({
      scoreHome, scoreAway, motm: motm || null, result: pv.result, delta: pv.delta,
      pHome: pv.pHome, submittedBy: s.username, submittedAt: new Date().toISOString(),
    }), g.id]);
    return NextResponse.json({ ok: true, published: false, pending: true });
  }

  // ---------- APPROVE / DENY / UNPUBLISH (superadmin) ----------
  if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });

  if (action === "approve") {
    if (!g.pending_result) return NextResponse.json({ error: "Nothing pending on this game." }, { status: 400 });
    const p = JSON.parse(g.pending_result);
    const pv = await computePreview(g, p.scoreHome, p.scoreAway);
    await query("UPDATE games SET score_home=?, score_away=?, result=?, motm=?, drift_delta=?, pending_result=NULL WHERE id=?",
      [p.scoreHome, p.scoreAway, pv.result, p.motm || null, pv.delta, g.id]);
    await applyDrift(pv.H, pv.A, pv.delta, 1, g.id);
    return NextResponse.json({ ok: true, result: pv.result, delta: pv.delta });
  }

  if (action === "deny") {
    await query("UPDATE games SET pending_result=NULL WHERE id=?", [g.id]);
    return NextResponse.json({ ok: true });
  }

  if (action === "unpublish") {
    if (!g.result) return NextResponse.json({ error: "This game has no published result." }, { status: 400 });
    const delta = g.drift_delta ?? 0;
    if (delta) {
      const rows = await query<any>("SELECT * FROM players");
      const by = new Map(rows.map((p) => [p.name, p]));
      const H = home.map((n: string) => by.get(n)).filter(Boolean);
      const A = away.map((n: string) => by.get(n)).filter(Boolean);
      await applyDrift(H, A, delta, -1, null);
    }
    await query("DELETE FROM rating_history WHERE game_id = ?", [g.id]);
    await query("UPDATE games SET score_home=NULL, score_away=NULL, result=NULL, motm=NULL, drift_delta=NULL WHERE id=?", [g.id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
