import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { migrate, query } from "@/lib/db";
import { standings, influence } from "@/lib/stats";
import StatsView from "@/components/StatsView";

export const dynamic = "force-dynamic";

export default async function Stats() {
  const s = await getSession();
  if (!s) redirect("/login");
  await migrate();
  const st = await standings();
  const inf = await influence();
  const players = await query<any>("SELECT * FROM players WHERE active");
  const hist = await query<any>("SELECT player_id, ts, skill FROM rating_history ORDER BY ts ASC");

  const rows = players.map((p: any) => {
    const s0 = st[p.name] || { gp: 0, w: 0, motm: 0 };
    const c = inf.table[p.name];
    return {
      name: p.name, photo: p.photo_url, pos: p.primary_pos,
      bc: p.ball_control, inf: p.influence, dis: p.discipline, skill: p.skill,
      gp: s0.gp, w: s0.w, motm: s0.motm,
      carry: c && c.gp ? +(c.carry / c.gp).toFixed(2) : null,
      history: hist.filter((h: any) => h.player_id === p.id).map((h: any) => ({ ts: h.ts, skill: h.skill })),
    };
  });
  return (
    <>
      <h1 className="page">Stats</h1>
      <p className="sub">Records, influence and how ratings have moved.</p>
      <StatsView rows={rows} k={inf.k} />
    </>
  );
}
