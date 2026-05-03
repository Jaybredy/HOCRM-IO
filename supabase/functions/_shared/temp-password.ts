// Shared helpers for the temp-password onboarding/reset flow.
// Used by invite-user (first-time invite) and reset-user-password (admin
// triggers a fresh temp password for an existing user).

// Excludes ambiguous chars (0/O, 1/I/l) so the user can type the password
// from the email without misreads. No special chars per product decision —
// keeps copy/paste reliable across email clients.
const TEMP_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

// 1 hour. Matches Supabase's default magic-link expiry so both recovery
// channels in the same email expire at the same time.
export const TEMP_PASSWORD_TTL_MS = 60 * 60 * 1000;

export function generateTempPassword(length = 12): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => TEMP_PASSWORD_CHARS[b % TEMP_PASSWORD_CHARS.length]).join('');
}

export function tempPasswordExpiresAt(): string {
  return new Date(Date.now() + TEMP_PASSWORD_TTL_MS).toISOString();
}
