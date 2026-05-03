// Resend email helper — used by invite-user to deliver magic links.
//
// Reads RESEND_API_KEY and (optionally) RESEND_FROM_EMAIL from edge function
// secrets. If RESEND_API_KEY is not set, sendInviteEmail() returns
// { skipped: true } silently — the caller can still surface the magic_link
// directly in the response body for testing without email.
//
// Default sender: onboarding@resend.dev (Resend's sandbox; only delivers to
// addresses verified on the Resend account). Configure RESEND_FROM_EMAIL to
// a verified domain sender like "noreply@yourdomain.com" for production.

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'HOCRM-IO <onboarding@resend.dev>';

interface InviteEmailOptions {
  to: string;
  magicLink: string;
  hotelName?: string | null;
  roleLabel?: string | null;
  inviterName?: string | null;
  // Phase 4 (temp-password onboarding). When provided, the email leads with
  // the temporary password and shows the magic link as a recovery fallback.
  tempPassword?: string | null;
  // Human-readable expiry for the body, e.g. "1 hour" or "until 5:30pm".
  // The actual enforcement is app-side via must_change_password +
  // temp_password_expires_at on user_metadata.
  tempPasswordExpiresIn?: string | null;
}

export async function sendInviteEmail(opts: InviteEmailOptions): Promise<{
  sent: boolean;
  skipped?: boolean;
  error?: string;
  resend_id?: string;
}> {
  if (!RESEND_API_KEY) {
    return { sent: false, skipped: true };
  }

  const { to, magicLink, hotelName, inviterName, tempPassword, tempPasswordExpiresIn } = opts;
  // roleLabel is intentionally unused — the body keeps "{inviter} invited you to
  // {hotel}." short; the invitee sees their role on first sign-in.

  const expiryLabel = tempPasswordExpiresIn || '1 hour';

  // Subject: lead with the inviter when known, fall back to hotel/HOCRM
  const subject = inviterName && hotelName
    ? `${inviterName} invited you to ${hotelName} on HOCRM`
    : inviterName
      ? `${inviterName} invited you to HOCRM`
      : hotelName
        ? `You've been invited to ${hotelName} on HOCRM`
        : `You've been invited to HOCRM`;

  const inviterLine = inviterName ? `${escapeHtml(inviterName)} invited you` : "You've been invited";
  const hotelLine = hotelName ? ` to <strong>${escapeHtml(hotelName)}</strong>` : '';

  const tempPasswordHtml = tempPassword
    ? `
      <div style="margin: 0 0 24px; padding: 16px; background: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px;">
        <p style="margin: 0 0 6px; font-weight: 600; color: #065f46; font-size: 14px;">Your temporary password</p>
        <p style="margin: 0 0 12px; font-family: 'Menlo', 'Consolas', monospace; font-size: 18px; letter-spacing: 1px; color: #065f46; background: #fff; padding: 10px 14px; border-radius: 6px; border: 1px solid #a7f3d0; user-select: all;">${escapeHtml(tempPassword)}</p>
        <p style="margin: 0; color: #047857; font-size: 12px; line-height: 1.5;">
          Use this to sign in below. You'll be asked to set your own password right after — this temporary one stops working in <strong>${escapeHtml(expiryLabel)}</strong>.
        </p>
      </div>`
    : '';

  const recoveryNote = tempPassword
    ? `<p style="margin: 0 0 8px; color: #64748b; font-size: 12px;">
        Lost or expired? Use this <a href="${escapeAttr(magicLink)}" style="color: #2563eb;">one-time sign-in link</a> instead (also valid for ${escapeHtml(expiryLabel)}).
      </p>`
    : '';

  // Sign-in URL: when a temp password is set, point invitee to the password
  // sign-in form (the magic link is the recovery fallback inside the email).
  const signInUrl = magicLink.split('/auth/v1')[0].includes('supabase.co')
    ? extractRedirectTo(magicLink)
    : magicLink;
  const loginUrl = signInUrl ? `${signInUrl.replace(/\/$/, '')}/login` : 'https://hocrm-io.vercel.app/login';

  const html = tempPassword
    ? `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 32px auto; padding: 24px; color: #0f172a; background: #f8fafc;">
    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; color: #0f172a;">Welcome to HOCRM</h1>
      <p style="margin: 0 0 20px; color: #475569; line-height: 1.6;">
        ${inviterLine}${hotelLine}. Sign in below using the temporary password — you'll set your own password right after.
      </p>
      ${tempPasswordHtml}
      <p style="margin: 0 0 8px;">
        <a href="${escapeAttr(loginUrl)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Sign in to HOCRM
        </a>
      </p>
      <p style="margin: 0 0 24px; color: #64748b; font-size: 12px;">
        Use the email <strong>${escapeHtml(to)}</strong> with the password above.
      </p>
      ${recoveryNote}
      <p style="margin: 24px 0 0; color: #94a3b8; font-size: 12px;">
        Didn't expect this? You can ignore this email — nothing was created on your behalf.
      </p>
    </div>
  </body>
</html>`
    : `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 32px auto; padding: 24px; color: #0f172a; background: #f8fafc;">
    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; color: #0f172a;">Welcome to HOCRM</h1>
      <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
        ${inviterLine}${hotelLine}.
      </p>
      <div style="margin: 0 0 24px; padding: 12px 16px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px; color: #78350f; font-size: 13px; line-height: 1.5;">
        <strong>Heads up:</strong> the sign-in button below works for the next <strong>${escapeHtml(expiryLabel)}</strong>. After that, request a new link from the sign-in page.
      </div>
      <p style="margin: 0 0 8px;">
        <a href="${escapeAttr(magicLink)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Sign in to HOCRM
        </a>
      </p>
      <p style="margin: 0 0 24px; color: #64748b; font-size: 12px;">
        Tip: open this email on the device you'll use HOCRM from — the link signs in <em>that</em> browser.
      </p>
      <div style="margin: 0 0 16px; padding: 16px; background: #f1f5f9; border-radius: 8px;">
        <p style="margin: 0 0 6px; font-weight: 600; color: #0f172a; font-size: 14px;">First time signing in?</p>
        <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6;">
          No password needed — clicking the button above signs you in. Future visits work the same way: enter your email and request a one-time link.
        </p>
      </div>
      <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; line-height: 1.6;">
        Or paste this link in your browser:
      </p>
      <p style="margin: 0 0 24px; color: #475569; font-size: 12px; word-break: break-all; background: #f1f5f9; padding: 12px; border-radius: 6px;">
        ${escapeHtml(magicLink)}
      </p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        Didn't expect this? You can ignore this email — nothing was created on your behalf.
      </p>
    </div>
  </body>
</html>`;

  const text = tempPassword
    ? `${inviterName ? `${inviterName} invited you` : "You've been invited"}${hotelName ? ` to ${hotelName}` : ''} on HOCRM.

Sign in at ${loginUrl}
Email:    ${to}
Password: ${tempPassword}

This temporary password stops working in ${expiryLabel}. You'll set your own password the moment you sign in.

Lost or expired? Use this one-time sign-in link instead (also valid for ${expiryLabel}):
${magicLink}`
    : `${inviterName ? `${inviterName} invited you` : "You've been invited"}${hotelName ? ` to ${hotelName}` : ''} on HOCRM.

The sign-in link works for the next ${expiryLabel}:
${magicLink}

First time signing in? No password needed — clicking the link signs you in. Future visits work the same way (request a one-time link from the sign-in page).

Tip: open this email on the device you'll use HOCRM from — the link signs in that browser.

Didn't expect this? You can ignore this email — nothing was created on your behalf.`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { sent: false, error: body?.message ?? `HTTP ${res.status}` };
    }
    return { sent: true, resend_id: body?.id };
  } catch (err) {
    return { sent: false, error: (err as Error).message };
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

// Pull `redirect_to` out of the Supabase verify URL so we can build a /login
// URL on the same origin (the temp-password flow lands at /login, not on the
// verify endpoint).
function extractRedirectTo(magicLink: string): string | null {
  try {
    const url = new URL(magicLink);
    return url.searchParams.get('redirect_to');
  } catch {
    return null;
  }
}
