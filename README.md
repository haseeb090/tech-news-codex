# Tech Radar News

Next.js monolith for free latest tech news. It ingests curated RSS feeds, extracts full article content with a LangGraph workflow plus Ollama fallback, stores canonical state in Turso/libSQL, and serves a lightweight frontend plus admin dashboard.

## Stack
- Next.js 16 App Router
- React 19
- Auth: NextAuth Credentials
- Database: Turso / libSQL via Drizzle
- Orchestration: LangGraph for article extraction flow
- Local model runtime: Ollama
- Export artifacts: `public/news-latest.json` and `data/news-latest.csv`

## What the app does
- Discovers links from curated RSS feeds
- Deduplicates and tracks retries in Turso
- Extracts article title/body/writer/date with deterministic parsing first
- Falls back to Ollama only when needed
- Validates extracted content against source text to reduce hallucinations
- Stores articles, attempts, run history, pipeline events, and admin audit data in DB
- Supports public reader signup/sign-in with secure email/password auth
- Tracks reader signups in the database
- Limits anonymous visitors to a five-article teaser feed
- Keeps DB size bounded with FIFO-style pruning

## Architecture
- LangGraph handles per-article extraction orchestration in [`src/lib/ingestion/article-graph.ts`](./src/lib/ingestion/article-graph.ts)
- App-level ingestion orchestration lives in [`src/lib/ingestion/run-ingestion.ts`](./src/lib/ingestion/run-ingestion.ts)
- Canonical DB access and retention logic live in [`src/lib/db.ts`](./src/lib/db.ts)
- Admin dashboard aggregation lives in [`src/lib/admin-dashboard.ts`](./src/lib/admin-dashboard.ts)
- Reader auth modal and gated access logic live in [`src/components/reader-auth-provider.tsx`](./src/components/reader-auth-provider.tsx)
- Public theme switching lives in [`src/components/theme-provider.tsx`](./src/components/theme-provider.tsx)
- Source-specific retry and timeout behavior live in:
  - [`src/lib/ingestion/source-policy.ts`](./src/lib/ingestion/source-policy.ts)
  - [`src/lib/ingestion/retry-policy.ts`](./src/lib/ingestion/retry-policy.ts)
  - [`src/lib/ingestion/failure-classification.ts`](./src/lib/ingestion/failure-classification.ts)

## Requirements
- Node.js `22.17.1` recommended
  - Node `20.19+` is also fine
- Ollama running locally
- `qwen3:8b` pulled locally
- Turso database URL and auth token

## Local setup
1. Install dependencies:
   ```powershell
   npm install
   ```
2. Create `.env.local` from `.env.example` if needed:
   ```powershell
   Copy-Item .env.example .env.local
   ```
3. Generate an admin password hash if you need one:
   ```powershell
   npm run admin:hash -- your-strong-password
   ```
4. Fill `.env.local`.

## Required `.env.local`
```env
AUTH_SECRET=replace-with-random-long-secret
NEXTAUTH_SECRET=replace-with-random-long-secret
NEXTAUTH_URL=http://localhost:3000

ADMIN_USERNAME=haseeb090
ADMIN_PASSWORD_HASH=your-argon2-hash
ADMIN_ENABLED=true
ADMIN_LOCAL_ONLY=true

DATABASE_URL=libsql://your-db-name.turso.io
DATABASE_AUTH_TOKEN=your-turso-auth-token

OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3:8b
PUBLIC_SIGNUP_ENABLED=true
RATE_LIMIT_ENABLED=true
READER_LOGIN_RATE_LIMIT_ATTEMPTS=15
READER_LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
READER_SIGNUP_RATE_LIMIT_ATTEMPTS=10
READER_SIGNUP_RATE_LIMIT_WINDOW_MINUTES=60
ADMIN_TRIGGER_RATE_LIMIT_ATTEMPTS=10
ADMIN_TRIGGER_RATE_LIMIT_WINDOW_MINUTES=1
PREVIEW_ARTICLE_COUNT=5
VIEW_MORE_INCREMENT=6
```

## Useful optional `.env.local`
These are already supported by the app:

```env
RSS_FEEDS=
MAX_ARTICLES_IN_EXPORT=100
INGEST_MAX_RETRIES=3
INGEST_RETRY_COOLDOWN_MINUTES=30
INGEST_CONCURRENCY=4
WORKER_INTERVAL_MINUTES=60
WORKER_ALIGN_TO_INTERVAL=false
WORKER_RUN_ON_START=true
USE_LLM_FALLBACK=true
ARTICLE_FETCH_TIMEOUT_MS=20000
ARTICLE_PROCESS_TIMEOUT_MS=60000
LLM_HTML_MAX_CHARS=45000
```

## Storage retention env vars
These keep Turso storage bounded over time:

```env
ARTICLE_RECORD_LIMIT=500
ARTICLE_PRUNE_COUNT=100
ARTICLE_LINK_RECORD_LIMIT=650
ARTICLE_LINK_PRUNE_COUNT=150
INGEST_RUN_RECORD_LIMIT=200
INGEST_RUN_PRUNE_COUNT=50
INGEST_ATTEMPT_RECORD_LIMIT=1200
INGEST_ATTEMPT_PRUNE_COUNT=250
INGEST_EVENT_RECORD_LIMIT=5000
INGEST_EVENT_PRUNE_COUNT=1000
LOGIN_AUDIT_RECORD_LIMIT=500
LOGIN_AUDIT_PRUNE_COUNT=100
```

## One-time DB setup
Push the schema to Turso:

```powershell
npm run db:push -- --force
```

## Verify Ollama
Make sure Ollama is running and the model exists:

```powershell
ollama list
```

## Running locally
Start the frontend:

```powershell
npm run dev
```

Then open:
- Feed: [http://localhost:3000](http://localhost:3000)
- Login: [http://localhost:3000/login](http://localhost:3000/login)
- Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

Admin login uses:
- username: whatever `ADMIN_USERNAME` is set to
- password: the plain password behind `ADMIN_PASSWORD_HASH`

## Public reader auth flow
- Anonymous visitors can preview the first `PREVIEW_ARTICLE_COUNT` articles on the homepage.
- Clicking `Read here`, `Source`, or `View more` opens a signup/sign-in modal.
- Reader sessions use NextAuth credentials with email/password.
- Direct requests to `/articles/[id]` redirect back to the homepage with an auth prompt unless the visitor is signed in.
- Signups are tracked in `reader_users` and `reader_signup_events`.

## Running ingestion locally
One ingestion run:

```powershell
npm run ingest
```

Start frontend after a one-shot ingest:

```powershell
npm run dev:with-ingest
```

Continuous worker loop:

```powershell
npm run worker
```

Rebuild exported artifacts from DB:

```powershell
npm run export:news
```

## Triggering ingestion from the admin UI
1. Start the app locally with `npm run dev`
2. Log in at `/login`
3. Open `/admin`
4. Click `Run Ingestion Now`

Because local dev can reach local Ollama at `http://127.0.0.1:11434`, this works fine on your machine.

## Local Docker stack
This repo now includes a local Docker runtime for a persistent app server plus a scheduled ingestion worker.

Files:
- [`Dockerfile`](./Dockerfile)
- [`docker-compose.yml`](./docker-compose.yml)
- [`.dockerignore`](./.dockerignore)

What the compose stack does:
- runs the app server continuously
- binds the app to `127.0.0.1:3000` so the admin interface stays local-only
- runs a separate worker container that checks for ingestion every 3 hours
- uses `restart: unless-stopped` so the services come back when Docker restarts
- reaches your local Ollama instance through `http://host.docker.internal:11434`

Start it:

```powershell
docker compose up -d --build
```

Stop it:

```powershell
docker compose down
```

The worker service uses:
- `WORKER_INTERVAL_MINUTES=180`
- `WORKER_ALIGN_TO_INTERVAL=true`
- `WORKER_RUN_ON_START=true`

That means it runs one ingestion on container start, then waits for the next aligned 3-hour window.

Important:
- the Docker stack mounts your local `.env.local`
- the Compose file overrides a few runtime values for containers:
  - app binds to `http://localhost:3000`
  - admin stays local-only
  - Ollama is reached through `http://host.docker.internal:11434`
  - worker runs every 3 hours even if your local `.env.local` says something else

Useful Docker logs:

```powershell
docker compose logs -f app
docker compose logs -f worker
docker compose logs -f app worker
```

Log routing:
- manual ingestion started from the admin UI logs in the `app` container
- scheduled ingestion logs in the `worker` container
- auth and admin API logs also show in the `app` container

## Admin observability
The admin dashboard is now meant to work like a lightweight ingestion control room.

It shows:
- `Active Run` with live progress and current item context
- `Last Completed Run` that stays visible while a new run is in progress
- `Reader Signups` and `Recent Signups`
- `Pipeline Timeline` for feed discovery, queueing, export, and run lifecycle events
- `LangGraph Orchestration` with a per-link node-flow diagram:
  - `Fetch -> Diagnose -> Deterministic -> Decision -> LLM -> Validate -> Classify -> Result`
- `Current Run Attempts` for article-level results in the active run only
- `Recent Attempts` for cross-run history
- `Failed Links` with transient vs terminal retry classification

The timeline and graph board are backed by the `ingest_events` table, and the event stream is emitted from both the ingestion runner and the LangGraph workflow.
The admin trigger button is disabled while a run is already active, so you do not get a misleading manual-trigger error when a scheduled run is in progress.

## Console logging
Local ingestion now emits timestamped stage-aware logs in the terminal and Docker logs.

Examples include:
- feed discovery start/success/failure
- per-link orchestration start
- LangGraph node events like `graph.fetch`, `graph.diagnose`, `graph.decision`, `graph.llm`, `graph.validate`
- link success/failure
- artifact export start/completion
- final run completion/failure

Run one manual ingestion and watch the console:

```powershell
npm run ingest
```

For the local Docker stack:

```powershell
docker compose logs -f app worker
```

## Stale `next dev` cleanup on PowerShell
If `npm run dev` says port `3000` is in use or `.next/dev/lock` is already held, use these:

Show Node processes:

```powershell
Get-Process node -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,StartTime,Path
```

Show command lines for Node processes:

```powershell
Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | Select-Object ProcessId,CommandLine
```

Stop a specific stale process:

```powershell
Stop-Process -Id 12345 -Force
```

If you clearly see stale `npm run dev` / `next dev` processes for this workspace, stop them:

```powershell
Stop-Process -Id 56500,36276,14516 -Force
```

Then start dev again:

```powershell
npm run dev
```

## Commands
- `npm run dev`: start frontend
- `npm run dev:with-ingest`: ingest once, then start frontend
- `npm run ingest`: one ingestion run
- `npm run worker`: continuous local worker loop
- `npm run export:news`: rebuild JSON/CSV artifacts
- `npm run feeds:check`: validate curated feeds
- `npm run admin:hash -- <password>`: generate admin password hash
- `npm run admin:set-password -- <password> [--username=haseeb090]`: update `.env.local` with a new admin hash and clear admin rate-limit locks
- `npm run db:generate`: generate Drizzle migration SQL
- `npm run db:push`: push schema to Turso
- `npm run db:studio`: open Drizzle Studio
- `npm run test`: run tests
- `npm run lint`: run lint
- `npm run build`: production build check

## Curated feeds
- Default feed catalog lives in [`src/lib/ingestion/feeds.json`](./src/lib/ingestion/feeds.json)
- Leave `RSS_FEEDS` blank to use the curated catalog
- Or override with comma-separated feed URLs

## Storage retention
The DB uses FIFO-style pruning so free-tier storage does not grow forever.

Current defaults:
- `ARTICLE_RECORD_LIMIT=500`
- `ARTICLE_LINK_RECORD_LIMIT=650`
- `INGEST_RUN_RECORD_LIMIT=200`
- `INGEST_ATTEMPT_RECORD_LIMIT=1200`
- `INGEST_EVENT_RECORD_LIMIT=5000`
- `LOGIN_AUDIT_RECORD_LIMIT=500`

Pruning happens before inserts in [`src/lib/db.ts`](./src/lib/db.ts).

## Source-specific behavior
- Slow or thin-content sources use source policies
- Retry classification is `transient` vs `terminal`
- Admin dashboard shows retry classification hints
- BleepingComputer and Engadget have source-aware behavior

## Security notes
- Admin pages and APIs are protected by NextAuth middleware
- Passwords are stored as Argon2 hashes in env vars
- Reader passwords are stored as Argon2 hashes in the database
- Login attempts are audited
- SSRF guard blocks local/private network targets
- Extraction is validated against source text
- Admin routes can be disabled with `ADMIN_ENABLED=false`
- Admin routes can be restricted to localhost with `ADMIN_LOCAL_ONLY=true`

## Rate limiting
The app keeps rate limiting intentionally narrow so it does not hurt normal UX.

What is not rate-limited:
- `GET /api/news`
- public feed reads and article reads
- admin status polling
- admin timeline/log polling
- local admin login
- local admin manual ingestion trigger
- local signup and local reader login

What is rate-limited in production:
- public reader signup
- public reader login
- remote admin manual ingestion trigger, if you ever expose admin remotely

Current production behavior:
- signup is limited by `email + IP`
- reader login is limited by `email + IP`
- admin trigger is limited by `user + IP`

Practical meaning:
- many different users from the same network can still sign up and log in
- repeated abuse from the same email/IP pair gets slowed down
- admin status polling never consumes trigger budget
- read APIs stay fast and unthrottled

## Windows Task Scheduler
To run ingestion every hour from your PC:
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily, repeat every `1 hour`
4. Action: Start a program
5. Program/script: `npm`
6. Arguments: `run ingest`
7. Start in: `E:\Code\Codex-projects\nextjs tech news`

## Vercel + Turso deploy
1. Create Turso DB and auth token
2. Add env vars in Vercel:
   ```env
   DATABASE_URL=libsql://your-db-name.turso.io
   DATABASE_AUTH_TOKEN=your-turso-auth-token
   NEXTAUTH_SECRET=replace-with-random-long-secret
   NEXTAUTH_URL=https://your-domain.vercel.app
   ADMIN_USERNAME=haseeb090
   ADMIN_PASSWORD_HASH=your-argon2-hash
   ADMIN_ENABLED=false
   ADMIN_LOCAL_ONLY=true
   PUBLIC_SIGNUP_ENABLED=true
   RATE_LIMIT_ENABLED=true
   READER_LOGIN_RATE_LIMIT_ATTEMPTS=15
   READER_LOGIN_RATE_LIMIT_WINDOW_MINUTES=15
   READER_SIGNUP_RATE_LIMIT_ATTEMPTS=10
   READER_SIGNUP_RATE_LIMIT_WINDOW_MINUTES=60
   ADMIN_TRIGGER_RATE_LIMIT_ATTEMPTS=10
   ADMIN_TRIGGER_RATE_LIMIT_WINDOW_MINUTES=1
   PREVIEW_ARTICLE_COUNT=5
   VIEW_MORE_INCREMENT=6
   OLLAMA_BASE_URL=http://your-pc-or-reachable-ollama-endpoint:11434
   OLLAMA_MODEL=qwen3:8b
   ```
3. Push schema once from local machine:
   ```powershell
   npm run db:push -- --force
   ```
4. Deploy to Vercel
5. Run ingestion from your PC with `npm run ingest` or `npm run worker`

Important:
- if production `OLLAMA_BASE_URL` still points to `127.0.0.1`, the hosted admin ingestion endpoint will reject the request by design
- in that case, run ingestion from your local machine instead
- for the public deployed site, set `ADMIN_ENABLED=false` so the admin surface is not exposed at all
- with `ADMIN_ENABLED=false`, public reader signup/login continues to work and does not depend on the local admin system

## Current project state
- Turso-backed canonical DB
- LangGraph-based extraction flow
- adaptive retries and per-source policies
- bounded DB retention
- event-backed admin dashboard with live status, timeline logging, LangGraph node-flow monitoring, failed links, attempts, and retry classification
- local Docker stack for always-on local admin and scheduled ingestion
- public reader auth with signup tracking and gated full-feed access
- multi-theme public UI with smoother motion and theme switching
- public feed plus article detail pages
