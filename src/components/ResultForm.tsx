"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResultForm({ game, isSuper }: { game: any; isSuper?: boolean }) {
  const home = JSON.parse(game.home), away = JSON.parse(game.away);
  const pending = game.pending_result ? JSON.parse(game.pending_result) : null;
  const [h, setH] = useState(""); const [a, setA] = useState("");
  const [motm, setMotm] = useState(""); const [text, setText] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const [ok, setOk] = useState(""); const router = useRouter();

  async function call(body: any) {
    setBusy(true); setErr("");
    const res = await fetch("/api/result", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: game.id, ...body }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) { setErr(j.error); return null; }
    return j;
  }

  async function doPreview(useText: boolean) {
    const j = await call(useText ? { action: "preview", text }
      : { action: "preview", scoreHome: h, scoreAway: a, motm: motm || null });
    if (j) setPreview(j);
  }

  async function submit() {
    const j = await call({ action: "submit", scoreHome: preview.scoreHome,
      scoreAway: preview.scoreAway, motm: preview.motm });
    if (!j) return;
    setPreview(null);
    setOk(j.published
      ? `Published. Model had home at ${j.pHome}% — ratings moved ${j.delta}.`
      : "Submitted — waiting for Suman to approve it.");
    router.refresh();
  }

  async function decide(action: "approve" | "deny") {
    const j = await call({ action });
    if (!j) return;
    setOk(action === "approve" ? "Approved and published." : "Denied — the game is open again.");
    router.refresh();
  }

  // A result is already waiting on this game
  if (pending) {
    return (
      <div className="chalk">
        <div className="eyebrow">{game.label || game.date}</div>
        <span className="pill pending">awaiting approval</span>
        <div className="mono" style={{ fontSize: 22, fontWeight: 800, margin: "12px 0" }}>
          {pending.scoreHome}–{pending.scoreAway}
          <span className="muted" style={{ fontSize: 13, fontWeight: 400, marginLeft: 10 }}>
            {pending.result === "draw" ? "draw" : pending.result + " win"}
          </span>
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          {pending.motm ? `MOTM ${pending.motm} · ` : ""}submitted by {pending.submittedBy}
        </div>
        {isSuper && (
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="btn green sm" style={{ flex: 1 }} disabled={busy}
              onClick={() => decide("approve")}>Approve & publish</button>
            <button className="btn ghost sm" style={{ flex: 1 }} disabled={busy}
              onClick={() => decide("deny")}>Deny</button>
          </div>
        )}
        {err && <div className="err">{err}</div>}
        {ok && <div className="ok">{ok}</div>}
      </div>
    );
  }

  return (
    <div className="chalk">
      <div className="eyebrow">{game.label || game.date}</div>
      <div className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {home.length} v {away.length}
      </div>

      {preview ? (
        <>
          <div style={{ padding: "14px 0", borderTop: "1px solid var(--line)",
            borderBottom: "1px solid var(--line)", marginBottom: 14 }}>
            <div className="mono" style={{ fontSize: 26, fontWeight: 900 }}>
              {preview.scoreHome}–{preview.scoreAway}
            </div>
            <div style={{ fontSize: 13.5, marginTop: 6 }}>
              <span className={`pill ${preview.result}`}>
                {preview.result === "draw" ? "draw" : preview.result + " win"}
              </span>
              {preview.motm && <span className="pill amber" style={{ marginLeft: 6 }}>★ {preview.motm}</span>}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
              Model had home at {preview.pHome}% — ratings will move ±{Math.abs(preview.delta)}.
            </div>
          </div>
          {err && <div className="err">{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" style={{ flex: 1 }} disabled={busy} onClick={submit}>
              {isSuper ? "Publish result" : "Submit for approval"}
            </button>
            <button className="btn ghost" disabled={busy} onClick={() => setPreview(null)}>Edit</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ color: "var(--pinnie)" }}>Home</label>
              <input className="mono" inputMode="numeric" value={h}
                onChange={(e) => setH(e.target.value)} placeholder="0" />
            </div>
            <div className="muted" style={{ paddingBottom: 12 }}>–</div>
            <div style={{ flex: 1 }}>
              <label style={{ color: "#8FAAF5" }}>Away</label>
              <input className="mono" inputMode="numeric" value={a}
                onChange={(e) => setA(e.target.value)} placeholder="0" />
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
            onClick={() => doPreview(false)}>Review result</button>
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <label>Or just type it</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={text} onChange={(e) => setText(e.target.value)}
                placeholder="we won 6-5, utsav motm" />
              <button className="btn ghost sm" disabled={busy || !text}
                onClick={() => doPreview(true)}>Review</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
