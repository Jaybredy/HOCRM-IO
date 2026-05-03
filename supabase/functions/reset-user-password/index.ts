/**
 * Reset User Password — admin-triggered temp password reset.
 *
 * POST /reset-user-password
 * Body: { email }
 * Returns: { success, email_result }
 *
 * Authorization:
 *   - Caller must be authenticated.
 *   - Caller must hold an admin role (admin / EPIC_ADMIN). Hotel-scoped
 *     resets are out of scope for v1 — escalate to an admin.
 *
 * Behavior:
 *   - Generates a fresh 12-char alphanumeric temp password.
 *   - Calls auth.admin.updateUserById to set the new password and stamp
 *     must_change_password=true + temp_password_expires_at on user_metadata.
 *     This forces /welcome/set-password on the target user's next sign-in.
 *   - Generates a magic link as recovery, sends the standard temp-password
 *     email via the existing sendInviteEmail helper.
 *   - The temp password is NEVER returned in the response — it lives only
 *     in the email so the inviter can't accidentally surface it client-side.
 */

import { corsHeadersFor } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/auth.ts';
import { sendInviteEmail } from '../_shared/resend.ts';
import { generateTempPassword, tempPasswordExpiresAt } from '../_shared/temp-password.ts';

function isAdminRole(role: string | null | undefined): boolean {
  return role === 'admin' || role === 'EPIC_ADMIN';
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeadersFor(req) });
  }

  try {
    const { supabaseUser, supabaseAdmin } = getSupabaseClient(req);

    // Verify caller is authenticated
    const { data: { user: authUser }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !authUser) {
      return jsonResponse(req, { error: 'Unauthorized', details: authErr?.message }, 401);
    }

    // Load caller's profile
    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, role, email, full_name, display_name')
      .eq('email', authUser.email)
      .single();

    if (profileErr || !callerProfile) {
      return jsonResponse(req, { error: 'Failed to load caller profile', details: profileErr?.message }, 500);
    }

    if (!isAdminRole(callerProfile.role)) {
      return jsonResponse(req, {
        error: 'Only admins can trigger password resets for other users.',
      }, 403);
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const email = body?.email;
    if (!email || typeof email !== 'string') {
      return jsonResponse(req, { error: 'email is required' }, 400);
    }

    // Find the target user in auth.users by listing through admin API.
    // Self-reset is allowed (admin resetting their own password is fine).
    const { data: usersList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      return jsonResponse(req, { error: 'Failed to look up user', details: listErr.message }, 500);
    }
    const targetAuthUser = usersList?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetAuthUser) {
      return jsonResponse(req, { error: `No user with email ${email}` }, 404);
    }

    // Generate fresh temp password and update auth user. We also preserve
    // existing metadata fields (full_name, role, etc.) so the reset doesn't
    // wipe them — Supabase merges shallow keys when you pass user_metadata.
    const tempPassword = generateTempPassword();
    const tempPasswordExpiry = tempPasswordExpiresAt();

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetAuthUser.id, {
      password: tempPassword,
      user_metadata: {
        ...(targetAuthUser.user_metadata ?? {}),
        must_change_password: true,
        temp_password_expires_at: tempPasswordExpiry,
      },
    });
    if (updateErr) {
      return jsonResponse(req, { error: 'Failed to reset password', details: updateErr.message }, 500);
    }

    // Magic link recovery URL (same role as in invite-user — fallback
    // path inside the email if the temp password gets stale).
    const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    const magicLink = linkData?.properties?.action_link ?? null;

    // Look up the target user's hotel name (best-effort) for the email body.
    let hotelName: string | null = null;
    const { data: targetProfile } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    if (targetProfile?.id) {
      const { data: access } = await supabaseAdmin
        .from('user_property_access')
        .select('property_id')
        .eq('user_email', email)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      if (access?.property_id) {
        const { data: prop } = await supabaseAdmin
          .from('properties')
          .select('hotel_id')
          .eq('id', access.property_id)
          .maybeSingle();
        if (prop?.hotel_id) {
          const { data: hotel } = await supabaseAdmin
            .from('hotels')
            .select('name')
            .eq('id', prop.hotel_id)
            .maybeSingle();
          hotelName = hotel?.name ?? null;
        }
      }
    }

    // Send the email. Failure here doesn't roll back — the password is
    // already reset and the admin can re-trigger if email delivery flaked.
    let emailResult = { sent: false, skipped: true } as { sent: boolean; skipped?: boolean; error?: string; resend_id?: string };
    if (magicLink) {
      const inviterName =
        callerProfile.display_name?.trim() ||
        callerProfile.full_name?.trim() ||
        callerProfile.email ||
        null;
      emailResult = await sendInviteEmail({
        to: email,
        magicLink,
        hotelName,
        inviterName,
        tempPassword,
        tempPasswordExpiresIn: '1 hour',
      });
    }

    return jsonResponse(req, {
      success: true,
      email,
      email_result: emailResult,
    });
  } catch (error) {
    return jsonResponse(req, { error: (error as Error).message }, 500);
  }
});
