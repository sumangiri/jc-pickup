"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const LABEL: any = { ballControl: "Ball control", influence: "Influence",
  discipline: "Discipline", primaryPos: "Primary position", secondary: "Secondary position" };

export default function ApprovalsView({ proposals, games, results }: any) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const pendingProps = proposals.filter((r: any) => r.status === "pending");
  const done = proposals.filter((r: any) => r.status !== "pending").slice(0, 10);

  async function post(url: string, body: any) {
    setBusy(true); setErr("");
    const r = await fetch(url, { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error);
    router.refresh();
  }

  const nothing = !pendingProps.length && !games.length && !results.length;

  return (
    <>
      {err && <div className="err">{err}</div>}
      {nothing && (
        <div className="chalk empty"><h3>All clear</h3>
          <p>Submitted games, results and rating changes land here.</p></div>
      )}

      {games.length > 0 && (
        <>
          <div className="eyebrow">Game submissions · {games.length}</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", marginBottom: 26 }}>
            {games.map((g: any) => (
              <div key={g.id} className="chalk">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{g.label || g.date}</b>
                  <span className="mono muted" style={{ fontSize: 11 }}>by {g.submitted_by}</span>
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 130 }}>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--pinnie)", letterSpacing: ".12em" }}>HOME</div>
                    {g.home.map((n: string) => <div key={n} style={{ fontSize: 13 }}>{n}</div>)}
                  </div>
                  <div style={{ minWidth: 130 }}>
                    <div className="mono" style={{ fontSize: 10.5, color: "#8FAAF5", letterSpacing: ".12em" }}>AWAY</div>
                    {g.away.map((n: string) => <div key={n} style={{ fontSize: 13 }}>{n}</div>)}
                  </div>
                </div>
                {g.sheet_url && <img src={g.sheet_url} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 12 }} />}
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn green sm" style={{ flex: 1 }} disabled={busy}
                    onClick={() => post("/api/games", { action: "approve", gameId: g.id })}>Approve</button>
                  <button className="btn ghost sm" style={{ flex: 1 }} disabled={busy}
                    onClick={() => confirm("Deny and delete this game submission?") &&
                      post("/api/games", { action: "deny", gameId: g.id })}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {results.length > 0 && (
        <>
          <div className="eyebrow">Result submissions · {results.length}</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", marginBottom: 26 }}>
            {results.map((g: any) => (
              <div key={g.id} className="chalk">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <b>{g.label || g.date}</b>
                  <span className="mono muted" style={{ fontSize: 11 }}>by {g.pending.submittedBy}</span>
                </div>
                <div className="mono" style={{ fontSize: 28, fontWeight: 900, margin: "10px 0 4px" }}>
                  {g.pending.scoreHome}–{g.pending.scoreAway}
                </div>
                <div style={{ fontSize: 13 }}>
                  <span className={`pill ${g.pending.result}`}>
                    {g.pending.result === "draw" ? "draw" : g.pending.result + " win"}</span>
                  {g.pending.motm && <span className="pill amber" style={{ marginLeft: 6 }}>★ {g.pending.motm}</span>}
                </div>
                <div className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
                  Model had home at {g.pending.pHome}% — ratings will move ±{Math.abs(g.pending.delta)}.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn green sm" style={{ flex: 1 }} disabled={busy}
                    onClick={() => post("/api/result", { action: "approve", gameId: g.id })}>Approve & publish</button>
                  <button className="btn ghost sm" style={{ flex: 1 }} disabled={busy}
                    onClick={() => post("/api/result", { action: "deny", gameId: g.id })}>Deny</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {pendingProps.length > 0 && (
        <>
          <div className="eyebrow">Rating changes · {pendingProps.length}</div>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", marginBottom: 26 }}>
            {pendingProps.map((r: any) => (
              <div key={r.id} className="chalk">
                <div className="eyebrow">{r.player_name}</div>
                <div style={{ margin: "10px 0 14px" }}>
                  <div className="muted" style={{ fontSize: 11.5 }}>{LABEL[r.field] || r.field}</div>
                  <div className="mono" style={{ fontSize: 20, fontWeight: 800 }}>
                    <span className="muted">{r.old_value}</span>
                    <span style={{ color: "var(--amber)", margin: "0 8px" }}>→</span>
                    <span>{r.new_value}</span>
                  </div>
                </div>
                <div className="muted" style={{ fontSize: 12, marginBottom: 12 }}>proposed by {r.proposer || "—"}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn green sm" style={{ flex: 1 }} disabled={busy}
                    onClick={() => post("/api/proposals", { id: r.id, decision: "approved" })}>Approve</button>
                  <button className="btn ghost sm" style={{ flex: 1 }} disabled={busy}
                    onClick={() => post("/api/proposals", { id: r.id, decision: "rejected" })}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="eyebrow">Recently decided</div>
          <div className="chalk" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead><tr><th>Player</th><th>Change</th><th>By</th><th>Status</th></tr></thead>
              <tbody>
                {done.map((r: any) => (
                  <tr key={r.id}>
                    <td>{r.player_name}</td>
                    <td className="mono muted">{LABEL[r.field] || r.field} {r.old_value} → {r.new_value}</td>
                    <td className="muted">{r.proposer || "—"}</td>
                    <td><span className={`pill ${r.status === "approved" ? "away" : "home"}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
