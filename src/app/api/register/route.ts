import { NextResponse } from "next/server";
import { register, createSession } from "@/lib/auth";
import { migrate } from "@/lib/db";
export async function POST(req: Request) {
  try {
    await migrate();
    const { username, password } = await req.json();
    if (!username || username.length < 2) throw new Error("Pick a username of 2+ characters.");
    if (!password || password.length < 6) throw new Error("Use a password of at least 6 characters.");
    const u = await register(username, password);
    await createSession(u);
    return NextResponse.json({ ok: true, user: u });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
