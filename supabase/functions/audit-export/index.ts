/**
 * Export audit + enforcement.
 * POST /audit-export
 * Body: { property_id, report_type, capability: 'REPORTS_EXPORT'|'DATA_EXPORT' }
 * Returns: { allowed: bool, reason?: string }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getUserFromRequest } from '../_shared/auth.ts';

const EPIC_ROLES = ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'EPIC_VIEWER'];

const EXPORT_CAPABILITIES: Record<string, string[]> = {
  admin:            ['REPORTS_EXPORT', 'DATA_EXPORT'],
  EPIC_ADMIN:       ['REPORTS_EXPORT', 'DATA_EXPORT'],
  EPIC_MANAGER:     ['REPORTS_EXPORT'],
  hotel_manager:    ['REPORTS_EXPORT', 'DATA_EXPORT'],
  sales_manager:    ['REPORTS_EXPORT', 'DATA_EXPORT'],
  EPIC_CONTRIBUTOR: ['REPORTS_EXPORT'],
  EPIC_VIEWER:      [],
  CLIENT_MANAGER:   ['REPORTS_EXPORT'],
  CLIENT_EDITOR:    ['REPORTS_EXPORT'],
  CLIENT_VIEWER:    [],
};

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

async function writeAuditLog(supabaseAdmin: any, opts: {
  email: string; role: string; action: string;
  propertyId: string | null; reportType: string | null;
  details: string; success: boolean;
}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_email: opts.email, actor_role: opts.role, action: opts.action,
      property_id: opts.propertyId || null, report_type: opts.reportType || null,
      details: opts.details, success: opts.success,
    });
  } catch { /* audit failure must not break the export check */ }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const { supabaseAdmin } = getSupabaseClient(req);

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('email', user.email)
      .single();

    const role = mapLegacyRole(profile?.role);
    const email = user.email ?? 'unknown';

    const { property_id, report_type, capability = 'REPORTS_EXPORT' } = await req.json();

    // Check export capability for this role
    const allowedExports = EXPORT_CAPABILITIES[role] || [];
    if (!allowedExports.includes(capability)) {
      await writeAuditLog(supabaseAdmin, {
        email, role, action: 'EXPORT_DENIED', propertyId: property_id,
        reportType: report_type, details: `Role ${role} lacks ${capability}`, success: false,
      });
      return json({ allowed: false, reason: `Role ${role} cannot ${capability}` });
    }

    // EPIC roles bypass property check
    if (EPIC_ROLES.includes(role)) {
      await writeAuditLog(supabaseAdmin, {
        email, role, action: 'EXPORT_APPROVED', propertyId: property_id,
        reportType: report_type, details: `${capability} granted`, success: true,
      });
      return json({ allowed: true });
    }

    // Client roles need valid property grant
    if (!property_id) {
      await writeAuditLog(supabaseAdmin, {
        email, role, action: 'EXPORT_DENIED', propertyId: null,
        reportType: report_type, details: 'property_id required', success: false,
      });
      return json({ allowed: false, reason: 'property_id required' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: grants, error: grantErr } = await supabaseAdmin
      .from('user_property_access')
      .select('*')
      .eq('user_email', email)
      .eq('property_id', property_id)
      .eq('is_active', true);

    if (grantErr) throw grantErr;

    const valid = (grants || []).find((g: any) => !g.expires_at || g.expires_at >= today);
    if (!valid) {
      await writeAuditLog(supabaseAdmin, {
        email, role, action: 'EXPORT_DENIED', propertyId: property_id,
        reportType: report_type, details: `No grant for property ${property_id}`, success: false,
      });
      return json({ allowed: false, reason: `No access to property ${property_id}` });
    }

    await writeAuditLog(supabaseAdmin, {
      email, role, action: 'EXPORT_APPROVED', propertyId: property_id,
      reportType: report_type, details: `${capability} granted`, success: true,
    });

    return json({ allowed: true });
  } catch (err: any) {
    const status = err.message === 'Unauthorized' ? 401 : 500;
    return json({ allowed: false, error: err.message }, status);
  }
});
