/** Thin OpenAI client. Uses gpt-4o-mini (cheapest vision-capable model). */
const MODEL = "gpt-4o-mini";

async function call(body: any) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set. Add it to .env.local and restart.");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseJson(txt: string) {
  const clean = txt.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch {
    const m = clean.match(/[\{\[][\s\S]*[\}\]]/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Could not parse model output as JSON.");
  }
}

/** Screenshot -> attendee names */
export async function extractNames(dataUrls: string[]) {
  const content: any[] = [{
    type: "text",
    text:
      "These are WhatsApp poll screenshots showing who voted YES to a pickup soccer game. " +
      "Return ONLY JSON: {\"names\":[...]}. Include every person listed. Strip leading '~'. " +
      "If a row shows 'You', return the literal string 'You'. Ignore phone numbers, timestamps, " +
      "vote counts and headers. Deduplicate.",
  }];
  for (const url of dataUrls) content.push({ type: "image_url", image_url: { url, detail: "high" } });
  const out = await call({ messages: [{ role: "user", content }], max_tokens: 800, temperature: 0 });
  const j = parseJson(out);
  return (j.names || []) as string[];
}

/** Natural language roster/lineup edit -> structured ops */
export async function parseEdit(instruction: string, home: string[], away: string[]) {
  const out = await call({
    messages: [{
      role: "user",
      content:
        `Current HOME: ${home.join(", ")}\nCurrent AWAY: ${away.join(", ")}\n\n` +
        `Instruction: "${instruction}"\n\n` +
        `Return ONLY JSON with an "ops" array. Allowed ops:\n` +
        `{"op":"swap","a":"NameOnOneTeam","b":"NameOnOtherTeam"}\n` +
        `{"op":"move","player":"Name","to":"home"|"away"}\n` +
        `{"op":"remove","player":"Name"}\n` +
        `{"op":"add","player":"Name","to":"home"|"away"}\n` +
        `{"op":"reroll"}\n` +
        `Use exact names from the lists where possible.`,
    }],
    max_tokens: 400, temperature: 0,
  });
  return parseJson(out).ops || [];
}

/** "we won 6-5, utsav motm" -> {scoreHome, scoreAway, motm} */
export async function parseResult(text: string, home: string[], away: string[]) {
  const out = await call({
    messages: [{
      role: "user",
      content:
        `HOME players: ${home.join(", ")}\nAWAY players: ${away.join(", ")}\n\n` +
        `Text: "${text}"\n\nReturn ONLY JSON: {"scoreHome":n,"scoreAway":n,"motm":"Name or null"}. ` +
        `"we/us/our team" means HOME unless the text clearly says away. Match MOTM to a listed name.`,
    }],
    max_tokens: 200, temperature: 0,
  });
  return parseJson(out);
}
