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

  const subject = hotelName
    ? `You've been invited to ${hotelName} on HOCRM`
    : `You've been invited to HOCRM`;

  const greeting = inviterName ? `${inviterName} invited you` : 'You\u0027ve been invited';
  const roleLine = roleLabel ? ` as <strong>${escapeHtml(roleLabel)}</strong>` : '';
  const hotelLine = hotelName ? ` at <strong>${escapeHtml(hotelName)}</strong>` : '';

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 32px auto; padding: 24px; color: #0f172a; background: #f8fafc;">
    <div style="background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; color: #0f172a;">Welcome to HOCRM</h1>
      <p style="margin: 0 0 24px; color: #475569; line-height: 1.6;">
        ${greeting}${roleLine}${hotelLine}. Click the button below to sign in — no password needed.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${escapeAttr(magicLink)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Sign in to HOCRM
        </a>
      </p>
      <p style="margin: 0 0 8px; color: #64748b; font-size: 13px; line-height: 1.6;">
        Or paste this link in your browser:
      </p>
      <p style="margin: 0 0 24px; color: #475569; font-size: 12px; word-break: break-all; background: #f1f5f9; padding: 12px; border-radius: 6px;">
        ${escapeHtml(magicLink)}
      </p>
      <p style="margin: 0; color: #94a3b8; font-size: 12px;">
        Didn't expect this? You can ignore this email. The link expires in 1 hour.
      </p>
    </div>
  </body>
</html>`;

  const text = `${greeting}${roleLabel ? ` as ${roleLabel}` : ''}${hotelName ? ` at ${hotelName}` : ''} on HOCRM.

Click to sign in (no password needed):
${magicLink}

Didn't expect this? You can ignore this email. The link expires in 1 hour.`;

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
