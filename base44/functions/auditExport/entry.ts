/**
 * Server-side export audit + enforcement.
 * POST /auditExport
 * Body: { property_id, report_type, capability: 'REPORTS_EXPORT'|'DATA_EXPORT' }
 * Returns: { allowed: bool }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EPIC_ROLES = ['EPIC_ADMIN', 'EPIC_MANAGER', 'EPIC_VIEWER'];

const ROLE_CAPABILITIES = {
  EPIC_ADMIN:     ['REPORTS_EXPORT','DATA_EXPORT'],
  EPIC_MANAGER:   ['REPORTS_EXPORT'],
  EPIC_VIEWER:    [],
  CLIENT_MANAGER: ['REPORTS_EXPORT'],
  CLIENT_EDITOR:  ['REPORTS_EXPORT'],
  CLIENT_VIEWER:  [],
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ allowed: false, reason: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { property_id, report_type, capability = 'REPORTS_EXPORT' } = body;
    const rawRole = user.role || 'CLIENT_VIEWER';
    const role = rawRole === 'admin' ? 'EPIC_ADMIN' : rawRole === 'user' ? 'CLIENT_EDITOR' : rawRole;
    const roleCaps = ROLE_CAPABILITIES[role] || [];

    if (!roleCaps.includes(capability)) {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_role: role,
        action: 'ACCESS_DENIED',
        property_id: property_id || null,
        report_type: report_type || null,
        details: `Export blocked: role ${role} lacks ${capability}`,
        success: false,
      });
      return Response.json({ allowed: false, reason: `Role ${role} cannot ${capability}` });
    }

    // Client roles: verify property access
    if (!EPIC_ROLES.includes(role)) {
      if (!property_id) {
        return Response.json({ allowed: false, reason: 'property_id required' });
      }

      const today = new Date().toISOString().slice(0, 10);
      const grants = await base44.asServiceRole.entities.UserPropertyAccess.filter({
        user_email: user.email,
        property_id,
        is_active: true,
      });

      const valid = grants.find(g => !g.expires_at || g.expires_at >= today);
      if (!valid) {
        await base44.asServiceRole.entities.AuditLog.create({
          actor_email: user.email,
          actor_role: role,
          action: 'ACCESS_DENIED',
          property_id,
          report_type: report_type || null,
          details: `Export blocked: no grant for property ${property_id}`,
          success: false,
        });
        return Response.json({ allowed: false, reason: `No access to property ${property_id}` });
      }
    }

    // Allowed — write audit log
    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: user.email,
      actor_role: role,
      action: 'EXPORT_REPORT',
      property_id: property_id || null,
      report_type: report_type || null,
      details: `${capability} granted`,
      success: true,
    });

    return Response.json({ allowed: true });

  } catch (error) {
    return Response.json({ allowed: false, reason: error.message }, { status: 500 });
  }
});