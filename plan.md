# Plan: Next.js Tech News Monolith with Local AI Ingestion + Vercel Frontend

## Summary
Build a single Next.js monolith (App Router + TypeScript + Tailwind) with:
- Local ingestion pipeline every 60 minutes (run on your machine, backed by Ollama).
- AI-assisted extraction orchestrated with **LangGraph** (best fit for manager + per-article worker workflow).
- Canonical local state in **SQLite** (dedupe, retries, run logs), with trimmed exports (`100` latest) to repo artifacts for Vercel rendering.
- Secure admin controls via **NextAuth Credentials**; public feed remains readable without login.

## Implementation Changes
1. **Project foundation**
- Initialize Next.js + Tailwind monolith with scripts:
  - `npm run dev` (frontend)
  - `npm run ingest` (one-shot ingestion)
  - `npm run worker` (optional local loop for testing)
  - `npm run export:news` (emit CSV + JSON artifacts)
- Add env config for Ollama base URL/model, admin credentials hash, feed overrides, retry limits, and concurrency.

2. **Data model (SQLite as source of truth)**
- `feeds`: source metadata and active flag.
- `articles`: canonical URL, normalized URL hash, title, body, writer, source, published date, status, retry counters, failure reason, timestamps.
- `ingest_runs`: run-level metrics (fetched links, new links, succeeded, failed, duration).
- `article_attempts`: per-attempt logs for observability/audit.
- Keep full history in SQLite; export only latest `100` successful articles to `public/news-latest.json` + `data/news-latest.csv`.

3. **Ingestion + agent orchestration (LangGraph + Ollama)**
- **Feed stage**: fetch curated RSS list, normalize URLs, dedupe against DB.
- **Queue stage**: enqueue new links + failed links eligible by cooldown/retry policy.
- **LangGraph flow** (per article, concurrency-limited):
  1. `fetch_html` (HTTP fetch with timeout/retry/user-agent)
  2. `deterministic_extract` (Readability + schema.org/meta/byline heuristics)
  3. `quality_gate` (required fields + minimum body quality)
  4. `llm_fallback_extract` (Ollama `qwen3:8b`, strict structured output schema)
  5. `anti_hallucination_validate` (verify extracted claims/snippets exist in fetched text; reject unsupported output)
  6. `persist` (transactional write + status/retry updates)
- **Manager behavior**: collects worker outcomes, writes run summary, triggers export artifact refresh.
- Retry policy: bounded retries + exponential cooldown; persistent failures remain visible for admin retry.

4. **Frontend/UI (Editorial Tech-Mag style)**
- Public pages:
  - Home feed with bold hero, topic/source chips, searchable/sortable article grid.
  - Article detail view with clean typography and source attribution.
- Admin pages (auth required):
  - Login page.
  - Admin dashboard: last run stats, failed queue, manual re-run button, ingestion health.
- Core components:
  - `TopNav`, `HeroSection`, `FeedFilters`, `ArticleGrid`, `ArticleCard`, `ArticleMeta`, `IngestionStatusPanel`, `FailedItemsTable`.
- Data rendering on Vercel reads exported JSON artifact (no runtime SQLite dependency).

5. **Security and hardening**
- NextAuth Credentials with secure password hash verification (`argon2`), secure cookie/session settings, least-privilege admin role.
- Protect admin routes and admin APIs with middleware/session checks.
- Add login/admin endpoint rate limiting and audit logs.
- Sanitize extracted HTML to plain text before storage/rendering.
- Enforce SSRF-safe fetch rules (http/https only, no local/private network targets, redirect limits).

6. **Ops/deploy model**
- Local machine: run hourly ingestion via **Windows Task Scheduler** calling `npm run ingest`.
- Vercel: deploy frontend from repo; updated artifacts appear after manual commit/push.
- Keep feed list curated by default, with env override for custom sources.

## Public APIs / Interfaces / Types
- Admin API:
  - `POST /api/admin/ingest` (manual trigger, auth required)
  - `GET /api/admin/ingest/status` (last run + queue stats, auth required)
- Public API:
  - `GET /api/news` (returns latest exported articles with filters)
- Shared types:
  - `ArticleRecord`, `ArticleStatus`, `IngestRunSummary`, `ExtractedArticle`, `ValidationResult`.

## Test Plan
- Unit:
  - URL normalization/deduplication.
  - Deterministic extractor parsers (title/body/writer fallbacks).
  - Anti-hallucination validator (reject unsupported fields).
- Integration:
  - End-to-end ingestion with mocked RSS + HTML fixtures.
  - Retry/cooldown behavior and status transitions.
  - Export trimming to exactly 100 latest successful records.
- Security:
  - Admin route protection, credential validation, rate-limit behavior.
  - SSRF guard tests for blocked targets.
- E2E (Playwright):
  - Public feed load/filter/search.
  - Admin login + manual retry workflow.

## TODO Checklist (Execution Order)
- [x] 1. Scaffold Next.js + Tailwind + TypeScript monolith and scripts.
- [x] 2. Implement SQLite schema + migrations + repository layer.
- [x] 3. Build RSS fetch + URL normalization + dedupe pipeline.
- [x] 4. Implement LangGraph workflow nodes and manager orchestration.
- [x] 5. Add anti-hallucination validation and retry/cooldown logic.
- [x] 6. Implement export pipeline (JSON + CSV, top 100 trim).
- [x] 7. Build public editorial UI components and pages.
- [x] 8. Integrate NextAuth Credentials + admin middleware + protected APIs.
- [x] 9. Build admin dashboard (run stats, failed items, manual retry).
- [ ] 10. Add tests (unit/integration/security/E2E). (Completed: unit. Pending: integration, security, E2E.)
- [x] 11. Add Task Scheduler setup docs and Vercel deployment docs.
- [ ] 12. Add observability logs and runbook for failure recovery. (Completed: structured logging basics. Pending: dedicated runbook/failure SOP doc.)

## Assumptions and Defaults
- Default LLM: `qwen3:8b` via local Ollama (`http://localhost:11434` unless overridden).
- Curated RSS defaults shipped in code; configurable via env.
- Manual git commit/push is used to propagate artifact updates to Vercel.
- Credentials-based auth is accepted; only admin operations require login.
- SQLite is local canonical store; Vercel serves exported artifact data.
