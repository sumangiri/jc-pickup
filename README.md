# JC Pickup

Balanced team assignment, results and stats for the Jersey City Heights
Saturday pickup game. Replaces the WhatsApp-screenshot-to-team-sheet workflow.

---

## 1. Run it locally (5 minutes)

```bash
cd jc-pickup
npm install
cp .env.local.example .env.local     # then edit it — see below
node scripts/seed.mjs                # loads the 47-player roster + 14 games
npm run dev                          # http://localhost:3000
```

Sign in with username **`suman`** and whatever you set as `SUPERADMIN_PASSWORD`.

### What goes in `.env.local`

| Variable | What it is | Where to get it |
|---|---|---|
| `SUPERADMIN_PASSWORD` | Your password. Username is fixed to `suman`. | You choose it |
| `SESSION_SECRET` | Signs login cookies. Any long random string. | `openssl rand -base64 32` |
| `OPENAI_API_KEY` | Reads poll screenshots, parses chat commands | https://platform.openai.com/api-keys |
| `DATABASE_URL` | Local SQLite file | leave as `file:./dev.db` |

If you change `SUPERADMIN_PASSWORD` later, re-run `node scripts/seed.mjs` — it
updates the account rather than duplicating it.

---

## 2. Deploy to Vercel (free)

### Step A — database (do this first)

Vercel's filesystem is read-only, so SQLite can't persist there. Use Postgres:

1. In your Vercel project → **Storage** → **Create Database** → **Neon (Postgres)** → free plan.
2. Vercel automatically adds `POSTGRES_URL` to the project's env vars.
3. The app detects `POSTGRES_URL` and switches drivers automatically — no code change.

### Step B — environment variables

Vercel dashboard → **Project → Settings → Environment Variables**. Add these
for *Production*, *Preview* and *Development*:

```
OPENAI_API_KEY        sk-proj-...        ← paste your ChatGPT developer key here
SUPERADMIN_PASSWORD   <your password>
SESSION_SECRET        <long random string>
```

`POSTGRES_URL` is added for you by the Neon integration in Step A.

### Step C — ship it

```bash
npm i -g vercel
vercel login
vercel --prod
```

Then seed the production database once:

```bash
vercel env pull .env.production.local
DATABASE_URL="" POSTGRES_URL="<value from that file>" node scripts/seed.mjs
```

---

## 3. How it works

### Skill and the three dimensions

Every player has three ratings and one composite:

```
skill = 0.40 × ball control  +  0.35 × influence  +  0.25 × discipline
```

The seed derives the three dimensions from each player's **existing** skill, so
nothing you've calibrated over the season changed — the dimensions reconstruct
every current rating to within 0.004. Attackers lean ball control, defenders
lean discipline, midfielders lean influence.

### Balancing

The optimiser searches ~120k splits and minimises:

| Term | Weight | Why |
|---|---|---|
| Total skill difference | 1.0 | sides should be equally strong |
| Position mix (D/M/A) | 1.5 | no team of all defenders |
| **Dimension spread** | **1.0** | **no side stacked on flair with none on discipline** |
| Loyalty | 0.6 | squads stay together so chemistry builds |

Fixed rules carried over from the old system: Suman on Home, Prasanna with
Suman, captains are the highest-rated player per side, a swing player only when
headcount is odd (never Suman or Prasanna), Narayan takes the GK slot when he plays.

### Rating drift

Recording a score nudges every player's ratings by up to ±0.4, scaled by how
surprising the result was against the pre-game model. Winners drift up, losers
down, all three dimensions move together. Every change is written to
`rating_history`, which powers the evolution chart on each player.

---

## 4. The pages

- **Matchday** — drop poll screenshots → names extracted → balanced teams →
  team sheet. The chat box takes plain instructions: *"swap Milan and Utsav"*,
  *"Kwasi didn't show"*, *"move GP to away"*, *"re-roll"*. Also does 3-team splits.
- **Results** — enter a score and MOTM, or just type *"we won 6-5, utsav motm"*.
- **Games** — searchable history. Search by player, date or scoreline; click a
  row to see both lineups.
- **Stats** — standings and an influence table (goals of margin added per game
  versus what the rest of the team projected). Click any player for their
  dimension breakdown and rating history.
- **Roster** — every player with photo, dimensions and composite skill. Admins
  drag a slider to propose a change.
- **Approvals** — superadmin only. Approve or reject proposed rating changes
  with a before/after diff.

## 5. Roles

| Role | Can do |
|---|---|
| member | view everything, make teams, enter results |
| admin | + upload photos, propose rating changes |
| superadmin | + approve/reject proposals, promote users, edit ratings directly |

Everyone self-registers as a member. Promote them from **Roster → Manage accounts**.

## 6. Cost

Vercel Hobby $0 · Neon free tier $0 · OpenAI `gpt-4o-mini` roughly 1–2¢ per
screenshot read and a fraction of a cent per chat command. Expect well under
$1/month at one game a week.
