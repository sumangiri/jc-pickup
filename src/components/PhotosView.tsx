"use client";
import { useEffect, useRef, useState } from "react";

async function compress(file: File, maxW = 1280, q = 0.78): Promise<string> {
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

export default function PhotosView() {
  const [photos, setPhotos] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<any>(null);
  const [caption, setCaption] = useState("");
  const [gameDate, setGameDate] = useState("");
  const [pending, setPending] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(query = "") {
    const r = await fetch("/api/photos" + (query ? `?q=${encodeURIComponent(query)}` : ""));
    const j = await r.json();
    if (r.ok) setPhotos(j.photos);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { const t = setTimeout(() => load(q), 300); return () => clearTimeout(t); }, [q]);

  async function upload() {
    if (!pending.length) return;
    setBusy(`Uploading 0/${pending.length}…`); setErr("");
    let done = 0;
    for (const f of pending) {
      try {
        const url = await compress(f);
        const r = await fetch("/api/photos", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, caption: caption || null, gameDate: gameDate || null }),
        });
        if (!r.ok) throw new Error((await r.json()).error);
        done++; setBusy(`Uploading ${done}/${pending.length}…`);
      } catch (e: any) { setErr(e.message); break; }
    }
    setBusy(""); setPending([]); setCaption(""); load(q);
  }

  const groups: Record<string, any[]> = {};
  for (const p of photos) {
    const key = (p.game_date || p.created_at || "").slice(0, 7) || "Undated";
    (groups[key] ||= []).push(p);
  }

  return (
    <>
      <div className="chalk" style={{ marginBottom: 18 }}>
        <div className="eyebrow">Add photos</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            {pending.length ? `${pending.length} selected` : "Choose photos"}
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden
            onChange={(e) => setPending(Array.from(e.target.files || []))} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <label>Caption (searchable)</label>
            <input value={caption} onChange={(e) => setCaption(e.target.value)}
              placeholder="Milan's hat-trick" />
          </div>
          <div>
            <label>Game date</label>
            <input type="date" value={gameDate} onChange={(e) => setGameDate(e.target.value)} />
          </div>
          <button className="btn" onClick={upload} disabled={!!busy || !pending.length}>
            {busy || "Upload"}
          </button>
        </div>
        {err && <div className="err">{err}</div>}
      </div>

      <input value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Search captions, dates (2026-08), uploaders…" style={{ marginBottom: 18 }} />

      {Object.keys(groups).length === 0 && (
        <div className="chalk empty"><h3>No photos yet</h3><p>Be the first after Saturday's game.</p></div>
      )}

      {Object.entries(groups).map(([month, list]) => (
        <div key={month} style={{ marginBottom: 26 }}>
          <div className="eyebrow">{month}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10 }}>
            {list.map((p) => (
              <figure key={p.id} onClick={() => setOpen(p)}
                style={{ margin: 0, cursor: "zoom-in", borderRadius: 10, overflow: "hidden",
                  border: "1px solid var(--line)", aspectRatio: "1", background: "var(--ink-2)" }}>
                <img src={p.url} alt={p.caption || ""} loading="lazy"
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </figure>
            ))}
          </div>
        </div>
      ))}

      {open && (
        <div onClick={() => setOpen(null)} style={{ position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(6,10,18,.9)", display: "grid", placeItems: "center", padding: 20 }}>
          <div style={{ maxWidth: 900, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <img src={open.url} alt="" style={{ width: "100%", borderRadius: 12 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, gap: 12,
              flexWrap: "wrap", alignItems: "center" }} className="mono muted">
              <input value={open.caption || ""} placeholder="Add a caption"
                onChange={(e) => setOpen({ ...open, caption: e.target.value })}
                style={{ flex: 1, minWidth: 180 }} />
              <input type="date" value={open.game_date || ""}
                onChange={(e) => setOpen({ ...open, game_date: e.target.value })} style={{ width: 160 }} />
              <span style={{ fontSize: 11 }}>{open.uploaded_by}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
              <button className="btn sm" onClick={async () => {
                await fetch("/api/photos", { method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: open.id, caption: open.caption, gameDate: open.game_date }) });
                setOpen(null); load(q);
              }}>Save</button>
              <button className="btn ghost sm" onClick={async () => {
                if (!confirm("Remove this photo?")) return;
                const r = await fetch("/api/photos", { method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: open.id }) });
                if (!r.ok) { alert((await r.json()).error); return; }
                setOpen(null); load(q);
              }}>Delete</button>
              <button className="btn ghost sm" onClick={() => setOpen(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
