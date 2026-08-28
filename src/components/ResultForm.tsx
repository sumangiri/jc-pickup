"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResultForm({ game }: { game: any }) {
  const home = JSON.parse(game.home), away = JSON.parse(game.away);
  const [h, setH] = useState(""); const [a, setA] = useState("");
  const [motm, setMotm] = useState(""); const [text, setText] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [ok, setOk] = useState(""); const router = useRouter();

  async function submit(useText: boolean) {
    setBusy(true); setErr(""); setOk("");
    const res = await fetch("/api/result", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(useText
        ? { gameId: game.id, text }
        : { gameId: game.id, scoreHome: +h, scoreAway: +a, motm: motm || null }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error);
    setOk(`Recorded. Model had home at ${j.pHome ?? "–"}% — ratings moved ${j.delta ?? 0}.`);
    router.refresh();
  }

  return (
    <div className="chalk">
      <div className="eyebrow">{game.label || game.date}</div>
      <div className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {home.length} v {away.length}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ color: "var(--pinnie)" }}>Home</label>
          <input className="mono" inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} placeholder="0" />
        </div>
        <div className="muted" style={{ paddingBottom: 12 }}>–</div>
        <div style={{ flex: 1 }}>
          <label style={{ color: "#8FAAF5" }}>Away</label>
          <input className="mono" inputMode="numeric" value={a} onChange={(e) => setA(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>Man of the match</label>
        <select value={motm} onChange={(e) => setMotm(e.target.value)}>
          <option value="">— none —</option>
          {[...home, ...away].map((n: string) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      {err && <div className="err">{err}</div>}
      {ok && <div className="ok">{ok}</div>}
      <button className="btn" style={{ width: "100%" }} disabled={busy || !h || !a}
        onClick={() => submit(false)}>Record result</button>
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
        <label>Or just type it</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={text} onChange={(e) => setText(e.target.value)}
            placeholder="we won 6-5, utsav motm" />
          <button className="btn ghost sm" disabled={busy || !text} onClick={() => submit(true)}>Go</button>
        </div>
      </div>
    </div>
  );
}
