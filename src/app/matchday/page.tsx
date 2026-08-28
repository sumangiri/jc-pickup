"use client";
import { useState, useRef } from "react";
import TeamSheet from "@/components/TeamSheet";

export default function Matchday() {
  const [images, setImages] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<any>(null);
  const [three, setThree] = useState<any>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState("");
  const [log, setLog] = useState<{ who: string; text: string }[]>([]);
  const [label, setLabel] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr("");
    const arr: string[] = [];
    for (const f of Array.from(files)) {
      arr.push(await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(f);
      }));
    }
    setImages(arr);
    setBusy("Reading the poll…");
    const r = await fetch("/api/extract", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: arr }),
    });
    const j = await r.json();
    setBusy("");
    if (!r.ok) return setErr(j.error);
    setNames(j.names);
    setManual(j.names.join(", "));
  }

  async function makeTeams(mode: "two" | "three", seed?: number) {
    setErr(""); setMsg(""); setBusy("Balancing…");
    const list = manual.split(",").map((s) => s.trim()).filter(Boolean);
    const r = await fetch("/api/teams", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: list, mode, seed: seed || Math.floor(Math.random() * 1e6) }),
    });
    const j = await r.json();
    setBusy("");
    if (!r.ok) { setErr(j.error); setMissing(j.missing || []); return; }
    setMissing(j.missing || []);
    if (mode === "three") { setThree(j.teams); setResult(null); }
    else { setResult(j); setThree(null); }
  }

  async function saveGame() {
    if (!result) return;
    setBusy("Saving…");
    const r = await fetch("/api/teams", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        names: [...result.home, ...result.away].map((p: any) => p.name),
        save: true, label: label || null, seed: 12345,
      }),
    });
    const j = await r.json();
    setBusy("");
    if (!r.ok) return setErr(j.error);
    setMsg("Saved. Enter the score on the Results page when you're done playing.");
  }

  async function sendChat(e: any) {
    e.preventDefault();
    if (!chat.trim() || !result) return;
    const instruction = chat.trim();
    setLog((l) => [...l, { who: "you", text: instruction }]);
    setChat(""); setBusy("Applying…");
    const r = await fetch("/api/edit", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction,
        home: result.home.map((p: any) => p.name),
        away: result.away.map((p: any) => p.name),
      }),
    });
    const j = await r.json();
    if (!r.ok) { setBusy(""); setLog((l) => [...l, { who: "app", text: j.error }]); return; }

    let home = [...result.home], away = [...result.away];
    const find = (n: string) =>
      [...home, ...away].find((p) => p.name.toLowerCase().includes(String(n).toLowerCase()));
    let note = "";
    for (const op of j.ops) {
      if (op.op === "reroll") { setBusy(""); await makeTeams("two"); setLog((l) => [...l, { who: "app", text: "Re-rolled the split." }]); return; }
      if (op.op === "swap") {
        const a = find(op.a), b = find(op.b);
        if (!a || !b) { note = `Couldn't find ${op.a} or ${op.b}.`; continue; }
        const aHome = home.some((p) => p.name === a.name);
        home = home.filter((p) => p.name !== a.name && p.name !== b.name);
        away = away.filter((p) => p.name !== a.name && p.name !== b.name);
        if (aHome) { home.push(b); away.push(a); } else { home.push(a); away.push(b); }
        note = `Swapped ${a.name.split(" ")[0]} and ${b.name.split(" ")[0]}.`;
      }
      if (op.op === "move") {
        const p = find(op.player);
        if (!p) { note = `Couldn't find ${op.player}.`; continue; }
        home = home.filter((x) => x.name !== p.name);
        away = away.filter((x) => x.name !== p.name);
        (op.to === "home" ? home : away).push(p);
        note = `Moved ${p.name.split(" ")[0]} to ${op.to}.`;
      }
      if (op.op === "remove") {
        const p = find(op.player);
        if (!p) { note = `Couldn't find ${op.player}.`; continue; }
        home = home.filter((x) => x.name !== p.name);
        away = away.filter((x) => x.name !== p.name);
        note = `Removed ${p.name.split(" ")[0]}.`;
      }
    }
    const sum = (t: any[]) => +t.reduce((a, p) => a + p.skill, 0).toFixed(2);
    const top = (t: any[]) => t.reduce((m, p) => (p.skill > m.skill ? p : m), t[0])?.name;
    setResult({
      ...result, home, away, skillHome: sum(home), skillAway: sum(away),
      captainHome: top(home), captainAway: top(away),
      swing: home.length === away.length ? null : result.swing,
    });
    setBusy("");
    setLog((l) => [...l, { who: "app", text: note || "Done." }]);
  }

  const count = manual.split(",").map((s) => s.trim()).filter(Boolean).length;

  return (
    <>
      <h1 className="page">Matchday</h1>
      <p className="sub">Drop the poll screenshots, get two balanced sides.</p>

      <div className="grid" style={{ gridTemplateColumns: "1fr", marginBottom: 18 }}>
        <div className="chalk">
          <div className="eyebrow">Step 1 · Who's in</div>
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
            style={{
              border: "1.5px dashed var(--line-strong)", borderRadius: 12, padding: "26px 18px",
              textAlign: "center", cursor: "pointer", marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              {images.length ? `${images.length} screenshot${images.length > 1 ? "s" : ""} loaded` : "Drop WhatsApp poll screenshots"}
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>or tap to choose files</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => onFiles(e.target.files)} />

          <label>Attendees {count > 0 && <span style={{ color: "var(--amber)" }}>· {count}</span>}</label>
          <textarea rows={3} value={manual} onChange={(e) => setManual(e.target.value)}
            placeholder="Comma-separated names — edit freely before balancing" />

          {missing.length > 0 && (
            <div className="err" style={{ marginTop: 10 }}>
              Not on the roster: {missing.join(", ")} — add them on the Roster page first.
            </div>
          )}
          {err && <div className="err">{err}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn" disabled={!!busy || count < 2} onClick={() => makeTeams("two")}>
              {busy || "Make two teams"}
            </button>
            <button className="btn ghost" disabled={!!busy || count < 3} onClick={() => makeTeams("three")}>
              Three teams
            </button>
            {result && (
              <button className="btn ghost" disabled={!!busy} onClick={() => makeTeams("two")}>
                Re-roll
              </button>
            )}
          </div>
        </div>
      </div>

      {result && (
        <>
          <TeamSheet result={result} label={label} />
          <div className="grid" style={{ gridTemplateColumns: "1.3fr 1fr", marginTop: 18 }}>
            <div className="chalk">
              <div className="eyebrow">Adjust</div>
              <div style={{ minHeight: 60, marginBottom: 10 }}>
                {log.length === 0 && (
                  <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                    Try “swap Milan and Utsav”, “Kwasi didn't show”, or “move GP to away”.
                  </p>
                )}
                {log.map((m, i) => (
                  <div key={i} style={{ fontSize: 13.5, marginBottom: 6,
                    color: m.who === "you" ? "var(--chalk)" : "var(--amber)" }}>
                    <b className="mono" style={{ fontSize: 11, opacity: .7 }}>
                      {m.who === "you" ? "YOU" : "APP"}
                    </b>{" "}{m.text}
                  </div>
                ))}
              </div>
              <form onSubmit={sendChat} style={{ display: "flex", gap: 8 }}>
                <input value={chat} onChange={(e) => setChat(e.target.value)}
                  placeholder="Type a change…" />
                <button className="btn sm" disabled={!!busy}>Apply</button>
              </form>
            </div>
            <div className="chalk">
              <div className="eyebrow">Balance check</div>
              <Row k="Skill" v={`${result.skillHome} vs ${result.skillAway}`} />
              <Row k="Ball control gap" v={result.dimGap.ballControl} />
              <Row k="Influence gap" v={result.dimGap.influence} />
              <Row k="Discipline gap" v={result.dimGap.discipline} />
              <Row k="Loyalty kept" v={`${result.loyaltyKept}/${result.loyaltyTotal}`} />
              <div style={{ marginTop: 14 }}>
                <label>Label (optional)</label>
                <input value={label} onChange={(e) => setLabel(e.target.value)}
                  placeholder="Sat Aug 29 · 8:00 AM" />
              </div>
              <button className="btn" style={{ width: "100%", marginTop: 12 }}
                onClick={saveGame} disabled={!!busy}>Save this game</button>
              {msg && <div className="ok">{msg}</div>}
            </div>
          </div>
        </>
      )}

      {three && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          {three.map((t: any[], i: number) => (
            <div className="chalk" key={i}>
              <div className="eyebrow">
                Team {i + 1} · {["Pinnies", "Dark", "White"][i]}
              </div>
              <div className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>
                avg {(t.reduce((a, p) => a + p.skill, 0) / t.length).toFixed(2)} · {t.length} players
              </div>
              {t.map((p) => (
                <div key={p.name} style={{ display: "flex", justifyContent: "space-between",
                  padding: "6px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
                  <span>{p.name}</span>
                  <span className="mono muted" style={{ fontSize: 12 }}>{p.primaryPos}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Row({ k, v }: any) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0",
      borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
      <span className="muted">{k}</span>
      <span className="mono" style={{ fontWeight: 700 }}>{v}</span>
    </div>
  );
}
