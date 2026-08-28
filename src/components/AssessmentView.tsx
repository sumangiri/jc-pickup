"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

function Markdown({ text }: { text: string }) {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/^### (.*)$/gm, "<h4>$1</h4>")
    .replace(/^## (.*)$/gm, "<h3>$1</h3>")
    .replace(/^# (.*)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/^- (.*)$/gm, "• $1")
    .replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br/>");
  return <div className="assess-body" dangerouslySetInnerHTML={{ __html: `<p>${html}</p>` }} />;
}

export default function AssessmentView({ rows, canAsk }: { rows: any[]; canAsk: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [idx, setIdx] = useState(0);
  const [q, setQ] = useState("");
  const [qa, setQa] = useState<{ q: string; a: string }[]>([]);
  const router = useRouter();
  const current = rows[idx];

  async function generate() {
    setBusy(true); setErr("");
    const r = await fetch("/api/assessment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generate" }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error);
    setIdx(0); router.refresh();
  }

  async function ask(e: any) {
    e.preventDefault();
    if (!q.trim()) return;
    const question = q.trim(); setQ(""); setBusy(true);
    const r = await fetch("/api/assessment", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ask", question }),
    });
    const j = await r.json();
    setBusy(false);
    setQa((x) => [...x, { q: question, a: r.ok ? j.answer : j.error }]);
  }

  return (
    <>
      <style>{`.assess-body{font-size:15px;line-height:1.75;color:var(--chalk)}
        .assess-body h3{color:var(--amber);font-size:16px;letter-spacing:.02em;margin:20px 0 6px}
        .assess-body h4{color:var(--chalk-dim);font-size:13.5px;margin:16px 0 4px}
        .assess-body p{margin:0 0 12px}`}</style>

      {canAsk && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn" onClick={generate} disabled={busy}>
            {busy ? "Working…" : "Generate this week's assessment"}
          </button>
          {err && <div className="err" style={{ margin: 0 }}>{err}</div>}
        </div>
      )}

      {!current ? (
        <div className="chalk empty">
          <h3>No assessment yet</h3>
          <p>{canAsk ? "Generate the first one above." : "The first weekly assessment will appear here."}</p>
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: canAsk ? "1.5fr 1fr" : "1fr" }}>
          <div className="chalk">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div className="eyebrow" style={{ margin: 0 }}>{current.week_label}</div>
              <div className="mono muted" style={{ fontSize: 11 }}>
                {current.games_covered} games covered
              </div>
            </div>
            <Markdown text={current.content} />
            {rows.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {rows.map((r, i) => (
                  <button key={r.id} className={`btn sm ${i === idx ? "" : "ghost"}`}
                    onClick={() => setIdx(i)}>
                    {r.week_label.replace("Week of ", "")}
                  </button>
                ))}
              </div>
            )}
          </div>

          {canAsk && (
            <div className="chalk">
              <div className="eyebrow">Ask the data</div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
                Super admin only. Answers use every game since day 0.
              </p>
              <div style={{ maxHeight: 380, overflowY: "auto", marginBottom: 10 }}>
                {qa.map((m, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>You: {m.q}</div>
                    <div style={{ fontSize: 13.5, color: "var(--chalk-dim)", marginTop: 4 }}>
                      <Markdown text={m.a} />
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={ask} style={{ display: "flex", gap: 8 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)}
                  placeholder="Who's overperforming?" />
                <button className="btn sm" disabled={busy}>Ask</button>
              </form>
            </div>
          )}
        </div>
      )}
    </>
  );
}
