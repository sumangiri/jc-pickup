import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { extractNames } from "@/lib/openai";

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { images } = await req.json();
    if (!images?.length) return NextResponse.json({ error: "No screenshots received." }, { status: 400 });
    const names = await extractNames(images);
    return NextResponse.json({ names });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
