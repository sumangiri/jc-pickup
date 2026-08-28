"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: any) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch(mode === "in" ? "/api/login" : "/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: u, password: p }),
    });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setErr(j.error || "Something went wrong.");
    router.push("/matchday");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "84vh", display: "grid", placeItems: "center", padding: "40px 0" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div className="brand" style={{ justifyContent: "center", fontSize: 21, marginBottom: 12 }}>
            <i />
            JC Pickup
          </div>
          <div
            className="mono"
            style={{
              fontSize: 11,
              letterSpacing: ".2em",
              color: "var(--chalk-faint)",
              textTransform: "uppercase",
            }}
          >
            Jersey City Heights
          </div>
        </div>

        <form className="chalk" onSubmit={submit}>
          <div className="eyebrow">{mode === "in" ? "Sign in" : "Create account"}</div>
          <div style={{ marginBottom: 14 }}>
            <label>Username</label>
            <input value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="none" required />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label>Password</label>
            <input type="password" value={p} onChange={(e) => setP(e.target.value)} required />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" style={{ width: "100%" }} disabled={busy}>
            {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13 }} className="muted">
            {mode === "in" ? "New here? " : "Already have an account? "}
            <a
              style={{ color: "var(--amber)", cursor: "pointer", fontWeight: 700 }}
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setErr("");
              }}
            >
              {mode === "in" ? "Create an account" : "Sign in"}
            </a>
          </div>
        </form>

        <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 18, lineHeight: 1.6 }}>
          New accounts start as members. A super admin can promote you to admin from the roster.
        </p>
      </div>
    </div>
  );
}
