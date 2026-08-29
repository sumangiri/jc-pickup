"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
const DIMS = [
  { key: "ballControl", col: "ball_control", label: "Ball control", color: "#E2B33B" },
  { key: "influence", col: "influence", label: "Influence", color: "#3D63C9" },
  { key: "discipline", col: "discipline", label: "Discipline", color: "#2F7D4F" },
];

export default function RosterView({ players, users, canEdit, isSuper }: any) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [showUsers, setShowUsers] = useState(false);
  const [adding, setAdding] = useState(false);
  const [edit, setEdit] = useState<any>(null);
  const router = useRouter();

  async function api(body: any) {
    const r = await fetch("/api/players", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error); return null; }
    router.refresh();
    return j;
  }

  const shown = players.filter((p: any) =>
    !q.trim() || p.name.toLowerCase().includes(q.toLowerCase()) ||
    (p.aliases || "").toLowerCase().includes(q.toLowerCase()));

  async function propose(field: string, value: number) {
    const r = await fetch("/api/players", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "propose", playerId: sel.id, field, newValue: value }),
    });
    const j = await r.json();
    if (!r.ok) return setMsg(j.error);
    setMsg(j.applied ? "Applied." : "Sent to the super admin for approval.");
    router.refresh();
  }

  async function uploadPhoto(file: File) {
    const dataUrl = await new Promise<string>((res) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file);
    });
    const img = new Image();
    img.src = dataUrl;
    await new Promise((r) => (img.onload = r));
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d")!;
    const s = Math.min(img.width, img.height);
    ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
    const out = c.toDataURL("image/jpeg", 0.82);
    const r = await fetch("/api/players", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "photo", playerId: sel.id, photoUrl: out }),
    });
    if (r.ok) { setSel({ ...sel, photo_url: out }); setMsg("Photo updated."); router.refresh(); }
  }

  async function setRole(userId: string, role: string) {
    await fetch("/api/players", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "role", userId, role }),
    });
    router.refresh();
  }

  return (
    <>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a player…"
          style={{ flex: 1, minWidth: 200 }} />
        {canEdit && <button className="btn" onClick={() => setAdding(true)}>Add player</button>}
        {isSuper && (
          <button className="btn ghost" onClick={() => setShowUsers(!showUsers)}>
            {showUsers ? "Hide accounts" : "Manage accounts"}
          </button>
        )}
      </div>

      {showUsers && (
        <div className="chalk" style={{ marginBottom: 18, padding: 0, overflow: "hidden" }}>
          <table>
            <thead><tr><th>Account</th><th>Role</th><th></th></tr></thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.username}</td>
                  <td><span className={`pill ${u.role === "superadmin" ? "amber" : ""}`}>{u.role}</span></td>
                  <td className="num">
                    {u.role !== "superadmin" && (
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button className="btn ghost sm"
                          onClick={() => setRole(u.id, u.role === "admin" ? "member" : "admin")}>
                          {u.role === "admin" ? "Make member" : "Make admin"}
                        </button>
                        <button className="btn ghost sm" onClick={async () => {
                          const pw = prompt(`New temporary password for ${u.username}:`);
                          if (pw) { await api({ action: "resetPassword", userId: u.id, tempPassword: pw });
                            setMsg(`Password reset for ${u.username}.`); }
                        }}>Reset password</button>
                        <button className="btn ghost sm" onClick={() => {
                          if (confirm(`Delete the account "${u.username}"? Their game history is unaffected.`))
                            api({ action: "deleteUser", userId: u.id });
                        }}>Delete</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
        {shown.map((p: any) => (
          <div key={p.id} className="chalk" style={{ padding: 16, cursor: "pointer",
            opacity: p.active ? 1 : 0.45 }}
            onClick={() => { setSel(p); setMsg(""); setEdit(null); }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12 }}>
              {p.photo_url ? <img className="avatar" src={p.photo_url} alt="" />
                : <div className="avatar">{initials(p.name)}</div>}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                <div className="mono muted" style={{ fontSize: 10.5 }}>
                  {p.primary_pos}{p.secondary ? `/${p.secondary}` : ""}{p.active ? "" : " · retired"}
                </div>
              </div>
              <div style={{ marginLeft: "auto", fontFamily: "JetBrains Mono", fontWeight: 900,
                fontSize: 19, color: "var(--amber)" }}>{p.skill.toFixed(1)}</div>
            </div>
            {DIMS.map((d) => (
              <div key={d.key} style={{ marginBottom: 6 }}>
                <div className="meter"><i style={{ width: `${p[d.col] * 10}%`, background: d.color }} /></div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {sel && (
        <div onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, zIndex: 90,
          background: "rgba(6,10,18,.72)", display: "grid", placeItems: "center", padding: 20 }}>
          <div className="chalk" onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440, width: "100%", background: "var(--ink-2)",
              maxHeight: "88vh", overflowY: "auto" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 16 }}>
              {sel.photo_url ? <img className="avatar" style={{ width: 56, height: 56 }} src={sel.photo_url} alt="" />
                : <div className="avatar" style={{ width: 56, height: 56, fontSize: 17 }}>{initials(sel.name)}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{sel.name}</div>
                {sel.phone && <div className="mono muted" style={{ fontSize: 11.5 }}>{sel.phone}</div>}
              </div>
              <div style={{ fontFamily: "JetBrains Mono", fontWeight: 900, fontSize: 26,
                color: "var(--amber)" }}>{sel.skill.toFixed(2)}</div>
            </div>

            {canEdit && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <label className="btn ghost sm" style={{ display: "inline-block" }}>
                  Upload photo
                  <input type="file" accept="image/*" hidden
                    onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
                </label>
                <button className="btn ghost sm" onClick={() => setEdit(edit ? null : {
                  aliases: sel.aliases || "", phone: sel.phone || "",
                  primaryPos: sel.primary_pos, secondary: sel.secondary || "" })}>
                  {edit ? "Cancel edit" : "Edit details"}
                </button>
                {isSuper && (
                  <button className="btn ghost sm" onClick={async () => {
                    const n = prompt("New name for this player:", sel.name);
                    if (n && n !== sel.name) {
                      const j = await api({ action: "rename", playerId: sel.id, newName: n });
                      if (j) { setMsg(`Renamed to ${n} — past games updated.`); setSel({ ...sel, name: n }); }
                    }
                  }}>Rename</button>
                )}
                {isSuper && (
                  <button className="btn ghost sm" onClick={async () => {
                    const next = !sel.active;
                    if (confirm(next ? "Bring this player back into the pool?"
                      : "Retire this player? They stay in past games but won't be picked.")) {
                      await api({ action: "active", playerId: sel.id, active: next });
                      setSel({ ...sel, active: next });
                    }
                  }}>{sel.active ? "Retire" : "Un-retire"}</button>
                )}
              </div>
            )}

            {edit && (
              <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--line)" }}>
                <label>Also known as (comma-separated — used to match poll names)</label>
                <input value={edit.aliases} onChange={(e) => setEdit({ ...edit, aliases: e.target.value })} />
                <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                  <div><label>Phone</label>
                    <input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></div>
                  <div><label>Primary</label>
                    <select value={edit.primaryPos} onChange={(e) => setEdit({ ...edit, primaryPos: e.target.value })}>
                      {["D", "M", "A"].map((x) => <option key={x}>{x}</option>)}
                    </select></div>
                  <div><label>Secondary</label>
                    <select value={edit.secondary} onChange={(e) => setEdit({ ...edit, secondary: e.target.value })}>
                      <option value="">—</option>
                      {["D", "M", "A"].map((x) => <option key={x}>{x}</option>)}
                    </select></div>
                </div>
                <button className="btn sm" style={{ marginTop: 10 }} onClick={async () => {
                  const j = await api({ action: "identity", playerId: sel.id, ...edit });
                  if (j) { setSel({ ...sel, aliases: edit.aliases, phone: edit.phone,
                    primary_pos: edit.primaryPos, secondary: edit.secondary || null });
                    setEdit(null); setMsg("Details saved."); }
                }}>Save details</button>
              </div>
            )}

            {DIMS.map((d) => (
              <div key={d.key} style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span className="muted" style={{ fontSize: 12.5 }}>{d.label}</span>
                  <span className="mono" style={{ fontWeight: 700 }}>{sel[d.col].toFixed(2)}</span>
                </div>
                <div className="meter" style={{ marginBottom: 8 }}>
                  <i style={{ width: `${sel[d.col] * 10}%`, background: d.color }} />
                </div>
                {canEdit && (
                  <input type="range" min={1} max={10} step={0.25} defaultValue={sel[d.col]}
                    onMouseUp={(e: any) => propose(d.key, +e.target.value)}
                    onTouchEnd={(e: any) => propose(d.key, +e.target.value)}
                    style={{ width: "100%", padding: 0, background: "transparent", border: "none" }} />
                )}
              </div>
            ))}
            {msg && <div className="ok">{msg}</div>}
            {canEdit && !isSuper && (
              <p className="muted" style={{ fontSize: 12 }}>
                Your changes go to the super admin for approval.
              </p>
            )}
            <button className="btn ghost" style={{ width: "100%", marginTop: 12 }}
              onClick={() => setSel(null)}>Close</button>
          </div>
        </div>
      )}

      {adding && <AddPlayer onClose={() => setAdding(false)} onSaved={() => { setAdding(false); router.refresh(); }} />}
    </>
  );
}

function AddPlayer({ onClose, onSaved }: any) {
  const [f, setF] = useState<any>({ name: "", aliases: "", phone: "", primaryPos: "D",
    secondary: "", ballControl: 4, influence: 4, discipline: 4 });
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const skill = (0.4 * f.ballControl + 0.35 * f.influence + 0.25 * f.discipline).toFixed(2);

  async function save() {
    setBusy(true); setErr("");
    const r = await fetch("/api/players", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...f }) });
    const j = await r.json(); setBusy(false);
    if (!r.ok) return setErr(j.error);
    onSaved();
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 95,
      background: "rgba(6,10,18,.78)", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="chalk" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460, width: "100%", background: "var(--ink-2)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="eyebrow">Add player</div>
        <div style={{ marginBottom: 10 }}><label>Name</label>
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div style={{ marginBottom: 10 }}><label>Also known as (comma-separated)</label>
          <input value={f.aliases} onChange={(e) => setF({ ...f, aliases: e.target.value })}
            placeholder="nickname, ~WhatsApp name" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div><label>Phone</label>
            <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><label>Primary</label>
            <select value={f.primaryPos} onChange={(e) => setF({ ...f, primaryPos: e.target.value })}>
              {["D", "M", "A"].map((x) => <option key={x}>{x}</option>)}</select></div>
          <div><label>Secondary</label>
            <select value={f.secondary} onChange={(e) => setF({ ...f, secondary: e.target.value })}>
              <option value="">—</option>{["D", "M", "A"].map((x) => <option key={x}>{x}</option>)}</select></div>
        </div>
        {[["ballControl", "Ball control"], ["influence", "Influence"], ["discipline", "Discipline"]].map(([k, lbl]: any) => (
          <div key={k} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span className="muted">{lbl}</span>
              <span className="mono" style={{ fontWeight: 700 }}>{(+f[k]).toFixed(2)}</span>
            </div>
            <input type="range" min={1} max={10} step={0.25} value={f[k]}
              onChange={(e) => setF({ ...f, [k]: +e.target.value })}
              style={{ width: "100%", padding: 0, background: "transparent", border: "none" }} />
          </div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0",
          borderTop: "1px solid var(--line)", marginBottom: 12 }}>
          <span className="muted" style={{ fontSize: 13 }}>Overall skill</span>
          <span className="mono" style={{ fontWeight: 900, fontSize: 20, color: "var(--amber)" }}>{skill}</span>
        </div>
        {err && <div className="err">{err}</div>}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} disabled={busy || !f.name.trim()} onClick={save}>
            {busy ? "Saving…" : "Add player"}</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
