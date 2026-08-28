# Pickup Soccer Manager — Build Plan & Architecture
_Handoff document. Any model executing this should follow it exactly and ask Suman only the questions in §9._

## 1. What we're building
A Vercel-hosted web app that replaces the chat-based workflow:
poll screenshot → balanced teams → posted sheet → scores/MOTM → stats.
Existing data (43-player roster, 10+ game ledger) is migrated in as seed data.

## 2. Stack
- **Next.js 14 (App Router, TypeScript)** on **Vercel** (hobby tier)
- **Vercel Postgres (Neon)** — roster, games, proposals, users
- **Vercel Blob** — player photos + uploaded poll screenshots
- **Auth**: iron-session, credentials checked against env vars / users table.
  Roles: `superadmin` (Suman), `admin`, `member`.
- **LLM**: Anthropic API, model `claude-haiku-4-5` everywhere (cheapest with vision).
  Used for: screenshot → attendee names (vision), chat-edit parsing, score/MOTM parsing.
  NOT used for balancing (deterministic TS code).
- Local dev first (`vercel dev` + local Postgres via docker or Neon branch), then deploy.

## 3. Data model (Postgres)
- `players(id, name, aliases text[], phone, photo_url, ball_control float,
  influence float, discipline float, skill float, active bool, created_at)`
  - **skill stays the source of truth** (migrated as-is from roster.json).
  - ball_control/influence/discipline are seeded so that
    `skill = normalize(0.40*BC + 0.35*INF + 0.25*DIS)`; seeds are plausible
    per-player spreads (±1.5) solved to hit the existing skill exactly.
- `skill_proposals(id, player_id, field, old_value, new_value, proposed_by,
  status enum[pending/approved/rejected], decided_by, note, timestamps)`
- `games(id, date, label, home jsonb, away jsonb, captains jsonb, swing,
  score_home, score_away, result, motm, created_from_upload_id)`
- `uploads(id, blob_url, extracted_names jsonb, status)`
- `users(id, username, password_hash, role)`
- `rating_history(player_id, ts, skill, source enum[drift/manual/approval])` — powers evolution charts.

## 4. Team balancer (TypeScript port + upgrade)
Objective, randomized search (300k iters, same as today):
```
score = |Σskill_A − Σskill_B|                     (final-skill balance)
      + 1.5 · Σ_pos |count_A − count_B|           (D/M/A mix)
      + 0.6 · loyalty_flips                       (history from games table)
      + 1.0 · Σ_dim |mean_A − mean_B|  for dim in {ball_control, influence, discipline}
```
The last term is the new requirement: each side gets a comparable **spread of
ball control, influence, and discipline** — not just equal totals. Constraints
carried over: Suman on Home, Prasanna with Suman, captains = top skill per side,
swing only on odd counts (never Suman/Prasanna), Narayan → GK slot.

## 5. Pages
1. **/login** — username/password.
2. **/ (Matchday)** — drag-in screenshot upload → Haiku vision extracts names →
   fuzzy match vs aliases (unknowns prompt for quick-add) → balancer runs →
   renders the team sheet (SVG, footballuser style: vertical pitches, red vs navy,
   formations, strength %, 3-way win probability). Buttons: re-roll, download PNG, save game.
   **Chat drawer**: "swap Milan and Utsav", "make it 3 teams", "Kwasi didn't show" —
   Haiku parses → deterministic ops re-run → sheet updates.
3. **/results** — score + MOTM entry per pending game (structured form with a
   free-text box that Haiku parses, e.g. "we won 6-5, utsav motm"). Applies
   Elo-lite drift (max ±0.4/game) and writes rating_history.
4. **/games** — searchable historic ledger (by date, player, scoreline), game detail pages.
5. **/stats** — leaderboard (W-L, win%, MOTM), influence table (carry + RAPM,
   recomputed nightly or on-demand), per-player page with skill-evolution chart
   (rating_history) and the three dimensions as a radar.
6. **/roster (admin)** — grid of player cards with photos (upload → Vercel Blob,
   circular crop client-side). Admins edit dimensions → creates a `skill_proposal`.
7. **/approvals (superadmin)** — pending proposals with old→new diff; approve
   (applies + logs to rating_history) or reject, with note.

## 6. Design direction (use the `impeccable` + `frontend-design` skills)
- **Not Claude-like**: no warm neutrals/orange. Direction: "broadcast matchday"
  — near-black `#0B0F14`, pitch greens as texture only, one electric accent
  (volt `#D4FF3F` or signal red `#E63946`), condensed display type
  (Archivo Expanded / Space Grotesk) with tabular numerals for stats.
- Dark UI, card-based, generous whitespace, jersey-dot motif carried from the
  current team sheets so the group recognizes it.
- Mobile-first: the primary user is on a phone at a field.

## 7. Build phases
1. Scaffold + auth + DB schema + seed migration (roster.json, games.json → SQL) — local.
2. Balancer port + golden tests (replay 3 past games, assert Δ ≤ 1 vs Python output).
3. Matchday page: upload → extract → balance → SVG sheet → save.
4. Results entry + drift + history.
5. Games search + stats + evolution charts.
6. Roster admin + photo upload + proposals/approvals.
7. Design pass (impeccable skill), then `vercel deploy`.

## 8. Cost posture
- Vercel hobby: $0. Neon free tier: $0. Blob: pennies.
- Haiku 4.5 calls: one vision call per screenshot (~1–2¢), tiny text calls for
  chat edits and score parsing. Expected << $1/month at weekly cadence.

## 9. Questions for Suman (blockers)
1. **Super admin username + password** (and any additional admin accounts: who?)
2. Anthropic **API key** to put in Vercel env (`ANTHROPIC_API_KEY`).
3. Vercel account: deploy from Suman's account (need login on desktop) or a new one?
4. Should regular members log in at all, or is the matchday page open + admin pages gated?
5. App name/domain preference (e.g. `heights-pickup.vercel.app`)?

## 10. Non-goals (v1)
- No WhatsApp API integration (screenshots remain the input).
- No auto-posting back to the group (download/share the PNG).
- Skill numbers stay hidden from member-facing sheets, same as today.
