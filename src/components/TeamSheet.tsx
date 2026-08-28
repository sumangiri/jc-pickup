"use client";
import { pickFormation, assignLines, winProbability } from "@/lib/balance";

const W = 68, H = 105;
const BAND = [24, 52, 80];

function Pitch({ team, cap, swing, dot, edge, label, tint, skill, gkName }: any) {
  const gk =
    team.find((p: any) => p.name === gkName) ||
    (() => {
      const ds = team.filter((p: any) => p.primaryPos === "D");
      const pool = ds.length ? ds : team;
      return pool.reduce((m: any, p: any) => (p.skill < m.skill ? p : m), pool[0]);
    })();
  const outfield = team.filter((p: any) => p.name !== gk?.name);
  const shape = pickFormation(outfield);
  const lines = assignLines(outfield, shape);
  const numbers: Record<string, number> = { [gk?.name]: 1 };
  let i = 2;
  for (const line of lines)
    for (const p of [...line].sort((a, b) => b.skill - a.skill)) numbers[p.name] = i++;

  const rowXs = (n: number) => {
    if (n === 1) return [W / 2];
    const span = n <= 3 ? 44 : n === 4 ? 52 : 58;
    const x0 = W / 2 - span / 2;
    return Array.from({ length: n }, (_, k) => x0 + (k * span) / (n - 1));
  };

  const Dot = ({ x, y, p, gkSlot }: any) => {
    const isCap = p.name === cap;
    const isSwing = p.name === swing;
    const first = p.name.split(" ")[0];
    return (
      <g>
        {isCap && <circle cx={x} cy={y} r={4.4} fill="#FFB43C" />}
        <circle cx={x} cy={y} r={3.7} fill={dot} stroke={edge} strokeWidth={0.5} />
        {isSwing && (
          <circle cx={x} cy={y} r={4.9} fill="none" stroke="#EEF3F8" strokeWidth={0.55}
            strokeDasharray="2.4 1.6" />
        )}
        <text x={x} y={y + 1.3} textAnchor="middle" fontSize={3.6} fontWeight={800} fill="#fff"
          fontFamily="JetBrains Mono, monospace">{numbers[p.name]}</text>
        {gkSlot ? (
          <text x={x + 7} y={y + 1} fontSize={2.9} fontWeight={700} fill="#EEF3F8">
            {first} (GK)
          </text>
        ) : (
          <>
            <rect x={x - 7.6} y={y - 9.6} width={15.2} height={4} rx={1.6} fill="#0A1410" opacity={0.82} />
            <text x={x} y={y - 6.8} textAnchor="middle" fontSize={2.8} fontWeight={700} fill="#EEF3F8">
              {first}{isCap ? " (C)" : ""}{isSwing ? " ⇄" : ""}
            </text>
          </>
        )}
      </g>
    );
  };

  const shapeStr = lines.filter((l) => l.length).map((l) => l.length).join("-");
  const strength = Math.round((100 * skill) / (10 * team.length));

  return (
    <div style={{ flex: 1, minWidth: 250 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 900, letterSpacing: ".08em", fontSize: 13, color: tint }}>{label}</div>
        <div className="mono" style={{ fontSize: 11.5, color: "var(--chalk-dim)", marginTop: 3 }}>
          {shapeStr} · STRENGTH {strength}%
        </div>
      </div>
      <svg viewBox={`-2 -4 ${W + 4} ${H + 6}`} style={{ width: "100%", display: "block" }}>
        <rect x={0} y={0} width={W} height={H} fill="#2F7D4F" rx={1} />
        {[0, 2, 4, 6].map((k) => (
          <rect key={k} x={0} y={k * 15} width={W} height={15} fill="#338756" />
        ))}
        <g stroke="#EEF3F8" strokeWidth={0.45} fill="none" opacity={0.85}>
          <rect x={1} y={1} width={W - 2} height={H - 2} />
          <line x1={1} y1={H / 2} x2={W - 1} y2={H / 2} />
          <circle cx={W / 2} cy={H / 2} r={9.15} />
          <path d={`M${W / 2 - 20} 1 v16.5 h40 V1`} />
          <path d={`M${W / 2 - 20} ${H - 1} v-16.5 h40 v16.5`} />
          <path d={`M${W / 2 - 9} 1 v5.5 h18 V1`} />
          <path d={`M${W / 2 - 9} ${H - 1} v-5.5 h18 v5.5`} />
        </g>
        {gk && <Dot x={W / 2} y={9} p={gk} gkSlot />}
        {lines.map((line, li) =>
          [...line].sort((a, b) => b.skill - a.skill).map((p, k) => (
            <Dot key={p.name} x={rowXs(line.length)[k]} y={BAND[li] + (gk ? 3 : 0)} p={p} />
          ))
        )}
      </svg>
    </div>
  );
}

export default function TeamSheet({ result, label }: { result: any; label?: string }) {
  if (!result) return null;
  const { home, away, skillHome, skillAway, captainHome, captainAway, swing } = result;
  const wp = winProbability(skillHome, skillAway, home.length, away.length);

  return (
    <div className="chalk" id="team-sheet">
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: "-.01em" }}>
          TEAM SHEET{label ? <span className="muted" style={{ fontWeight: 600 }}> · {label}</span> : null}
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--amber)", marginTop: 6, fontWeight: 700 }}>
          WIN PROBABILITY &nbsp;HOME {wp.home}% · DRAW {wp.draw}% · AWAY {wp.away}%
        </div>
      </div>
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <Pitch team={home} cap={captainHome} swing={swing} dot="#E23B48" edge="#8E1616"
          label="HOME · PINNIES" tint="#FF6B6B" skill={skillHome} gkName="Narayan" />
        <Pitch team={away} cap={captainAway} swing={swing} dot="#1F2A44" edge="#0D1526"
          label="AWAY · NO PINNIES" tint="#9DB4E8" skill={skillAway} gkName="Narayan" />
      </div>
      <div style={{ textAlign: "center", marginTop: 12, fontSize: 11.5 }} className="muted mono">
        (C) = CAPTAIN · 1 = GK{swing ? ` · ⇄ ${swing.split(" ")[0]} SWITCHES AT HALF` : ""}
      </div>
    </div>
  );
}
