import { NextResponse } from "next/server";
import { getSession, isSuper } from "@/lib/auth";
import { migrate, migrateExtras, query, uid } from "@/lib/db";
import { standings, influence } from "@/lib/stats";

const MODEL = "gpt-4o-mini";

async function llm(system: string, user: string, maxTokens = 1400) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set on the server.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL, max_tokens: maxTokens, temperature: 0.7,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).choices?.[0]?.message?.content ?? "";
}

async function seasonContext() {
  const games = (await query<any>("SELECT * FROM games ORDER BY date ASC")).map((g) => ({
    date: g.date, home: JSON.parse(g.home), away: JSON.parse(g.away),
    score: g.result ? `${g.score_home}-${g.score_away}` : "pending",
    result: g.result, motm: g.motm, swing: g.swing,
  }));
  const st = await standings();
  const inf = await influence();
  const players = await query<any>(
    "SELECT name, primary_pos, ball_control, influence, discipline, skill FROM players WHERE active");
  const table = Object.entries(st).map(([name, v]: any) => ({
    name, gp: v.gp, w: v.w, l: v.gp - v.w, motm: v.motm,
    carry: inf.table[name] && inf.table[name].gp >= 4
      ? +(inf.table[name].carry / inf.table[name].gp).toFixed(2) : null,
  })).sort((a, b) => b.w - a.w);
  return JSON.stringify({ games, table, goalsPerSkillPoint: +inf.k.toFixed(2), players }, null, 0);
}

const VOICE = `You are the resident pundit for a weekly pickup soccer group in Jersey City Heights.
Write in a sharp, warm, funny broadcast style. Use markdown with a few short ## sections.
Ground every claim in the data given. Never invent games or numbers. Do not reveal players'
hidden skill ratings as numbers; describe form in words. Refer to teams as Pinnies (home)
and No Pinnies (away).`;

export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  await migrate(); await migrateExtras();
  const b = await req.json();

  if (b.action === "generate") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    const ctx = await seasonContext();
    const content = await llm(VOICE,
      `Season data (from day 0 through today):\n${ctx}\n\n` +
      `Write this week's OVERALL ASSESSMENT of the season so far: the story of the season, ` +
      `form and trends, the perfect-record club, cold streaks, MOTM race, upsets vs expectation ` +
      `(use the carry numbers), and one thing to watch next week. 350-550 words.`);
    const done = await query<any>("SELECT COUNT(*) AS c FROM games WHERE result IS NOT NULL");
    const id = uid();
    const label = "Week of " + new Date().toISOString().slice(0, 10);
    await query(
      "INSERT INTO assessments (id, week_label, content, games_covered, created_by) VALUES (?,?,?,?,?)",
      [id, label, content, done[0].c, s.username]);
    return NextResponse.json({ ok: true, id, label, content });
  }

  if (b.action === "ask") {
    if (!isSuper(s)) return NextResponse.json({ error: "Only the super admin can ask questions." }, { status: 403 });
    const ctx = await seasonContext();
    const answer = await llm(VOICE + " Answer the question directly in under 200 words.",
      `Season data:\n${ctx}\n\nQuestion from the organiser: ${b.question}`, 500);
    return NextResponse.json({ ok: true, answer });
  }

  if (b.action === "delete") {
    if (!isSuper(s)) return NextResponse.json({ error: "Super admin only." }, { status: 403 });
    await query("DELETE FROM assessments WHERE id = ?", [b.id]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
