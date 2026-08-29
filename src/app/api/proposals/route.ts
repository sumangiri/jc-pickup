import { NextResponse } from "next/server";
import { getSession, isSuper } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { composite, addRatingHistory } from "@/lib/players";

export async function POST(req: Request) {
  const s = await getSession();
  if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
  const { id, decision } = await req.json();
  const p = await one<any>("SELECT * FROM proposals WHERE id=?", [id]);
  if (!p) return NextResponse.json({ error: "Proposal not found." }, { status: 404 });

  if (decision === "approved") {
    const DIM: any = { ballControl: "ball_control", influence: "influence", discipline: "discipline" };
    const POS: any = { primaryPos: "primary_pos", secondary: "secondary" };
    const pl = await one<any>("SELECT * FROM players WHERE id=?", [p.player_id]);
    if (DIM[p.field]) {
      const col = DIM[p.field];
      const next = { ...pl, [col]: +p.new_value };
      const skill = composite(next.ball_control, next.influence, next.discipline);
      await query(`UPDATE players SET ${col}=?, skill=? WHERE id=?`, [+p.new_value, skill, pl.id]);
      await addRatingHistory(pl.id, { ...next, skill } as any, "approval");
    } else if (POS[p.field]) {
      await query(`UPDATE players SET ${POS[p.field]}=? WHERE id=?`, [p.new_value, pl.id]);
    }
  }
  await query("UPDATE proposals SET status=?, decided_by=?, decided_at=? WHERE id=?",
    [decision, s!.id, new Date().toISOString(), id]);
  return NextResponse.json({ ok: true });
}
