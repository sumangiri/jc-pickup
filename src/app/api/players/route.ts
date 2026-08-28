import { NextResponse } from "next/server";
import { getSession, isAdmin, isSuper } from "@/lib/auth";
import { query, one, uid } from "@/lib/db";
import { composite, addRatingHistory } from "@/lib/players";

export async function POST(req: Request) {
  const s = await getSession();
  if (!isAdmin(s)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const b = await req.json();

  if (b.action === "create") {
    const bc = +b.ballControl || 4, inf = +b.influence || 4, dis = +b.discipline || 4;
    const id = uid();
    await query(
      `INSERT INTO players (id,name,aliases,primary_pos,secondary,ball_control,influence,discipline,skill,active)
       VALUES (?,?,?,?,?,?,?,?,?,TRUE)`,
      [id, b.name, b.aliases || "", b.primaryPos || "D", b.secondary || null,
       bc, inf, dis, composite(bc, inf, dis)]
    );
    await addRatingHistory(id, { skill: composite(bc, inf, dis), ball_control: bc, influence: inf, discipline: dis } as any, "manual");
    return NextResponse.json({ ok: true, id });
  }

  if (b.action === "photo") {
    await query("UPDATE players SET photo_url=? WHERE id=?", [b.photoUrl, b.playerId]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "role") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    await query("UPDATE users SET role=? WHERE id=?", [b.role, b.userId]);
    return NextResponse.json({ ok: true });
  }

  // propose a rating change — super admin applies immediately, admins queue it
  if (b.action === "propose") {
    const p = await one<any>("SELECT * FROM players WHERE id=?", [b.playerId]);
    if (!p) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    const map: any = { ballControl: "ball_control", influence: "influence", discipline: "discipline" };
    const col = map[b.field];
    if (!col) return NextResponse.json({ error: "Unknown field." }, { status: 400 });

    if (isSuper(s)) {
      const next = { ...p, [col]: +b.newValue };
      const skill = composite(next.ball_control, next.influence, next.discipline);
      await query(`UPDATE players SET ${col}=?, skill=? WHERE id=?`, [+b.newValue, skill, p.id]);
      await addRatingHistory(p.id, { ...next, skill } as any, "manual");
      return NextResponse.json({ ok: true, applied: true, skill });
    }
    await query(
      `INSERT INTO proposals (id,player_id,field,old_value,new_value,note,status,proposed_by)
       VALUES (?,?,?,?,?,?, 'pending', ?)`,
      [uid(), p.id, b.field, String(p[col]), String(b.newValue), b.note || null, s!.id]
    );
    return NextResponse.json({ ok: true, applied: false });
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
