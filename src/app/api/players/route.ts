import { NextResponse } from "next/server";
import { getSession, isAdmin, isSuper } from "@/lib/auth";
import { migrate, migrateExtras, query, one, uid } from "@/lib/db";
import { composite, addRatingHistory } from "@/lib/players";
import bcrypt from "bcryptjs";

const DIM: any = { ballControl: "ball_control", influence: "influence", discipline: "discipline" };
const POS: any = { primaryPos: "primary_pos", secondary: "secondary" };

export async function POST(req: Request) {
  const s = await getSession();
  if (!isAdmin(s)) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  await migrate(); await migrateExtras();
  const b = await req.json();

  if (b.action === "create") {
    const bc = +b.ballControl || 4, inf = +b.influence || 4, dis = +b.discipline || 4;
    const exists = await one<any>("SELECT id FROM players WHERE name = ?", [b.name]);
    if (exists) return NextResponse.json({ error: "A player with that name already exists." }, { status: 400 });
    if (!b.name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
    const id = uid();
    await query(
      `INSERT INTO players (id,name,aliases,phone,primary_pos,secondary,ball_control,influence,discipline,skill,active)
       VALUES (?,?,?,?,?,?,?,?,?,?,TRUE)`,
      [id, b.name.trim(), b.aliases || "", b.phone || null, b.primaryPos || "D",
       b.secondary || null, bc, inf, dis, composite(bc, inf, dis)]);
    await addRatingHistory(id, { skill: composite(bc, inf, dis), ball_control: bc,
      influence: inf, discipline: dis } as any, "manual");
    return NextResponse.json({ ok: true, id });
  }

  if (b.action === "photo") {
    await query("UPDATE players SET photo_url=? WHERE id=?", [b.photoUrl, b.playerId]);
    return NextResponse.json({ ok: true });
  }

  // aliases / phone / positions — admins may edit directly (low risk, high friction otherwise)
  if (b.action === "identity") {
    const p = await one<any>("SELECT * FROM players WHERE id=?", [b.playerId]);
    if (!p) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    await query(
      "UPDATE players SET aliases=?, phone=?, primary_pos=?, secondary=? WHERE id=?",
      [b.aliases ?? p.aliases, b.phone ?? p.phone,
       b.primaryPos ?? p.primary_pos, b.secondary === "" ? null : (b.secondary ?? p.secondary), p.id]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "rename") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    const p = await one<any>("SELECT * FROM players WHERE id=?", [b.playerId]);
    if (!p) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    const next = String(b.newName || "").trim();
    if (!next) return NextResponse.json({ error: "New name is required." }, { status: 400 });
    const clash = await one<any>("SELECT id FROM players WHERE name = ? AND id <> ?", [next, p.id]);
    if (clash) return NextResponse.json({ error: "Another player already has that name." }, { status: 400 });

    const aliases = (p.aliases || "").split(",").map((x: string) => x.trim()).filter(Boolean);
    if (!aliases.includes(p.name)) aliases.push(p.name);
    await query("UPDATE players SET name=?, aliases=? WHERE id=?", [next, aliases.join(","), p.id]);

    // cascade through every game record
    const games = await query<any>("SELECT id, home, away, captains, swing, motm FROM games");
    for (const g of games) {
      const home = JSON.parse(g.home).map((n: string) => (n === p.name ? next : n));
      const away = JSON.parse(g.away).map((n: string) => (n === p.name ? next : n));
      const cap = JSON.parse(g.captains || "{}");
      if (cap.home === p.name) cap.home = next;
      if (cap.away === p.name) cap.away = next;
      await query("UPDATE games SET home=?, away=?, captains=?, swing=?, motm=? WHERE id=?",
        [JSON.stringify(home), JSON.stringify(away), JSON.stringify(cap),
         g.swing === p.name ? next : g.swing, g.motm === p.name ? next : g.motm, g.id]);
    }
    return NextResponse.json({ ok: true, renamed: next });
  }

  if (b.action === "active") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    await query("UPDATE players SET active=? WHERE id=?", [b.active ? true : false, b.playerId]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "role") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    await query("UPDATE users SET role=? WHERE id=?", [b.role, b.userId]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "resetPassword") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    if (!b.tempPassword || b.tempPassword.length < 6)
      return NextResponse.json({ error: "Use at least 6 characters." }, { status: 400 });
    await query("UPDATE users SET password=? WHERE id=?",
      [bcrypt.hashSync(b.tempPassword, 10), b.userId]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "deleteUser") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    const u = await one<any>("SELECT * FROM users WHERE id=?", [b.userId]);
    if (!u) return NextResponse.json({ error: "Account not found." }, { status: 404 });
    if (u.id === s!.id) return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
    if (u.role === "superadmin") return NextResponse.json({ error: "Super admin accounts can't be deleted." }, { status: 400 });
    await query("DELETE FROM users WHERE id=?", [b.userId]);
    return NextResponse.json({ ok: true });
  }

  if (b.action === "propose") {
    const p = await one<any>("SELECT * FROM players WHERE id=?", [b.playerId]);
    if (!p) return NextResponse.json({ error: "Player not found." }, { status: 404 });
    const col = DIM[b.field] || POS[b.field];
    if (!col) return NextResponse.json({ error: "Unknown field." }, { status: 400 });

    if (isSuper(s)) {
      if (DIM[b.field]) {
        const next = { ...p, [col]: +b.newValue };
        const skill = composite(next.ball_control, next.influence, next.discipline);
        await query(`UPDATE players SET ${col}=?, skill=? WHERE id=?`, [+b.newValue, skill, p.id]);
        await addRatingHistory(p.id, { ...next, skill } as any, "manual");
        return NextResponse.json({ ok: true, applied: true, skill });
      }
      await query(`UPDATE players SET ${col}=? WHERE id=?`, [b.newValue, p.id]);
      return NextResponse.json({ ok: true, applied: true });
    }
    await query(
      `INSERT INTO proposals (id,player_id,field,old_value,new_value,note,status,proposed_by)
       VALUES (?,?,?,?,?,?, 'pending', ?)`,
      [uid(), p.id, b.field, String(p[col] ?? ""), String(b.newValue), b.note || null, s!.id]);
    return NextResponse.json({ ok: true, applied: false });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
