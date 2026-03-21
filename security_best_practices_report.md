# Security Best Practices Report

## Executive Summary
I reviewed the current integrated repo state with emphasis on auth/admin/API surfaces, origin and caching behavior, secret exposure, ingestion-trigger safety, and request validation. I found four concrete issues and patched them directly: a CSRF gap on the admin ingestion trigger, redirect-follow SSRF exposure, a production auth-secret fallback to a dev value, and an under-validated public signup endpoint. I also hardened cache headers and rate-limit keying.

## Findings

### 1. [High] Admin ingestion trigger was missing a strict same-origin gate
`src/app/api/admin/ingest/route.ts` now rejects cross-site POSTs before session evaluation, and `src/lib/auth/access.ts` only accepts the configured canonical origin.

Impact: an authenticated admin could previously be tricked by a third-party site into starting an ingestion run with a forged browser POST.

Fix: same-origin validation plus `Cache-Control: no-store` on privileged admin responses.

References: [`src/app/api/admin/ingest/route.ts`](./src/app/api/admin/ingest/route.ts#L28), [`src/lib/auth/access.ts`](./src/lib/auth/access.ts#L43)

### 2. [High] SSRF validation did not survive redirects
`src/lib/ssrf.ts` now validates each redirect hop manually instead of letting `fetch()` follow redirects automatically.

Impact: a permitted public article URL could redirect to a private or loopback target after the initial URL check.

Fix: manual redirect handling, per-hop URL validation, and additional private-IP blocking for IPv4-mapped IPv6 targets and common metadata hostnames.

References: [`src/lib/ssrf.ts`](./src/lib/ssrf.ts#L157), [`src/lib/ssrf.ts`](./src/lib/ssrf.ts#L222)

### 3. [High] Production could fall back to a dev auth secret
`src/lib/config.ts` now fails fast in production if `NEXTAUTH_SECRET` / `AUTH_SECRET` is missing.

Impact: the app could otherwise start with a predictable development secret, weakening session integrity.

Fix: production startup now throws if no real secret is configured.

References: [`src/lib/config.ts`](./src/lib/config.ts#L28)

### 4. [Medium] Public signup accepted unstructured JSON without a hard schema or body bound
`src/app/api/public/auth/signup/route.ts` now enforces a strict runtime schema and a maximum request body size.

Impact: malformed or oversized payloads could reach downstream validation and create unnecessary parsing / abuse risk.

Fix: Zod schema validation plus a 16 KB request-body cap.

References: [`src/app/api/public/auth/signup/route.ts`](./src/app/api/public/auth/signup/route.ts#L11)

### 5. [Medium] Rate-limit keys were easy to skew with raw request metadata
`src/lib/rate-limit.ts` now normalizes client identifiers before they become DB keys, and the auth/signup/admin flows use the shared helper.

Impact: spoofable header values could create noisy or inconsistent throttling keys.

Fix: normalized IP extraction, key sanitization, and centralized helper usage.

References: [`src/lib/rate-limit.ts`](./src/lib/rate-limit.ts#L7), [`src/lib/auth/options.ts`](./src/lib/auth/options.ts#L54), [`src/app/api/public/auth/signup/route.ts`](./src/app/api/public/auth/signup/route.ts#L17), [`src/app/api/admin/ingest/route.ts`](./src/app/api/admin/ingest/route.ts#L14)

## Additional Hardening
- `src/lib/auth/options.ts` now uses the parsed canonical app origin for secure cookie decisions.
- Admin status and ingestion responses now send `Cache-Control: no-store`.

## Verification
- `npm run lint`
- `npm test`

## Files Changed
- [`src/app/api/admin/ingest/route.ts`](./src/app/api/admin/ingest/route.ts)
- [`src/app/api/admin/ingest/status/route.ts`](./src/app/api/admin/ingest/status/route.ts)
- [`src/app/api/public/auth/signup/route.ts`](./src/app/api/public/auth/signup/route.ts)
- [`src/lib/auth/access.ts`](./src/lib/auth/access.ts)
- [`src/lib/auth/options.ts`](./src/lib/auth/options.ts)
- [`src/lib/config.ts`](./src/lib/config.ts)
- [`src/lib/rate-limit.ts`](./src/lib/rate-limit.ts)
- [`src/lib/ssrf.ts`](./src/lib/ssrf.ts)
