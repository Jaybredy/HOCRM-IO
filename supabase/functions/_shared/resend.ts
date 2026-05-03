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

  const { to, magicLink, hotelName, roleLabel, inviterName } = opts;

  // Subject: lead with the inviter when known, fall back to hotel/HOCRM
  const subject = inviterName && hotelName
    ? `${inviterName} invited you to ${hotelName} on HOCRM`
    : inviterName
      ? `${inviterName} invited you to HOCRM`
      : hotelName
        ? `You've been invited to ${hotelName} on HOCRM`
        : `You've been invited to HOCRM`;

  const inviterLine = inviterName ? `${escapeHtml(inviterName)} invited you` : "You've been invited";
  const roleLine = roleLabel ? ` as <strong>${escapeHtml(roleLabel)}</strong>` : '';
  const hotelLine = hotelName ? ` at <strong>${escapeHtml(hotelName)}</strong>` : '';

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 32px auto; padding: 24px; color: #0f172a; background: #f8fafc;">
    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; color: #0f172a;">Welcome to HOCRM</h1>
      <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
        ${inviterLine}${roleLine}${hotelLine}.
      </p>
      <div style="margin: 0 0 24px; padding: 12px 16px; background: #fef3c7; border-left: 3px solid #f59e0b; border-radius: 4px; color: #78350f; font-size: 13px; line-height: 1.5;">
        <strong>Heads up:</strong> the sign-in button below works for the next <strong>1 hour</strong>. After that, request a new link from the sign-in page.
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

  const text = `${inviterName ? `${inviterName} invited you` : "You've been invited"}${roleLabel ? ` as ${roleLabel}` : ''}${hotelName ? ` at ${hotelName}` : ''} on HOCRM.

The sign-in link works for the next 1 hour:
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
