# Code Review — HOCRM-IO Codebase
**Date:** 2026-04-16
**Scope:** Full codebase review (React + Vite frontend, Supabase edge functions)
**Verdict:** BLOCK — 4 CRITICAL and 6 HIGH issues

---

## CRITICAL

### F001 — SSRF: Unvalidated `file_url` fetched server-side
**File:** `supabase/functions/import-uma-grc-xlsx/index.ts:341`
**Status:** Open

The edge function accepts `file_url` from the request body and calls `fetch(file_url)` with no origin validation. An admin could supply internal network URLs (e.g., AWS IMDS `169.254.169.254`).

**Fix:** Allowlist to Supabase storage origin only.

### F002 — Stack traces leaked to clients in production
**File:** `supabase/functions/import-uma-grc-xlsx/index.ts:544`
**Status:** Open

The catch block serializes `(error as Error).stack` into the HTTP response. Exposes internal file paths and runtime internals.

**Fix:** Remove `stack` from response, log server-side only.

### F003 — Production sourcemaps enabled
**File:** `vite.config.js:14`
**Status:** Open

`sourcemap: true` ships `.js.map` files alongside deployed bundles, exposing full unminified source.

**Fix:** Set `sourcemap: false` or `'hidden'`.

### F004 — Supabase URL hardcoded as bundle-visible fallback
**File:** `src/api/base44Client.js:9-11`
**Status:** Open

The Supabase project URL is hardcoded as a fallback constant that ends up in the production bundle regardless of env vars.

**Fix:** Remove the fallback; require env var.

---

## HIGH

### F005 — Role updates bypass server-side authorization
**File:** `src/pages/UserManagement.jsx:66-70`
**Status:** Open

`base44.entities.User.update(id, { role })` goes directly to Supabase REST API via the adapter. No edge function, no server-side role check. Any authenticated user who discovers the users table name could promote themselves to admin unless RLS blocks it.

### F006 — Hardcoded production entity ID
**Files:** `supabase/functions/import-uma-grc-xlsx/index.ts:17`, `src/pages/Bookings.jsx:304`, `src/components/crm/ProductionForm.jsx:79`
**Status:** Open

`'699773a2a2b93e6ce09fb42c'` is a Base44-era MongoDB ObjectID hardcoded in server and client. Should be an env var or lookup by stable slug.

### F007 — Hardcoded internal email in edge function
**File:** `supabase/functions/link-past-bookings-to-clients/index.ts:43`
**Status:** Open

`ayesha@epic-rev.com` embedded as a filter value. Should be a parameter.

### F008 — CORS wildcard on all edge functions
**File:** `supabase/functions/_shared/cors.ts:2`
**Status:** Open

`Access-Control-Allow-Origin: *` allows any website to make requests. Should be restricted to Vercel deployment origin.

### F009 — UserManagement UI blocks entitled hotel managers
**File:** `src/pages/UserManagement.jsx:85-98`
**Status:** Open

The admin check blocks hotel_managers from the UI, but the invite-user edge function allows them.

### F010 — In-memory rate limiter resets on cold start
**File:** `supabase/functions/ai-gateway/index.ts:12-14`
**Status:** Open

`dailyUsage` Map lives in isolate memory. Cold starts reset it, making the 50-call/day limit trivially bypassable.

---

## MEDIUM

### F011 — Unbounded SELECT * on production_items
**Files:** `supabase/functions/import-uma-grc-xlsx/index.ts:351`, `src/pages/CRM.jsx:93`, `src/pages/ProductionCalendar.jsx:54`
**Status:** Open

Highest-volume table loaded with no LIMIT or date filter on 5 pages and in the import function.

### F012 — getSession() used for token forwarding
**File:** `src/api/base44Client.js:232,247,267,302`
**Status:** Open

`getSession()` returns from local storage without server validation. Lower risk for token forwarding (edge function validates), but `auth.me()` at line 163 also uses it.

### F013 — Inconsistent role taxonomy client vs server
**Files:** `src/components/rbac/rbac.jsx:5-17`, `supabase/functions/rbac-check/index.ts:28-60`
**Status:** Open

Client maps `EPIC_ADMIN` → `'admin'`; server treats them as separate. Can desync.

### F014 — No React Error Boundary
**Files:** `src/App.jsx`, `src/Layout.jsx`
**Status:** Open

No `componentDidCatch` wrapper. Uncaught render errors crash to white screen.

### F015 — console.log left in production adapter
**File:** `src/api/base44Client.js:311`
**Status:** Open

`console.log('invite-user response:', response)` logs full response including potential tokens.

### F016 — No file size/type validation before XLSX parse
**File:** `supabase/functions/import-uma-grc-xlsx/index.ts:341-349`
**Status:** Open

No size check or content-type validation. Could OOM the Deno isolate with large files.

---

## LOW

### F017 — Dead mock page in production bundle
**File:** `src/pages/ClientProfileMock.jsx`
**Status:** Open

Design-time prototype with hardcoded sample data. Adds to bundle size.

### F018 — appLogs.logUserInApp floods console
**File:** `src/api/base44Client.js:286`
**Status:** Open

`console.debug` on every page navigation.

### F019 — name_overrides in localStorage not synced
**File:** `src/pages/AccessManagement.jsx:30,118`
**Status:** Open

Display name overrides per-browser, not synced across admin users.

### F020 — TODOs without issue references
**File:** `src/components/rbac/rbac.jsx:43,48,54,58,63`
**Status:** Open

Multiple `// NOTE:` comments lack ticket references. `'user'` role has no capabilities entry.

### F021 — No security headers in vercel.json
**File:** `vercel.json`
**Status:** Open

No CSP, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy headers.
