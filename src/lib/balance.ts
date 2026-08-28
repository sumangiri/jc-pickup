/**
 * Team balancer — deterministic, no LLM.
 * Balances on FOUR axes:
 *   1. total final skill
 *   2. position mix (D / M / A)
 *   3. spread of each dimension (ball control, influence, discipline)
 *   4. squad loyalty (players tend to stay on the side they've played for)
 */

export type Player = {
  id: string;
  name: string;
  primaryPos: "D" | "M" | "A" | string;
  secondary?: string | null;
  ballControl: number;
  influence: number;
  discipline: number;
  skill: number;
  photoUrl?: string | null;
};

export type BalanceOptions = {
  /** name -> net home lean (+ = usually home) */
  sideHistory?: Record<string, number>;
  /** players who must be on Home */
  lockHome?: string[];
  /** pairs that should be kept together, e.g. [["Suman","Prasanna Poudyal"]] */
  keepTogether?: [string, string][];
  goalkeeperName?: string;
  trials?: number;
  posWeight?: number;
  dimWeight?: number;
  loyaltyWeight?: number;
  seed?: number;
};

export type BalanceResult = {
  home: Player[];
  away: Player[];
  skillHome: number;
  skillAway: number;
  captainHome: string;
  captainAway: string;
  swing: string | null;
  loyaltyKept: number;
  loyaltyTotal: number;
  dimGap: { ballControl: number; influence: number; discipline: number };
};

const POSITIONS = ["D", "M", "A"] as const;

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

function scoreSplit(
  a: Player[],
  b: Player[],
  o: Required<Pick<BalanceOptions, "posWeight" | "dimWeight" | "loyaltyWeight">>,
  sideHistory: Record<string, number>
) {
  const sa = sum(a.map((p) => p.skill));
  const sb = sum(b.map((p) => p.skill));

  // position mix
  let pos = 0;
  for (const c of POSITIONS) {
    pos += Math.abs(
      a.filter((p) => p.primaryPos === c).length -
        b.filter((p) => p.primaryPos === c).length
    );
  }

  // dimension spread: compare per-player averages so uneven sizes are fair
  const dim =
    Math.abs(mean(a.map((p) => p.ballControl)) - mean(b.map((p) => p.ballControl))) +
    Math.abs(mean(a.map((p) => p.influence)) - mean(b.map((p) => p.influence))) +
    Math.abs(mean(a.map((p) => p.discipline)) - mean(b.map((p) => p.discipline)));

  // loyalty: penalty for putting a regular on their unusual side
  let loyalty = 0;
  for (const p of a) {
    const n = sideHistory[p.name] || 0;
    if (n < 0) loyalty += Math.min(-n, 3) / 3;
  }
  for (const p of b) {
    const n = sideHistory[p.name] || 0;
    if (n > 0) loyalty += Math.min(n, 3) / 3;
  }

  return (
    Math.abs(sa - sb) +
    o.posWeight * pos +
    o.dimWeight * dim +
    o.loyaltyWeight * loyalty
  );
}

export function balanceTeams(players: Player[], opts: BalanceOptions = {}): BalanceResult {
  const {
    sideHistory = {},
    lockHome = [],
    keepTogether = [],
    trials = 200000,
    posWeight = 1.5,
    dimWeight = 1.0,
    loyaltyWeight = 0.6,
    seed = 12345,
  } = opts;

  const rnd = mulberry32(seed);
  const n = players.length;
  const sizeA = Math.ceil(n / 2);

  // resolve locks (lockHome plus anyone paired with a locked player)
  const locked = new Set(lockHome);
  for (const [x, y] of keepTogether) {
    if (locked.has(x)) locked.add(y);
    if (locked.has(y)) locked.add(x);
  }
  const fixed = players.filter((p) => locked.has(p.name));
  const pool = players.filter((p) => !locked.has(p.name));
  const slots = Math.max(0, sizeA - fixed.length);

  let best: { s: number; a: Player[]; b: Player[] } | null = null;
  const idx = pool.map((_, i) => i);
  const w = { posWeight, dimWeight, loyaltyWeight };

  for (let t = 0; t < trials; t++) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const a = fixed.concat(idx.slice(0, slots).map((i) => pool[i]));
    const b = idx.slice(slots).map((i) => pool[i]);
    if (!a.length || !b.length) continue;
    const s = scoreSplit(a, b, w, sideHistory);
    if (!best || s < best.s) best = { s, a, b };
    if (best.s === 0) break;
  }

  const home = best!.a;
  const away = best!.b;
  const skillHome = +sum(home.map((p) => p.skill)).toFixed(2);
  const skillAway = +sum(away.map((p) => p.skill)).toFixed(2);

  const topOf = (t: Player[]) =>
    t.reduce((m, p) => (p.skill > m.skill ? p : m), t[0]).name;
  const captainHome = topOf(home);
  const captainAway = topOf(away);

  // swing player only when sides are uneven
  let swing: string | null = null;
  if (home.length !== away.length) {
    const bigger = home.length > away.length ? home : away;
    const excluded = new Set([captainHome, captainAway, ...lockHome]);
    const cands = bigger.filter((p) => !excluded.has(p.name));
    const pickFrom = cands.length ? cands : bigger;
    const avg = mean(bigger.map((p) => p.skill));
    swing = pickFrom.reduce((m, p) =>
      Math.abs(p.skill - avg) < Math.abs(m.skill - avg) ? p : m
    ).name;
  }

  let kept = 0;
  let totalRegulars = 0;
  for (const p of players) {
    const h = sideHistory[p.name] || 0;
    if (h === 0) continue;
    totalRegulars++;
    const onHome = home.some((x) => x.name === p.name);
    if ((h > 0 && onHome) || (h < 0 && !onHome)) kept++;
  }

  return {
    home,
    away,
    skillHome,
    skillAway,
    captainHome,
    captainAway,
    swing,
    loyaltyKept: kept,
    loyaltyTotal: totalRegulars,
    dimGap: {
      ballControl: +Math.abs(
        mean(home.map((p) => p.ballControl)) - mean(away.map((p) => p.ballControl))
      ).toFixed(2),
      influence: +Math.abs(
        mean(home.map((p) => p.influence)) - mean(away.map((p) => p.influence))
      ).toFixed(2),
      discipline: +Math.abs(
        mean(home.map((p) => p.discipline)) - mean(away.map((p) => p.discipline))
      ).toFixed(2),
    },
  };
}

/** Three-team split for short-field nights. Balances on per-player averages. */
export function balanceThree(players: Player[], seed = 999) {
  const rnd = mulberry32(seed);
  const n = players.length;
  const base = Math.floor(n / 3);
  const rem = n % 3;
  const sizes = [base + (rem > 0 ? 1 : 0), base + (rem > 1 ? 1 : 0), base];
  let best: { s: number; t: Player[][] } | null = null;
  const idx = players.map((_, i) => i);

  for (let k = 0; k < 150000; k++) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    const t = [
      idx.slice(0, sizes[0]).map((i) => players[i]),
      idx.slice(sizes[0], sizes[0] + sizes[1]).map((i) => players[i]),
      idx.slice(sizes[0] + sizes[1]).map((i) => players[i]),
    ];
    if (t.some((x) => !x.length)) continue;
    const avgs = t.map((x) => mean(x.map((p) => p.skill)));
    let s = Math.max(...avgs) - Math.min(...avgs);
    for (const dim of ["ballControl", "influence", "discipline"] as const) {
      const ds = t.map((x) => mean(x.map((p) => p[dim])));
      s += 0.8 * (Math.max(...ds) - Math.min(...ds));
    }
    for (const c of POSITIONS) {
      const fr = t.map((x) => x.filter((p) => p.primaryPos === c).length / x.length);
      s += 0.6 * (Math.max(...fr) - Math.min(...fr));
    }
    if (!best || s < best.s) best = { s, t };
  }
  return best!.t;
}

/** 3-way win probability from strength% gap + headcount edge. */
export function winProbability(
  skillHome: number,
  skillAway: number,
  nHome: number,
  nAway: number
) {
  const pctH = (100 * skillHome) / (10 * Math.max(nHome, 1));
  const pctA = (100 * skillAway) / (10 * Math.max(nAway, 1));
  const eff = pctH - pctA + 4 * (nHome - nAway);
  const raw = 1 / (1 + Math.pow(10, -eff / 25));
  const draw = 0.15 * (1 - Math.abs(2 * raw - 1));
  const home = raw * (1 - draw);
  return {
    home: Math.round(home * 100),
    draw: Math.round(draw * 100),
    away: 100 - Math.round(home * 100) - Math.round(draw * 100),
  };
}

/** Canonical formations by outfield count. */
const FORMATIONS: Record<number, number[][]> = {
  3: [[2, 1]], 4: [[2, 1, 1]], 5: [[2, 2, 1]],
  6: [[2, 3, 1], [3, 2, 1]], 7: [[3, 3, 1], [2, 3, 2]],
  8: [[3, 3, 2], [3, 4, 1]], 9: [[4, 3, 2], [3, 4, 2]],
  10: [[4, 4, 2], [4, 3, 3], [3, 5, 2]], 11: [[4, 4, 3], [4, 5, 2]],
  12: [[4, 5, 3], [5, 4, 3]], 13: [[5, 5, 3]], 14: [[5, 5, 4]],
};

export function pickFormation(outfield: Player[]) {
  const n = Math.min(Math.max(outfield.length, 3), 14);
  const options = FORMATIONS[n] || [[Math.ceil(n / 2), Math.floor(n / 2)]];
  const counts = {
    D: outfield.filter((p) => p.primaryPos === "D").length,
    M: outfield.filter((p) => p.primaryPos === "M").length,
    A: outfield.filter((p) => p.primaryPos === "A").length,
  };
  return options.reduce((bestShape, shape) => {
    const [d = 0, m = 0, a = 0] = shape;
    const miss = Math.abs(d - counts.D) + Math.abs(m - counts.M) + Math.abs(a - counts.A);
    const [bd = 0, bm = 0, ba = 0] = bestShape;
    const bestMiss =
      Math.abs(bd - counts.D) + Math.abs(bm - counts.M) + Math.abs(ba - counts.A);
    return miss < bestMiss ? shape : bestShape;
  }, options[0]);
}

/** Assign players to formation lines; out-of-position spill allowed. */
export function assignLines(outfield: Player[], shape: number[]) {
  const want = { D: shape[0] || 0, M: shape[1] || 0, A: shape[2] || 0 };
  const pools: Record<string, Player[]> = { D: [], M: [], A: [] };
  for (const p of outfield) pools[p.primaryPos in pools ? p.primaryPos : "M"].push(p);
  for (const k of Object.keys(pools)) pools[k].sort((x, y) => y.skill - x.skill);

  const lines: Record<string, Player[]> = { D: [], M: [], A: [] };
  for (const c of ["D", "M", "A"]) {
    while (pools[c].length && lines[c].length < want[c]) lines[c].push(pools[c].shift()!);
  }
  const leftovers = [...pools.D, ...pools.M, ...pools.A];
  const order: Record<string, string[]> = {
    D: ["M", "A"], M: ["D", "A"], A: ["M", "D"],
  };
  for (const p of leftovers) {
    const tries = [p.primaryPos, ...(order[p.primaryPos] || ["M", "D"])];
    let placed = false;
    for (const c of tries) {
      if (lines[c] && lines[c].length < want[c]) { lines[c].push(p); placed = true; break; }
    }
    if (!placed) {
      const smallest = Object.keys(lines).reduce((m, c) =>
        lines[c].length < lines[m].length ? c : m, "D");
      lines[smallest].push(p);
    }
  }
  return [lines.D, lines.M, lines.A];
}
