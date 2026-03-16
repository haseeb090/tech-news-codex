# Tech Radar News

Next.js monolith that ingests tech news from RSS feeds, extracts full article content with a LangGraph workflow + Ollama fallback, stores canonical state in Turso/libSQL, and exports trimmed artifacts for Vercel frontend display.

## Stack
- Next.js (App Router, TypeScript, Tailwind)
- Auth: NextAuth Credentials (admin-only controls)
- Canonical DB: Turso / libSQL via Drizzle
- Orchestration: `@langchain/langgraph`
- LLM fallback: Ollama (`qwen3:8b` by default)
- Export artifacts: `public/news-latest.json` + `data/news-latest.csv`

## Security approach
- Admin pages/APIs protected with NextAuth middleware.
- Credentials verified against Argon2 hash.
- Rate limiting on admin APIs.
- SSRF guard blocks local/private network targets during scraping.
- Extraction validator checks title/body/writer grounding in source text.

## Local setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create env file:
   ```bash
   copy .env.example .env.local
   ```
3. Generate admin hash:
   ```bash
   npm run admin:hash -- your-strong-password
   ```
4. Put hash in `.env.local` as `ADMIN_PASSWORD_HASH`.
5. Set Turso credentials in `.env.local`:
   ```bash
   DATABASE_URL=libsql://your-db-name.turso.io
   DATABASE_AUTH_TOKEN=your-turso-auth-token
   ```
6. Push schema to Turso:
   ```bash
   npm run db:push -- --force
   ```
7. Ensure Ollama is running and model exists:
   ```bash
   ollama list
   ```

## Commands
- `npm run dev`: start frontend.
- `npm run dev:with-ingest`: ingest once, then start frontend.
- `npm run ingest`: one ingestion run (recommended for scheduler).
- `npm run worker`: continuous local loop every 60 mins (optional).
- `npm run export:news`: rebuild JSON/CSV from Turso-backed articles.
- `npm run feeds:check`: validate curated feeds are reachable and first article is HTML.
- `npm run db:generate`: generate Drizzle migration SQL.
- `npm run db:push`: push schema to Turso/libSQL.
- `npm run lint`: lint checks.
- `npm run test`: unit tests.

## Curated RSS feeds
- Default feed catalog lives at `src/lib/ingestion/feeds.json`.
- To use the curated list, keep `RSS_FEEDS` empty in `.env.local`.
- To override with your own list, set `RSS_FEEDS` as comma-separated URLs.

## Scheduling every 60 minutes (Windows Task Scheduler)
1. Open Task Scheduler > Create Basic Task.
2. Trigger: Daily, repeat every `1 hour` for `1 day`.
3. Action: Start a program.
4. Program/script: `npm`
5. Add arguments: `run ingest`
6. Start in: `e:\Code\Codex-projects\nextjs tech news`

## Turso + Vercel deploy
1. Create a Turso database and auth token.
2. Add these env vars in Vercel:
   ```bash
   DATABASE_URL=libsql://your-db-name.turso.io
   DATABASE_AUTH_TOKEN=your-turso-auth-token
   NEXTAUTH_SECRET=replace-with-random-long-secret
   NEXTAUTH_URL=https://your-vercel-domain.vercel.app
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD_HASH=your-argon2-hash
   OLLAMA_BASE_URL=http://your-pc-or-private-endpoint:11434
   OLLAMA_MODEL=qwen3:8b
   ```
3. Push the schema once from your local machine:
   ```bash
   npm run db:push -- --force
   ```
4. Deploy to Vercel.
5. Run ingestion from your PC with `npm run ingest` or `npm run worker`.
6. If you want to trigger ingestion from the hosted admin UI, `OLLAMA_BASE_URL` must point to a production-reachable Ollama endpoint. If it still points to `127.0.0.1`, use the local CLI ingestion flow instead.

## Notes
- Turso is the canonical store for dedupe, retries, run history, and extracted article bodies.
- Exported JSON/CSV artifacts remain trimmed to the latest 100 articles for lightweight frontend reads.
- Slow sources use adaptive timeouts and smarter retry handling so transient failures do not stall the whole ingestion run.
