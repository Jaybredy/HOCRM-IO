/**
 * Invite User — Creates a Supabase Auth account + users table row + hotel access.
 *
 * POST /invite-user
 * Body: { email, role, hotel_id?, full_name? }
 * Returns: { success, user, magic_link }
 *
 * Authorization:
 *   - Caller must be authenticated.
 *   - Caller's role determines which roles they may grant (see ROLE_HIERARCHY below).
 *   - For non-admin callers: hotel_id is required, and the caller must have write
 *     access to that hotel (via has_hotel_write_access()).
 *   - For admin callers: hotel_id is optional; if provided, the invitee is granted
 *     access to that hotel. If omitted, the invitee starts with no hotel access.
 */

import { corsHeadersFor } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/auth.ts';
import { sendInviteEmail } from '../_shared/resend.ts';

type Role =
  | 'user'
  | 'admin'
  | 'hotel_manager'
  | 'sales_manager'
  | 'EPIC_MANAGER'
  | 'EPIC_ADMIN'
  | 'EPIC_VIEWER';

// Who can invite whom. Platform roles (EPIC_*) can only be granted by admins / EPIC_MANAGER.
// hotel_manager can only grant hotel-scoped sub-roles.
const ROLE_HIERARCHY: Record<string, Role[]> = {
  admin:           ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'hotel_manager', 'sales_manager', 'EPIC_VIEWER', 'user'],
  EPIC_ADMIN:      ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'hotel_manager', 'sales_manager', 'EPIC_VIEWER', 'user'],
  EPIC_MANAGER:    ['hotel_manager', 'sales_manager', 'EPIC_VIEWER', 'user'],
  hotel_manager:   ['sales_manager', 'user'],
};

// Maps invitee role → access_level to grant on user_property_access
const ACCESS_LEVEL_BY_ROLE: Record<Role, 'VIEW' | 'EDIT' | 'MANAGE'> = {
  admin:          'MANAGE',
  EPIC_ADMIN:     'MANAGE',
  EPIC_MANAGER:   'MANAGE',
  hotel_manager:  'MANAGE',
  sales_manager:  'EDIT',
  EPIC_VIEWER:    'VIEW',
  user:           'VIEW',
};

// Maps user_role → property_access_role (separate enum).
// property_access_role only has: hotel_manager, sales_manager, EPIC_MANAGER, EPIC_VIEWER.
// For user_roles that don't have a direct property_access_role, we pick the closest match.
const PROPERTY_ACCESS_ROLE_BY_ROLE: Record<Role, string> = {
  admin:          'hotel_manager',  // admins don't need property access, but if granted, treat as hotel_manager
  EPIC_ADMIN:     'hotel_manager',
  EPIC_MANAGER:   'EPIC_MANAGER',
  hotel_manager:  'hotel_manager',
  sales_manager:  'sales_manager',
  EPIC_VIEWER:    'EPIC_VIEWER',
  user:           'sales_manager',  // closest match for "base user at a hotel"
};

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
      .select('id, role')
      .eq('email', authUser.email)
      .single();

    if (profileErr || !callerProfile) {
      return jsonResponse(req, { error: 'Failed to load caller profile', details: profileErr?.message }, 500);
    }

    const callerRole = callerProfile.role as Role;
    const allowedRoles = ROLE_HIERARCHY[callerRole] ?? [];
    if (allowedRoles.length === 0) {
      return jsonResponse(req, { error: 'Your role is not permitted to invite users' }, 403);
    }

    // Parse & validate request body
    const body = await req.json();
    const { email, role = 'user', hotel_id = null, full_name = '' } = body ?? {};

    if (!email || typeof email !== 'string') {
      return jsonResponse(req, { error: 'email is required' }, 400);
    }
    if (!allowedRoles.includes(role as Role)) {
      return jsonResponse(req, {
        error: `Your role (${callerRole}) is not permitted to grant role '${role}'`,
        allowed_roles: allowedRoles,
      }, 403);
    }

    // Non-admin callers MUST provide a hotel_id and have write access to it.
    // has_hotel_write_access() relies on auth.uid() → current_user_email(), so we must
    // invoke it through the USER-scoped client (supabaseUser), not the service-role one.
    if (!isAdminRole(callerRole)) {
      if (!hotel_id) {
        return jsonResponse(req, { error: 'hotel_id is required for non-admin callers' }, 400);
      }
      const { data: hasAccess, error: accessErr } = await supabaseUser
        .rpc('has_hotel_write_access', { p_hotel_id: hotel_id });
      if (accessErr) {
        return jsonResponse(req, { error: 'Failed to verify hotel access', details: accessErr.message }, 500);
      }
      if (!hasAccess) {
        return jsonResponse(req, { error: 'You do not have write access to this hotel' }, 403);
      }
    }

    // If hotel_id provided, verify the hotel exists
    if (hotel_id) {
      const { data: hotel, error: hotelErr } = await supabaseAdmin
        .from('hotels')
        .select('id, name')
        .eq('id', hotel_id)
        .single();
      if (hotelErr || !hotel) {
        return jsonResponse(req, { error: 'Hotel not found', hotel_id }, 404);
      }
    }

    // Check if user already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return jsonResponse(req, { error: 'User with this email already exists' }, 409);
    }

    // Create Supabase Auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: full_name || '', role, invited_hotel_id: hotel_id ?? null },
    });

    if (authError || !authData?.user) {
      return jsonResponse(req, { error: `Auth error: ${authError?.message}` }, 400);
    }

    const newAuthUid = authData.user.id;

    // Create users table row (link auth_uid explicitly; Phase 1 fix-up depended on this)
    // display_name is a short, stable handle derived from the email-local-part —
    // never the full_name. Mixing them causes the dashboard greeting to read
    // "Good evening, Test Five!" instead of the user's actual handle.
    const { data: userRow, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        full_name: full_name || '',
        role,
        display_name: email.split('@')[0],
        auth_uid: newAuthUid,
      })
      .select()
      .single();

    if (insertError) {
      await supabaseAdmin.auth.admin.deleteUser(newAuthUid).catch(() => {});
      return jsonResponse(req, { error: `Database error: ${insertError.message}` }, 500);
    }

    // If hotel_id is set, grant hotel access via user_property_access
    let propertyAccessRow = null;
    if (hotel_id) {
      // Ensure a property row exists for this hotel (auto-create from hotel name)
      const { data: property, error: propErr } = await supabaseAdmin
        .from('properties')
        .select('id')
        .eq('hotel_id', hotel_id)
        .maybeSingle();

      let propertyId = property?.id;
      if (!propertyId) {
        // No property exists for this hotel — create one
        const { data: hotel } = await supabaseAdmin
          .from('hotels')
          .select('name, address, city, state, zip')
          .eq('id', hotel_id)
          .single();

        // properties has: name, type, address, details (jsonb), status, hotel_id
        // (no city/state/zip — those live on hotels). Stash them in details for now.
        const { data: newProp, error: createPropErr } = await supabaseAdmin
          .from('properties')
          .insert({
            name: hotel?.name ?? 'Unnamed Property',
            address: hotel?.address ?? null,
            type: 'hotel',
            details: { city: hotel?.city ?? null, state: hotel?.state ?? null, zip: hotel?.zip ?? null },
            hotel_id,
          })
          .select('id')
          .single();

        if (createPropErr) {
          // Rollback user creation
          await supabaseAdmin.from('users').delete().eq('id', userRow.id);
          await supabaseAdmin.auth.admin.deleteUser(newAuthUid).catch(() => {});
          return jsonResponse(req, { error: `Failed to create property for hotel: ${createPropErr.message}` }, 500);
        }
        propertyId = newProp.id;
      }

      // Grant access
      const { data: upaRow, error: upaErr } = await supabaseAdmin
        .from('user_property_access')
        .insert({
          user_email: email,
          property_id: propertyId,
          role_at_property: PROPERTY_ACCESS_ROLE_BY_ROLE[role as Role],
          access_level: ACCESS_LEVEL_BY_ROLE[role as Role],
          granted_by: callerProfile.id,
          is_active: true,
        })
        .select()
        .single();

      if (upaErr) {
        await supabaseAdmin.from('users').delete().eq('id', userRow.id);
        await supabaseAdmin.auth.admin.deleteUser(newAuthUid).catch(() => {});
        return jsonResponse(req, { error: `Failed to grant hotel access: ${upaErr.message}` }, 500);
      }
      propertyAccessRow = upaRow;
    }

    // Generate magic link so invitee can sign in without a password
    const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    const magicLink = resetData?.properties?.action_link ?? null;

    // Look up hotel name for the email body (best-effort; never blocks invite)
    let hotelName: string | null = null;
    if (hotel_id) {
      const { data: h } = await supabaseAdmin.from('hotels').select('name').eq('id', hotel_id).maybeSingle();
      hotelName = h?.name ?? null;
    }

    // Send the invite email via Resend. Failure here doesn't roll back the
    // invite — the magic_link is still returned in the response so the
    // inviter can copy/paste it manually if email delivery fails.
    let emailResult = { sent: false, skipped: true } as { sent: boolean; skipped?: boolean; error?: string; resend_id?: string };
    if (magicLink) {
      emailResult = await sendInviteEmail({
        to: email,
        magicLink,
        hotelName,
        roleLabel: role,
        inviterName: callerProfile.email ?? null,
      });
    }

    return jsonResponse(req, {
      success: true,
      user: userRow,
      hotel_access: propertyAccessRow,
      magic_link: magicLink,
      email: emailResult,
    });
  } catch (error) {
    return jsonResponse(req, { error: (error as Error).message }, 500);
  }
});
