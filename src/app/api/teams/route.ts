import { NextResponse } from "next/server";
import { getSession, isSuper } from "@/lib/auth";
import { migrate, migrateExtras, query, one, uid } from "@/lib/db";
import { matchNames, sideHistory, toBalancer } from "@/lib/players";
import { balanceTeams, balanceThree } from "@/lib/balance";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await migrate(); await migrateExtras();
  const { names, seed, mode, save, date, label, exact, replace, sheetPng } = await req.json();

  // ---- SAVE PATH: log exactly what the organiser sees. Never re-balance. ----
  if (save && exact) {
    const h = await matchNames(exact.home || []);
    const a = await matchNames(exact.away || []);
    const missing = [...h.missing, ...a.missing];
    if (missing.length)
      return NextResponse.json({ error: `Not on the roster: ${missing.join(", ")}.` }, { status: 400 });
    if (h.matched.length < 2 || a.matched.length < 2)
      return NextResponse.json({ error: "Each side needs at least 2 players." }, { status: 400 });

    const homeNames = h.matched.map((p) => p.name);
    const awayNames = a.matched.map((p) => p.name);
    const sk: Record<string, number> = {};
    for (const p of [...h.matched, ...a.matched]) sk[p.name] = p.skill;
    const top = (ns: string[]) => ns.reduce((m, n) => (sk[n] > (sk[m] ?? -1) ? n : m), ns[0]);
    const captains = JSON.stringify({ home: top(homeNames), away: top(awayNames) });
    const gameDate = date || new Date().toISOString().slice(0, 10);
    const status = isSuper(s) ? "approved" : "pending";

    const dupe = await one<any>(
      "SELECT id FROM games WHERE date = ? AND result IS NULL", [gameDate]);
    if (dupe && !replace)
      return NextResponse.json({ duplicate: true, existingId: dupe.id,
        error: "A game for this date is already pending." }, { status: 409 });

    if (dupe && replace) {
      await query(
        `UPDATE games SET label=?, home=?, away=?, captains=?, swing=?,
         sheet_url=COALESCE(?, sheet_url), approval_status=?, submitted_by=? WHERE id=?`,
        [label || null, JSON.stringify(homeNames), JSON.stringify(awayNames), captains,
         exact.swing || null, sheetPng || null, status, s.username, dupe.id]);
      return NextResponse.json({ ok: true, gameId: dupe.id, replaced: true, approvalStatus: status });
    }

    const gameId = uid();
    await query(
      `INSERT INTO games (id,date,label,home,away,captains,swing,sheet_url,approval_status,submitted_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [gameId, gameDate, label || null, JSON.stringify(homeNames), JSON.stringify(awayNames),
       captains, exact.swing || null, sheetPng || null, status, s.username]);
    return NextResponse.json({ ok: true, gameId, approvalStatus: status });
  }

  // ---- BALANCE PATH (no writes) ----
  const { matched, missing } = await matchNames(names || []);
  if (matched.length < 2)
    return NextResponse.json({ error: "Need at least 2 known players.", missing }, { status: 400 });

  if (mode === "three") {
    const teams = balanceThree(matched.map(toBalancer), seed || Date.now() % 100000);
    return NextResponse.json({ mode: "three", teams, missing });
  }

  const hist = await sideHistory();
  const names2 = matched.map((p) => p.name);
  const result = balanceTeams(matched.map(toBalancer), {
    sideHistory: hist,
    lockHome: names2.includes("Suman") ? ["Suman"] : [],
    keepTogether: [["Suman", "Prasanna Poudyal"]],
    seed: seed || 12345,
    trials: 120000,
  });
  return NextResponse.json({ ...result, missing });
}
