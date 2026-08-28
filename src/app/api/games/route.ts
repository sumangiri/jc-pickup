import { NextResponse } from "next/server";
import { getSession, isAdmin } from "@/lib/auth";
import { migrate, migrateExtras, query, one, uid } from "@/lib/db";
import { matchNames } from "@/lib/players";

/** Import a game played outside the app (e.g. via the Claude skill),
 *  or update an existing game's record for posterity.
 *  Facts only — rating drift is NOT re-run here. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!isAdmin(s)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  await migrate(); await migrateExtras();
  const b = await req.json();

  const parse = async (csv: string) => {
    const names = String(csv || "").split(",").map((x) => x.trim()).filter(Boolean);
    const { matched, missing } = await matchNames(names);
    return { names: matched.map((p) => p.name), missing };
  };

  const home = await parse(b.home);
  const away = await parse(b.away);
  const missing = [...home.missing, ...away.missing];
  if (missing.length)
    return NextResponse.json(
      { error: `Not on the roster: ${missing.join(", ")}. Add them first or fix the spelling.` },
      { status: 400 });
  if (home.names.length < 2 || away.names.length < 2)
    return NextResponse.json({ error: "Each side needs at least 2 known players." }, { status: 400 });

  const scoreHome = b.scoreHome === "" || b.scoreHome == null ? null : +b.scoreHome;
  const scoreAway = b.scoreAway === "" || b.scoreAway == null ? null : +b.scoreAway;
  const result = scoreHome == null || scoreAway == null ? null
    : scoreHome > scoreAway ? "home" : scoreAway > scoreHome ? "away" : "draw";
  const topOf = (ns: string[], skills: Record<string, number>) =>
    ns.reduce((m, n) => (skills[n] > (skills[m] ?? -1) ? n : m), ns[0]);
  const rows = await query<any>("SELECT name, skill FROM players");
  const sk: Record<string, number> = Object.fromEntries(rows.map((r) => [r.name, r.skill]));
  const captains = JSON.stringify({ home: topOf(home.names, sk), away: topOf(away.names, sk) });

  if (b.gameId) {
    const g = await one<any>("SELECT id FROM games WHERE id = ?", [b.gameId]);
    if (!g) return NextResponse.json({ error: "Game not found." }, { status: 404 });
    await query(
      `UPDATE games SET date=?, label=?, home=?, away=?, captains=?, swing=?,
       score_home=?, score_away=?, result=?, motm=?, sheet_url=COALESCE(?, sheet_url) WHERE id=?`,
      [b.date, b.label || null, JSON.stringify(home.names), JSON.stringify(away.names),
       captains, b.swing || null, scoreHome, scoreAway, result, b.motm || null,
       b.sheetUrl || null, b.gameId]);
    return NextResponse.json({ ok: true, id: b.gameId, updated: true });
  }

  const id = uid();
  await query(
    `INSERT INTO games (id,date,label,home,away,captains,swing,score_home,score_away,result,motm,sheet_url)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, b.date, b.label || null, JSON.stringify(home.names), JSON.stringify(away.names),
     captains, b.swing || null, scoreHome, scoreAway, result, b.motm || null, b.sheetUrl || null]);
  return NextResponse.json({ ok: true, id });
}
