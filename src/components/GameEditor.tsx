"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function compress(file: File, maxW = 1500, q = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((res) => {
    const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file);
  });
  const img = new Image(); img.src = dataUrl;
  await new Promise((r) => (img.onload = r));
  const scale = Math.min(1, maxW / img.width);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}

export default function GameEditor({ game, onClose }: { game?: any; onClose: () => void }) {
  const [date, setDate] = useState(game?.date || new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState(game?.label || "");
  const [home, setHome] = useState(game ? game.home.join(", ") : "");
  const [away, setAway] = useState(game ? game.away.join(", ") : "");
  const [sh, setSh] = useState(game?.score_home ?? "");
  const [sa, setSa] = useState(game?.score_away ?? "");
  const [motm, setMotm] = useState(game?.motm || "");
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const router = useRouter();

  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/games", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: game?.id, date, label, home, away,
        scoreHome: sh, scoreAway: sa, motm: motm || null, sheetUrl,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(j.error);
    onClose(); router.refresh();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 95,
      background: "rgba(6,10,18,.78)", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="chalk" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: "100%", background: "var(--ink-2)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="eyebrow">{game ? `Edit game · ${game.date}` : "Import a game"}</div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
          For games run outside the app (e.g. through Claude). Facts only — this never re-runs rating drift.
        </p>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
          <div><label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Sat 8:00 AM" /></div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "var(--pinnie)" }}>Home · Pinnies (comma-separated)</label>
          <textarea rows={2} value={home} onChange={(e) => setHome(e.target.value)}
            placeholder="Suman, Milan, Utsav…" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ color: "#8FAAF5" }}>Away · No Pinnies</label>
          <textarea rows={2} value={away} onChange={(e) => setAway(e.target.value)} />
        </div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1.4fr", gap: 12, marginBottom: 12 }}>
          <div><label>Home score</label>
            <input className="mono" inputMode="numeric" value={sh} onChange={(e) => setSh(e.target.value)} /></div>
          <div><label>Away score</label>
            <input className="mono" inputMode="numeric" value={sa} onChange={(e) => setSa(e.target.value)} /></div>
          <div><label>MOTM</label>
            <input value={motm} onChange={(e) => setMotm(e.target.value)} placeholder="exact name" /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label>Team sheet image (optional, kept for posterity)</label>
          <input type="file" accept="image/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setSheetUrl(await compress(f));
            }} />
          {sheetUrl && <img src={sheetUrl} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 8 }} />}
          {game?.sheet_url && !sheetUrl && (
            <img src={game.sheet_url} alt="" style={{ width: "100%", borderRadius: 8, marginTop: 8, opacity: .85 }} />
          )}
        </div>
        {err && <div className="err">{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={save} disabled={busy}>
            {busy ? "Saving…" : game ? "Save changes" : "Import game"}
          </button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
