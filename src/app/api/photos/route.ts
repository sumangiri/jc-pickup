import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { migrate, migrateExtras, query, uid } from "@/lib/db";

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await migrate(); await migrateExtras();
  const u = new URL(req.url);
  const q = (u.searchParams.get("q") || "").toLowerCase().trim();
  let rows = await query<any>(
    "SELECT id, url, caption, game_date, uploaded_by, created_at FROM photos ORDER BY COALESCE(game_date, '') DESC, created_at DESC");
  if (q) rows = rows.filter((r) =>
    (r.caption || "").toLowerCase().includes(q) ||
    (r.game_date || "").includes(q) ||
    (r.uploaded_by || "").toLowerCase().includes(q));
  return NextResponse.json({ photos: rows.slice(0, 400) });
}

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await migrate(); await migrateExtras();
  const b = await req.json();
  if (!b.url?.startsWith("data:image/"))
    return NextResponse.json({ error: "Upload didn't look like an image." }, { status: 400 });
  if (b.url.length > 1_600_000)
    return NextResponse.json({ error: "Image too large after compression — try a smaller one." }, { status: 400 });
  const id = uid();
  await query(
    "INSERT INTO photos (id,url,caption,game_date,uploaded_by) VALUES (?,?,?,?,?)",
    [id, b.url, b.caption || null, b.gameDate || null, s.username]);
  return NextResponse.json({ ok: true, id });
}
