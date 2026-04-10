/**
 * Server-side RBAC enforcement.
 * POST /rbac-check
 * Body: { capability, property_id? }
 * Returns: { allowed: bool, reason?: string }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getUserFromRequest } from '../_shared/auth.ts';

const CAPABILITIES = {
  RECORD_VIEW: 'RECORD_VIEW',
  RECORD_CREATE: 'RECORD_CREATE',
  RECORD_EDIT: 'RECORD_EDIT',
  RECORD_DELETE: 'RECORD_DELETE',
  REPORTS_VIEW: 'REPORTS_VIEW',
  REPORTS_EXPORT: 'REPORTS_EXPORT',
  DATA_EXPORT: 'DATA_EXPORT',
  USER_INVITE_MANAGE: 'USER_INVITE_MANAGE',
  PROPERTY_SETTINGS_EDIT: 'PROPERTY_SETTINGS_EDIT',
  PIPELINE_CONFIG_EDIT: 'PIPELINE_CONFIG_EDIT',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  AI_USE: 'AI_USE',
} as const;

const ALL_CAPS = Object.values(CAPABILITIES);

const ROLE_CAPABILITIES: Record<string, string[]> = {
  admin: [...ALL_CAPS],
  EPIC_ADMIN: [...ALL_CAPS],
  EPIC_MANAGER: [
    CAPABILITIES.RECORD_VIEW, CAPABILITIES.RECORD_CREATE, CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.RECORD_DELETE, CAPABILITIES.REPORTS_VIEW, CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.DATA_EXPORT, CAPABILITIES.PROPERTY_SETTINGS_EDIT,
  ],
  hotel_manager: [
    CAPABILITIES.RECORD_VIEW, CAPABILITIES.RECORD_CREATE, CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.RECORD_DELETE, CAPABILITIES.REPORTS_VIEW, CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.DATA_EXPORT, CAPABILITIES.USER_INVITE_MANAGE, CAPABILITIES.PROPERTY_SETTINGS_EDIT,
  ],
  sales_manager: [
    CAPABILITIES.RECORD_VIEW, CAPABILITIES.RECORD_CREATE, CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.REPORTS_VIEW, CAPABILITIES.REPORTS_EXPORT, CAPABILITIES.DATA_EXPORT,
  ],
  EPIC_CONTRIBUTOR: [
    CAPABILITIES.RECORD_VIEW, CAPABILITIES.RECORD_CREATE, CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.REPORTS_VIEW, CAPABILITIES.REPORTS_EXPORT,
  ],
  EPIC_VIEWER: [CAPABILITIES.RECORD_VIEW, CAPABILITIES.REPORTS_VIEW],
  CLIENT_MANAGER: [
    CAPABILITIES.RECORD_VIEW, CAPABILITIES.RECORD_CREATE, CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.RECORD_DELETE, CAPABILITIES.REPORTS_VIEW, CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.USER_INVITE_MANAGE, CAPABILITIES.PROPERTY_SETTINGS_EDIT,
  ],
  CLIENT_EDITOR: [
    CAPABILITIES.RECORD_VIEW, CAPABILITIES.RECORD_CREATE, CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.REPORTS_VIEW, CAPABILITIES.REPORTS_EXPORT,
  ],
  CLIENT_VIEWER: [CAPABILITIES.RECORD_VIEW, CAPABILITIES.REPORTS_VIEW],
};

const EPIC_ROLES = ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'EPIC_VIEWER'];

const WRITE_CAPS = [
  CAPABILITIES.RECORD_CREATE, CAPABILITIES.RECORD_EDIT, CAPABILITIES.RECORD_DELETE,
  CAPABILITIES.REPORTS_EXPORT, CAPABILITIES.PROPERTY_SETTINGS_EDIT, CAPABILITIES.USER_INVITE_MANAGE,
];

const MANAGE_CAPS = [
  CAPABILITIES.RECORD_DELETE, CAPABILITIES.USER_INVITE_MANAGE, CAPABILITIES.PROPERTY_SETTINGS_EDIT,
];

function mapLegacyRole(role: string | undefined): string {
  if (!role) return 'CLIENT_VIEWER';
  if (role === 'admin') return 'EPIC_ADMIN';
  if (role === 'user') return 'CLIENT_EDITOR';
  return role;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function logDenial(supabaseAdmin: any, email: string, role: string, capability: string, propertyId: string | null, details: string) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_email: email, actor_role: role, action: 'RBAC_DENIAL',
      property_id: propertyId || null, details, success: false,
    });
  } catch { /* audit failure must not break the check */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const { supabaseAdmin } = getSupabaseClient(req);

    // Get user profile for role
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('email', user.email)
      .single();

    const role = mapLegacyRole(profile?.role);
    const email = user.email ?? 'unknown';

    const { capability, property_id } = await req.json();

    if (!capability) {
      return json({ allowed: false, reason: 'Missing capability' }, 400);
    }

    // AI_USE hard-block for non-EPIC_ADMIN
    if (capability === CAPABILITIES.AI_USE && role !== 'EPIC_ADMIN') {
      await logDenial(supabaseAdmin, email, role, capability, property_id, 'AI_USE restricted to EPIC_ADMIN');
      return json({ allowed: false, reason: 'AI_USE restricted to EPIC_ADMIN' });
    }

    // Role-level capability check
    const roleCaps = ROLE_CAPABILITIES[role] || [];
    if (!roleCaps.includes(capability)) {
      await logDenial(supabaseAdmin, email, role, capability, property_id, `Role ${role} lacks ${capability}`);
      return json({ allowed: false, reason: `Role ${role} does not have capability ${capability}` });
    }

    // EPIC roles bypass property check
    if (EPIC_ROLES.includes(role)) {
      return json({ allowed: true });
    }

    // Client roles need valid property grant
    if (!property_id) {
      await logDenial(supabaseAdmin, email, role, capability, null, 'Client role requires property_id');
      return json({ allowed: false, reason: 'property_id required for client roles' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: grants, error: grantErr } = await supabaseAdmin
      .from('user_property_access')
      .select('*')
      .eq('user_email', email)
      .eq('property_id', property_id)
      .eq('is_active', true);

    if (grantErr) throw grantErr;

    const grant = (grants || []).find((g: any) => !g.expires_at || g.expires_at >= today);

    if (!grant) {
      await logDenial(supabaseAdmin, email, role, capability, property_id, 'No active grant for property');
      return json({ allowed: false, reason: `No access to property ${property_id}` });
    }

    if (WRITE_CAPS.includes(capability) && grant.access_level === 'VIEW') {
      await logDenial(supabaseAdmin, email, role, capability, property_id, 'VIEW grant insufficient for write capability');
      return json({ allowed: false, reason: 'Write capability requires EDIT or MANAGE access' });
    }

    if (MANAGE_CAPS.includes(capability) && grant.access_level !== 'MANAGE') {
      await logDenial(supabaseAdmin, email, role, capability, property_id, 'Non-MANAGE grant insufficient');
      return json({ allowed: false, reason: 'Manage capability requires MANAGE access level' });
    }

    return json({ allowed: true, access_level: grant.access_level });
  } catch (err: any) {
    const status = err.message === 'Unauthorized' ? 401 : 500;
    return json({ allowed: false, error: err.message }, status);
  }
});
