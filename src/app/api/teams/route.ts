import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { migrate, query, uid } from "@/lib/db";
import { allPlayers, matchNames, sideHistory, toBalancer } from "@/lib/players";
import { balanceTeams, balanceThree } from "@/lib/balance";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await migrate();
  const { names, seed, mode, save, date, label } = await req.json();

  const { matched, missing } = await matchNames(names || []);
  if (matched.length < 2)
    return NextResponse.json({ error: "Need at least 2 known players.", missing }, { status: 400 });

  if (mode === "three") {
    const teams = balanceThree(matched.map(toBalancer), seed || Date.now() % 100000);
    return NextResponse.json({ mode: "three", teams, missing });
  }

  const hist = await sideHistory();
  const names2 = matched.map((p) => p.name);
  const lockHome = names2.includes("Suman") ? ["Suman"] : [];
  const result = balanceTeams(matched.map(toBalancer), {
    sideHistory: hist,
    lockHome,
    keepTogether: [["Suman", "Prasanna Poudyal"]],
    seed: seed || 12345,
    trials: 120000,
  });

  let gameId: string | null = null;
  if (save) {
    gameId = uid();
    await query(
      `INSERT INTO games (id,date,label,home,away,captains,swing) VALUES (?,?,?,?,?,?,?)`,
      [gameId, date || new Date().toISOString().slice(0, 10), label || null,
       JSON.stringify(result.home.map((p) => p.name)),
       JSON.stringify(result.away.map((p) => p.name)),
       JSON.stringify({ home: result.captainHome, away: result.captainAway }),
       result.swing]
    );
  }
  return NextResponse.json({ ...result, missing, gameId });
}
