# Auth & Onboarding Redesign

**Status:** Draft
**Owner:** Erick
**Date:** 2026-05-01
**Trigger:** Judith (real invitee, 2026-04-10) signed in once, hasn't been able to since. `recovery_sent_at = 2026-04-30 22:20 UTC` but no session/refresh token created — link click died silently. Magic-link-only flow is too brittle for non-technical invitees.

---

## Goals

1. **Stop silent failures.** A user who clicks an expired/used link must SEE why and have a one-click way to recover.
2. **Self-healing client state.** A stale `sb-*` session in localStorage must never block a fresh sign-in or magic-link click.
3. **Friendlier first-time onboarding.** Non-technical invitees should be able to follow the email and end up signed in, even if they fumble.
4. **Optional: switch to temp-password + forced reset** as the primary onboarding flow if magic-link friction proves persistent.

## Current state — facts

- `invite-user` edge fn creates Auth user (`email_confirm: true`, no password), grants hotel access, generates a magic link via `auth.admin.generateLink({ type: 'magiclink' })`, sends invite email via Resend.
- Email template lives in `supabase/functions/_shared/resend.ts` (`sendInviteEmail`).
- Magic link expiry: `mailer_otp_exp = 3600` (1 hour).
- Site URL (where Supabase redirects after `/auth/v1/verify`): prod domain. Magic links from local dev still redirect to prod unless overridden.
- App router (`src/App.jsx`):
  - `/login` and `/auth/callback` are unauthenticated.
  - All other routes are wrapped in `AuthProvider`. `AuthenticatedApp` redirects to `/login` only when `authError.type === 'auth_required'`.
- `AuthContext.checkAppState` sets `auth_required` only on initial mount. **`SIGNED_OUT` events fired later (token expiry, manual logout) clear state but do NOT set `authError`** — so a session that dies mid-use leaves the user stuck on a blank page until they refresh.
- AuthCallback (already fixed in 2026-05-01 turn): listens to `onAuthStateChange`, parses `#error=otp_expired`, surfaces real errors, "Request a new sign-in link" button.
- Login (already fixed in 2026-05-01 turn): clears stale `sb-*` localStorage on mount, "Trouble signing in? Reset session" escape hatch.

## Phase 1 — already shipped (this session, uncommitted)

- `clearAuthStorage()` helper in `src/api/base44Client.js`.
- `AuthCallback.jsx` rewrite: error-aware, resend button, 8s backstop.
- `Login.jsx`: auto-clear stale storage on mount, "Reset session" button.

## Phase 2 — auto-clear + redirect on session loss (small fix)

**Problem:** When a session expires mid-use, `AuthContext` clears state but doesn't set `authError`. App stays mounted with no session, RLS rejects every query, user sees broken pages.

**Fix:** In `AuthContext.jsx`, when `onAuthStateChange` fires `SIGNED_OUT` (or `TOKEN_REFRESHED` returns null session):
1. `await clearAuthStorage()` to wipe `sb-*` keys.
2. Set `authError = { type: 'auth_required', message: 'Your session has expired. Please sign in again.' }`.
3. The existing `<Navigate to="/login" replace />` in `AuthenticatedApp` does the rest.

**Files:**
- `src/lib/AuthContext.jsx` — extend the `onAuthStateChange` callback.

**Effort:** ~10 min. Risk: low.

## Phase 3 — email template polish (no architecture change)

**Current template** is technically fine but reads like an automated message. For non-technical users, three changes:

1. **Lead with what they're being invited to**, not "Welcome to HOCRM". E.g., subject: `Judith — sign in to <Hotel> on HOCRM` (personal-feeling).
2. **Set expectation about expiry up front**, not in a footer. "This link works for the next hour. If it expires, just visit hocrm-io.example.com/login and click 'Send Magic Link'."
3. **Add a "first time signing in?" sub-section** with one-line instructions: "Use the same email this was sent to. If something doesn't work, click the link below to request a new sign-in link."
4. **Strip the raw URL paste** unless the button click fails (some email clients block buttons). Or move it below the fold.
5. **Add inviter signature** ("Erick from HOCRM") for trust signal.

**Files:**
- `supabase/functions/_shared/resend.ts` — rewrite `subject`, `html`, `text` in `sendInviteEmail`.

**Effort:** ~30 min. Risk: zero (cosmetic).

## Phase 4 — temp-password + forced reset (optional architecture change)

**Decision required from Erick.** Only ship this if magic-link UX is still failing real users after Phases 1–3.

**Flow:**
1. `invite-user` generates a 12-char alphanumeric temp password (no ambiguous chars: `0OIl1`).
2. Calls `auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { must_change_password: true, ... } })`.
3. Email template includes the temp password (cleartext, in the body — industry standard for invite emails) + login URL + clear "you'll be asked to choose your own password on first sign-in".
4. Login page (existing password form already works) — invitee enters email + temp password.
5. After sign-in, app router checks `user.user_metadata?.must_change_password === true`. If true, hard-redirect to `/welcome/set-password` (a new gated route).
6. `/welcome/set-password` requires a new password (min 10 chars). On submit, calls `supabase.auth.updateUser({ password, data: { must_change_password: false } })`.
7. Redirect to `/`.

**Files:**
- `supabase/functions/invite-user/index.ts` — generate password, pass to `createUser`, set metadata.
- `supabase/functions/_shared/resend.ts` — add `tempPassword` field to `InviteEmailOptions`, render in body.
- `src/pages/SetPassword.jsx` — new page (mirror Login styling).
- `src/App.jsx` — register `/welcome/set-password` route inside the auth-required wrapper.
- `src/lib/AuthContext.jsx` — expose `mustChangePassword` flag derived from session user_metadata.
- `src/lib/RequirePasswordChange.jsx` — small wrapper that redirects to `/welcome/set-password` when flag is true (applied at `AuthenticatedApp` root).

**Effort:** ~3 hours including QA. Risk: medium — this opens a real password attack surface.

**Tradeoffs:**
- (+) Familiar SaaS pattern. No "did the email arrive in time?" anxiety.
- (+) Works on shared/locked-down devices where email clients open links in unrelated browsers.
- (–) Cleartext password in email (mitigated: rotated immediately on first sign-in).
- (–) Adds a real password column to manage. Need rate-limiting on sign-in attempts (Supabase default exists but verify).
- (–) `must_change_password` flag in `user_metadata` is **not enforced server-side** — a user could call `auth.updateUser({ data: { must_change_password: false } })` themselves and skip the change. Acceptable given they already authenticated, but document it.
- (–) Existing magic-link path stays (don't remove — still useful for password-recovery).

**Recommendation:** Ship Phases 1–3 first. Re-evaluate Phase 4 after we walk Judith (or a fresh test email) through the new magic-link flow end-to-end.

## Phase 5 — testing protocol

**Test user:** new email Erick controls (TBD, will fill in during walkthrough).

**Test cases:**
1. **Happy path** — invite, click link within 1h, sign in, land on dashboard.
2. **Expired link** — invite, wait >1h, click link → AuthCallback shows "Your sign-in link has expired" + resend button → click resend → new email arrives → click → sign in.
3. **Already-used link** — invite, click link, sign out, click same link again → AuthCallback shows "already used" → resend button → new email → sign in.
4. **Stale localStorage** — invite, click link in a browser that already has a different `sb-*` token (simulate by setting localStorage manually) → sign-in still wins (Login.jsx auto-cleared on the prior visit, AuthCallback's listener catches the new SIGNED_IN).
5. **Session expiry mid-use** — sign in, manually expire the JWT in DevTools, navigate to a new page → app auto-clears storage and redirects to `/login` (Phase 2).
6. **Reset session button** — on Login page with no session, click "Trouble signing in? Reset session" → no errors, form resets.

## Open questions

1. **Subject line tone** — formal ("You've been invited to ...") or personal ("Judith, you're set up at ...")? Cast vote.
2. **Hotel name in subject** — useful for multi-tenant invitees, but most users only ever see their own hotel. Keep or drop?
3. **Inviter visible in email** — show "Erick invited you" or just "HOCRM Team"?
4. **Phase 4 password complexity** — 10 chars min? Require mixed case? Reject leaked-password-list (Supabase has built-in support)?
5. **`/welcome/set-password` skip allowed?** If user closes the tab and comes back tomorrow, are they forced to set a password again, or do we trust the metadata flip?

## Decision log

- (TBD after walkthrough): Phase 4 yes/no.
- 2026-05-01: Decided NOT to remove magic-link path — it's still the recovery flow.
- 2026-05-01: Locked: `clearAuthStorage()` wipes `sb-*` keys + signs out local. Single source of truth for "reset client auth state."
