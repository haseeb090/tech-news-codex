# Tech Radar News

Next.js monolith that ingests tech news from RSS feeds, extracts full article content with a LangGraph workflow + Ollama fallback, stores canonical state in local SQLite, and exports trimmed artifacts for Vercel frontend display.

## Stack
- Next.js (App Router, TypeScript, Tailwind)
- Auth: NextAuth Credentials (admin-only controls)
- Local DB: SQLite (`data/news.db`)
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
5. Ensure Ollama is running and model exists:
   ```bash
   ollama list
   ```

## Commands
- `npm run dev`: start frontend.
- `npm run dev:with-ingest`: ingest once, then start frontend.
- `npm run ingest`: one ingestion run (recommended for scheduler).
- `npm run worker`: continuous local loop every 60 mins (optional).
- `npm run export:news`: rebuild JSON/CSV from SQLite.
- `npm run feeds:check`: validate curated feeds are reachable and first article is HTML.
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

## Vercel flow
- Vercel reads `public/news-latest.json` for rendering.
- Hourly local ingestion updates SQLite + exports artifacts.
- Commit and push updated artifacts when you want Vercel to display latest data.

## Notes
- SQLite remains local canonical state for dedupe/retries/history.
- JSON/CSV artifacts are trimmed to latest 100 articles for lightweight deploys.
