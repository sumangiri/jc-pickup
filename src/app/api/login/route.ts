import { NextResponse } from "next/server";
import { login, createSession } from "@/lib/auth";
import { migrate } from "@/lib/db";
export async function POST(req: Request) {
  try {
    await migrate();
    const { username, password } = await req.json();
    const u = await login(username, password);
    await createSession(u);
    return NextResponse.json({ ok: true, user: u });
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 400 }); }
}
