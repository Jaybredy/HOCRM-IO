/**
 * Update User Role — change a user's role with hierarchy validation + audit log.
 *
 * POST /update-user-role
 * Body: { user_id, new_role }
 * Returns: { success, user, audit }
 *
 * Mirrors the role-hierarchy matrix used by invite-user. Caller can only
 * grant roles they're permitted to grant; cannot promote to a role above
 * their own. All changes write to audit_logs with actor, target, old_role,
 * new_role, timestamp.
 */

import { corsHeadersFor } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/auth.ts';

type Role =
  | 'user'
  | 'admin'
  | 'hotel_manager'
  | 'sales_manager'
  | 'EPIC_MANAGER'
  | 'EPIC_ADMIN'
  | 'EPIC_VIEWER';

const ROLE_HIERARCHY: Record<string, Role[]> = {
  admin:           ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'hotel_manager', 'sales_manager', 'EPIC_VIEWER', 'user'],
  EPIC_ADMIN:      ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'hotel_manager', 'sales_manager', 'EPIC_VIEWER', 'user'],
  EPIC_MANAGER:    ['hotel_manager', 'sales_manager', 'EPIC_VIEWER', 'user'],
  hotel_manager:   ['sales_manager', 'user'],
};

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

    const { data: { user: authUser }, error: authErr } = await supabaseUser.auth.getUser();
    if (authErr || !authUser) {
      return jsonResponse(req, { error: 'Unauthorized', details: authErr?.message }, 401);
    }

    const { data: callerProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('id, role, email')
      .eq('email', authUser.email)
      .single();

    if (profileErr || !callerProfile) {
      return jsonResponse(req, { error: 'Failed to load caller profile', details: profileErr?.message }, 500);
    }

    const callerRole = callerProfile.role as Role;
    const allowedRoles = ROLE_HIERARCHY[callerRole] ?? [];
    if (allowedRoles.length === 0) {
      return jsonResponse(req, { error: 'Your role is not permitted to change other users\u0027 roles' }, 403);
    }

    const body = await req.json();
    const { user_id, new_role } = body ?? {};

    if (!user_id || !new_role) {
      return jsonResponse(req, { error: 'user_id and new_role are required' }, 400);
    }

    if (!allowedRoles.includes(new_role as Role)) {
      return jsonResponse(req, {
        error: `Your role (${callerRole}) is not permitted to grant role '${new_role}'`,
        allowed_roles: allowedRoles,
      }, 403);
    }

    // Block self-modification — even admin shouldn't change their own role here
    // (the protect_role_changes_trigger already handles this at DB layer, but
    // we want a clearer error message and to skip the audit log noise).
    if (user_id === callerProfile.id) {
      return jsonResponse(req, { error: 'You cannot change your own role through this endpoint' }, 403);
    }

    // Look up target user for audit
    const { data: targetUser, error: targetErr } = await supabaseAdmin
      .from('users')
      .select('id, email, role')
      .eq('id', user_id)
      .single();

    if (targetErr || !targetUser) {
      return jsonResponse(req, { error: 'Target user not found', details: targetErr?.message }, 404);
    }

    const oldRole = targetUser.role;
    if (oldRole === new_role) {
      return jsonResponse(req, { success: true, user: targetUser, audit: null, note: 'no change' });
    }

    // Apply update via service role (bypasses the protect_role_changes_trigger;
    // we've already done the hierarchy + self-edit checks above).
    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('users')
      .update({ role: new_role })
      .eq('id', user_id)
      .select('id, email, role, full_name')
      .single();

    if (updateErr) {
      return jsonResponse(req, { error: `Failed to update role: ${updateErr.message}` }, 500);
    }

    // Audit log
    const { data: audit } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_email: callerProfile.email,
        action: 'role_change',
        entity_type: 'user',
        entity_id: user_id,
        details: {
          target_email: targetUser.email,
          old_role: oldRole,
          new_role,
          actor_role: callerRole,
        },
      })
      .select()
      .single();

    return jsonResponse(req, { success: true, user: updated, audit });
  } catch (error) {
    return jsonResponse(req, { error: (error as Error).message }, 500);
  }
});
