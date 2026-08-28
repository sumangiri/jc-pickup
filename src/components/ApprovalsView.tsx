"use client";
import { useRouter } from "next/navigation";

const LABEL: any = { ballControl: "Ball control", influence: "Influence", discipline: "Discipline" };

export default function ApprovalsView({ rows }: { rows: any[] }) {
  const router = useRouter();
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending").slice(0, 12);

  async function decide(id: string, decision: string) {
    await fetch("/api/proposals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    router.refresh();
  }

  return (
    <>
      {pending.length === 0 ? (
        <div className="chalk empty"><h3>Nothing to review</h3>
          <p>Rating changes proposed by admins will appear here.</p></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
          {pending.map((r) => (
            <div key={r.id} className="chalk">
              <div className="eyebrow">{r.player_name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "10px 0 16px" }}>
                <div>
                  <div className="muted" style={{ fontSize: 11.5 }}>{LABEL[r.field] || r.field}</div>
                  <div className="mono" style={{ fontSize: 22, fontWeight: 800 }}>
                    <span className="muted">{(+r.old_value).toFixed(2)}</span>
                    <span style={{ color: "var(--amber)", margin: "0 8px" }}>→</span>
                    <span>{(+r.new_value).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 14 }}>
                proposed by {r.proposer || "—"}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn green sm" style={{ flex: 1 }}
                  onClick={() => decide(r.id, "approved")}>Approve</button>
                <button className="btn ghost sm" style={{ flex: 1 }}
                  onClick={() => decide(r.id, "rejected")}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <div className="eyebrow" style={{ marginTop: 32 }}>Decided</div>
          <div className="chalk" style={{ padding: 0, overflow: "hidden" }}>
            <table>
              <thead><tr><th>Player</th><th>Change</th><th>By</th><th>Status</th></tr></thead>
              <tbody>
                {done.map((r) => (
                  <tr key={r.id}>
                    <td>{r.player_name}</td>
                    <td className="mono muted">{LABEL[r.field]} {(+r.old_value).toFixed(2)} → {(+r.new_value).toFixed(2)}</td>
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
