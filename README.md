# 🎲 Colour Dice Arena

A browser-based, **provably-fair multiplayer colour dice game**. Instead of numbers, the dice shows one of six colours — **Red, Black, Blue, Green, Yellow, White**. Players never predict a colour: the dice stays **neutral** until a player taps, then the server generates and reveals that player's colour. Rooms hold 2 or 3 players, each player taps once per round, and every result is permanently recorded and independently verifiable.

Built as a **monorepo split**:

| App | Stack | Deploys to |
| --- | --- | --- |
| `apps/web` | Next.js 14 (App Router) · React · TypeScript · Tailwind · Framer Motion · socket.io-client | **Vercel** |
| `apps/server` | Node.js · Express · Socket.io · Prisma · PostgreSQL | **Render** (or Railway) |

> **Why split?** Vercel's serverless functions can't host a long-lived Socket.io server with in-memory matchmaking state. So the realtime/game backend runs on Render (persistent WebSockets), and the Next.js frontend runs on Vercel.

The database is **Supabase Postgres**, auth is **custom JWT** (bcrypt-hashed passwords), and active room state is held **in-memory** (Redis is an optional scaling upgrade).

---

## ✨ Features

- 🎨 Six-colour dice (no numbers), neutral until you tap
- 👥 2-player and 3-player matchmaking rooms (round starts when the room is full)
- 📴 Quick Play: single-device pass-and-play, no account needed, continuous rounds until you end the game
- 🎯 Board Game: a dice-roller and scorekeeper companion for a physical board game with hidden coloured tiles
- ⚡ Real-time updates over Socket.io (join, round start, taps, reveals, completion)
- 🔐 Provably fair: SHA-256 seed commitment + per-tap HMAC-SHA256 result, seed revealed only after the round ends
- 🧮 Public verification page that recomputes results in the browser (Web Crypto)
- 📜 Round history per user
- 🛡️ Admin dashboard: users, live rooms (pause/resume, create), completed rounds, search/filter, CSV export
- 📱 Mobile-responsive dark gaming UI, tuned for Chrome

---

## 🗂️ Project structure

```
colour-dice-arena/
├─ apps/
│  ├─ web/      # Next.js frontend (Vercel)
│  └─ server/   # Express + Socket.io + Prisma backend (Render)
├─ package.json # npm workspaces + dev scripts
└─ README.md
```

Each app is **self-contained** (it ships its own small copy of the colour constants/types). This is deliberate: it guarantees both apps build in isolation exactly as Vercel and Render see them, with no cross-package resolution surprises on the split deploy.

---

## 🚀 Local development

### Prerequisites
- **Node 20 LTS** (`nvm use` reads `.nvmrc`) and npm 9+
- A free **Supabase** project (for the Postgres connection strings)

### Setup
```bash
# 1. Install all workspace dependencies from the repo root
npm install

# 2. Configure the backend
cp apps/server/.env.example apps/server/.env
#    → fill in DATABASE_URL + DIRECT_URL (Supabase) and a JWT_SECRET

# 3. Configure the frontend
cp apps/web/.env.example apps/web/.env.local
#    → defaults already point at http://localhost:4000

# 4. Create the database tables and seed an admin user
npm run prisma:migrate     # runs prisma migrate dev (uses DIRECT_URL)
npm run seed               # creates the admin account

# 5. Run both apps (server :4000, web :3000)
npm run dev
```

Open **http://localhost:3000** in Chrome. To play a real 2-player game locally, open a second account in an incognito window.

### Useful commands
```bash
npm run dev:server                 # backend only (http://localhost:4000)
npm run dev:web                    # frontend only (http://localhost:3000)
npm run build                      # build both apps
npm run prisma:generate            # regenerate Prisma client after schema edits
npx prisma studio -w apps/server   # inspect the database
```

### Default admin
After `npm run seed`, log in with the credentials from `apps/server/.env`
(`ADMIN_EMAIL` / `ADMIN_PASSWORD`, defaulting to `admin@colourdice.local` / `ChangeMe123!`).
**Change these before deploying.** The `/admin` dashboard is only visible to this account.

---

## 🔒 Provably fair — how it works

1. When a room fills, the server generates a random **`serverSeed`** and publishes only its **`serverSeedHash` = SHA256(serverSeed)** (the commitment).
2. When a player taps, the server computes
   `finalHash = HMAC_SHA256(serverSeed, "<roundId>:<userId>:<playerPosition>:<nonce>")`,
   then `colour = COLORS[parseInt(finalHash.slice(0,8), 16) % 6]`.
3. The seed stays secret until **every** player has tapped. On completion the **`serverSeed` is revealed**.
4. Anyone can open the **/verify** page, paste the round's values (or look them up by Round ID), and the browser recomputes the result with the **same** algorithm. If it matches → *"Result verified successfully"*.

Results are generated **only on the server** — the client just displays them. Admins can view everything but **cannot edit** completed results (no such endpoint exists).

---

## ☁️ Deployment

See [`apps/server/.env.example`](apps/server/.env.example) and [`apps/web/.env.example`](apps/web/.env.example) for the full environment variable list.

### 1. Supabase (database)
Create a project → **Settings ▸ Database ▸ Connection string ▸ Prisma**. Copy:
- the **port 6543** (transaction pooler) string into `DATABASE_URL` and append `?pgbouncer=true&connection_limit=1`
- the **port 5432** (direct) string into `DIRECT_URL`

### 2. Render (backend — `apps/server`)
- New **Web Service** → connect this repo → **Root Directory: `apps/server`**
- **Build Command:** `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
- **Start Command:** `npm run start`
- **Health Check Path:** `/health`
- **Env vars:** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `CLIENT_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- Note the resulting URL, e.g. `https://colour-dice-server.onrender.com`

### 3. Vercel (frontend — `apps/web`)
- Import this repo → **Root Directory: `apps/web`** (auto-detects Next.js)
- **Env vars:** `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` = the Render URL from step 2
- Deploy → note the `https://<your-app>.vercel.app` URL
- Put that URL into Render's `CLIENT_ORIGIN` (comma-separated with localhost) and redeploy Render so CORS allows it

> **Gotchas:** Production must use `https://` (Vercel blocks mixed content; Socket.io auto-upgrades to `wss://`). Render's free tier cold-starts after ~15 min idle (~30–60s to wake) — the UI shows a "connecting" state and relies on Socket.io reconnection.

---

## 🧩 Tech stack

**Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS, Framer Motion, socket.io-client
**Backend:** Node.js, Express, Socket.io, Prisma, PostgreSQL (Supabase), bcryptjs, jsonwebtoken, zod
**Auth:** custom JWT (shared by REST + the Socket.io handshake)

---

## 📄 License

MIT — for educational/demo use. Contains **no** payment, wallet, deposit/withdrawal, or real-money betting features.
