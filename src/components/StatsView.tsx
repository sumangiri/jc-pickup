"use client";
import { useState } from "react";

const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

export default function StatsView({ rows, k }: { rows: any[]; k: number }) {
  const [tab, setTab] = useState<"table" | "influence">("table");
  const [sel, setSel] = useState<any>(null);
  const [minGp, setMinGp] = useState(4);

  const table = [...rows].filter((r) => r.gp > 0)
    .sort((a, b) => (b.w / (b.gp || 1)) - (a.w / (a.gp || 1)) || b.w - a.w);
  const infl = [...rows].filter((r) => r.gp >= minGp && r.carry !== null)
    .sort((a, b) => b.carry - a.carry);

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`btn sm ${tab === "table" ? "" : "ghost"}`} onClick={() => setTab("table")}>Standings</button>
        <button className={`btn sm ${tab === "influence" ? "" : "ghost"}`} onClick={() => setTab("influence")}>Influence</button>
      </div>

      {tab === "table" ? (
        <div className="chalk" style={{ padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>Player</th><th className="num">W</th><th className="num">GP</th>
              <th className="num">Win%</th><th className="num">MOTM</th></tr></thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.name} onClick={() => setSel(r)} style={{ cursor: "pointer" }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {r.photo ? <img className="avatar" src={r.photo} alt="" />
                        : <div className="avatar">{initials(r.name)}</div>}
                      <div>
                        <div style={{ fontWeight: 600 }}>{r.name}</div>
                        <div className="mono muted" style={{ fontSize: 10.5 }}>{r.pos}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{r.w}</td>
                  <td className="num muted">{r.gp}</td>
                  <td className="num">{Math.round((100 * r.w) / r.gp)}%</td>
                  <td className="num">{r.motm ? <span style={{ color: "var(--amber)" }}>{"★".repeat(r.motm)}</span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 12, lineHeight: 1.6 }}>
            Goals of margin added per game, versus what the rest of the team projected.
            1 point of team-rating gap ≈ {k.toFixed(2)} goals. Minimum{" "}
            <select value={minGp} onChange={(e) => setMinGp(+e.target.value)}
              style={{ width: 62, display: "inline-block", padding: "2px 6px" }}>
              {[3, 4, 5, 6].map((n) => <option key={n}>{n}</option>)}
            </select>{" "}games.
          </div>
          <div className="chalk" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead><tr><th>#</th><th>Player</th><th className="num">Impact</th>
                <th className="num">W–L</th><th className="num">GP</th></tr></thead>
              <tbody>
                {infl.map((r, i) => (
                  <tr key={r.name} onClick={() => setSel(r)} style={{ cursor: "pointer" }}>
                    <td className="mono" style={{ color: i < 3 ? "var(--amber)" : "var(--chalk-faint)", fontWeight: 700 }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="num">
                      <span style={{ background: r.carry > 0 ? "var(--grass)" : "var(--pinnie)",
                        padding: "3px 9px", borderRadius: 6, fontWeight: 800, fontSize: 12.5 }}>
                        {r.carry > 0 ? "+" : ""}{r.carry.toFixed(2)}
                      </span>
                    </td>
                    <td className="num muted">{r.w}–{r.gp - r.w}</td>
                    <td className="num muted">{r.gp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {sel && (
        <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(6,10,18,.72)", display: "grid", placeItems: "center", padding: 20 }}>
          <div className="chalk" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460, width: "100%", background: "var(--ink-2)" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 18 }}>
              {sel.photo ? <img className="avatar" style={{ width: 54, height: 54 }} src={sel.photo} alt="" />
                : <div className="avatar" style={{ width: 54, height: 54, fontSize: 16 }}>{initials(sel.name)}</div>}
              <div>
                <div style={{ fontWeight: 800, fontSize: 19 }}>{sel.name}</div>
                <div className="mono muted" style={{ fontSize: 12 }}>
                  {sel.pos} · {sel.w}–{sel.gp - sel.w} · {sel.gp ? Math.round(100 * sel.w / sel.gp) : 0}%
                </div>
              </div>
            </div>
            {[["Ball control", sel.bc, "#E2B33B"], ["Influence", sel.inf, "#3D63C9"],
              ["Discipline", sel.dis, "#2F7D4F"]].map(([label, v, c]: any) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 5 }}>
                  <span className="muted">{label}</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{v.toFixed(2)}</span>
                </div>
                <div className="meter"><i style={{ width: `${v * 10}%`, background: c }} /></div>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16,
              paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <span className="muted" style={{ fontSize: 13 }}>Overall skill</span>
              <span className="mono" style={{ fontWeight: 900, fontSize: 22, color: "var(--amber)" }}>
                {sel.skill.toFixed(2)}
              </span>
            </div>
            {sel.history.length > 1 && (
              <div style={{ marginTop: 16 }}>
                <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: ".14em", marginBottom: 8 }}>
                  RATING OVER TIME
                </div>
                <Spark data={sel.history.map((h: any) => h.skill)} />
              </div>
            )}
            <button className="btn ghost" style={{ width: "100%", marginTop: 16 }}
              onClick={() => setSel(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

function Spark({ data }: { data: number[] }) {
  const w = 400, h = 60;
  const min = Math.min(...data) - .2, max = Math.max(...data) + .2;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w;
    const y = h - ((v - min) / Math.max(.001, max - min)) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 60 }}>
      <polyline points={pts} fill="none" stroke="var(--amber)" strokeWidth={2}
        strokeLinejoin="round" strokeLinecap="round" />
      {data.map((v, i) => {
        const x = (i / Math.max(1, data.length - 1)) * w;
        const y = h - ((v - min) / Math.max(.001, max - min)) * h;
        return <circle key={i} cx={x} cy={y} r={2.4} fill="var(--amber)" />;
      })}
    </svg>
  );
}
