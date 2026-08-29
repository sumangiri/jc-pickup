"use client";
import { useState } from "react";
import GameEditor from "./GameEditor";

export default function GamesBrowser({ games, admin, isSuper }: { games: any[]; admin?: boolean; isSuper?: boolean }) {
  const [busy, setBusy] = useState(false);
  async function post(url: string, body: any) {
    setBusy(true);
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) { alert(j.error); return; }
    location.reload();
  }
  const [editing, setEditing] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const term = q.trim().toLowerCase();
  const shown = !term ? games : games.filter((g) =>
    g.date.includes(term) || (g.label || "").toLowerCase().includes(term) ||
    `${g.score_home}-${g.score_away}` === term ||
    [...g.home, ...g.away].some((n: string) => n.toLowerCase().includes(term)) ||
    (g.motm || "").toLowerCase().includes(term));

  const played = games.filter((g) => g.result);
  const goals = played.reduce((a, g) => a + (g.score_home || 0) + (g.score_away || 0), 0);
  const homeW = played.filter((g) => g.result === "home").length;

  return (
    <>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 18 }}>
        <Stat k="Games played" v={played.length} />
        <Stat k="Goals" v={goals} />
        <Stat k="Goals / game" v={played.length ? (goals / played.length).toFixed(1) : "—"} />
        <Stat k="Home / Away" v={`${homeW} – ${played.length - homeW}`} />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search date, player, score…" style={{ flex: 1 }} />
        {admin && <button className="btn ghost" onClick={() => setImporting(true)}>Import game</button>}
      </div>
      <div className="chalk" style={{ padding: 0, overflow: "hidden" }}>
        <table>
          <thead>
            <tr><th>Date</th><th>Label</th><th className="num">Score</th><th>Result</th><th>MOTM</th><th></th></tr>
          </thead>
          <tbody>
            {shown.map((g) => (
              <>
                <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => setOpen(open === g.id ? null : g.id)}>
                  <td className="mono">{g.date}</td>
                  <td className="muted">{g.label || "—"}</td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {g.result ? `${g.score_home}–${g.score_away}` : <span className="muted">pending</span>}
                  </td>
                  <td>
                    {g.result ? <span className={`pill ${g.result}`}>{g.result}</span>
                      : g.pending_result ? <span className="pill pending">result pending</span> : "—"}
                    {g.approval_status === "pending" && <span className="pill pending" style={{ marginLeft: 6 }}>unapproved</span>}
                  </td>
                  <td>{g.motm ? <span className="pill amber">★ {g.motm.split(" ")[0]}</span> : <span className="muted">—</span>}</td>
                  <td className="muted mono" style={{ fontSize: 11 }}>{open === g.id ? "−" : "+"}</td>
                </tr>
                {open === g.id && (
                  <tr key={g.id + "d"}>
                    <td colSpan={6} style={{ background: "rgba(255,255,255,.02)" }}>
                      <div style={{ display: "flex", gap: 26, flexWrap: "wrap", padding: "6px 0" }}>
                        <Side title="Home · Pinnies" color="var(--pinnie)" names={g.home} cap={g.captains?.home} />
                        <Side title="Away · No pinnies" color="#8FAAF5" names={g.away} cap={g.captains?.away} />
                      </div>
                      {g.swing && <div className="muted mono" style={{ fontSize: 11.5 }}>⇄ {g.swing} switched at half</div>}
                      {g.sheet_url && <img src={g.sheet_url} alt="team sheet" style={{ maxWidth: 480, width: "100%", borderRadius: 8, marginTop: 10, border: "1px solid var(--line)" }} />}
                      {(admin || isSuper) && (
                        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {admin && <button className="btn ghost sm"
                            onClick={(e) => { e.stopPropagation(); setEditing(g); }}>Edit game</button>}
                          {g.sheet_url && <a className="btn ghost sm" href={g.sheet_url}
                            download={`jc-pickup-${g.date}.png`} onClick={(e) => e.stopPropagation()}>Download sheet</a>}
                          {isSuper && g.result && <button className="btn ghost sm" disabled={busy}
                            onClick={(e) => { e.stopPropagation();
                              if (confirm("Unpublish this result? Player ratings will be restored to their pre-game values.")) post("/api/result", { action: "unpublish", gameId: g.id }); }}>Unpublish result</button>}
                          {isSuper && <button className="btn ghost sm" disabled={busy}
                            onClick={(e) => { e.stopPropagation();
                              if (confirm("Delete this game permanently?")) post("/api/games", { action: "delete", gameId: g.id }); }}>Delete game</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <div className="empty"><h3>Nothing matches “{q}”</h3><p>Try a player name or a date.</p></div>}
      </div>
      {(importing || editing) && (
        <GameEditor game={editing || undefined} onClose={() => { setImporting(false); setEditing(null); }} />
      )}
    </>
  );
}

function Side({ title, color, names, cap }: any) {
  return (
    <div style={{ minWidth: 190 }}>
      <div className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color, marginBottom: 6 }}>
        {title.toUpperCase()}
      </div>
      {names.map((n: string) => (
        <div key={n} style={{ fontSize: 13, padding: "2px 0" }}>
          {n}{n === cap && <span className="pill amber" style={{ marginLeft: 6, fontSize: 9 }}>C</span>}
        </div>
      ))}
    </div>
  );
}

function Stat({ k, v }: any) {
  return (
    <div className="chalk" style={{ padding: 16 }}>
      <div className="mono" style={{ fontSize: 10.5, letterSpacing: ".14em", color: "var(--chalk-dim)" }}>
        {k.toUpperCase()}
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, marginTop: 4 }}>{v}</div>
    </div>
  );
}
