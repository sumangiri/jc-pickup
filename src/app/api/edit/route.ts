import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseEdit } from "@/lib/openai";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { instruction, home, away } = await req.json();
    const ops = await parseEdit(instruction, home, away);
    return NextResponse.json({ ops });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
