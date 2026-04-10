/**
 * Server-side RBAC enforcement function.
 * Called by the frontend OR used internally to validate access.
 *
 * POST /rbacCheck
 * Body: { capability, property_id?, entity_type?, entity_id?, action_context? }
 * Returns: { allowed: bool, reason?: string }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const EPIC_ROLES = ['EPIC_ADMIN', 'EPIC_MANAGER', 'EPIC_VIEWER'];

const ROLE_CAPABILITIES = {
  EPIC_ADMIN:     ['RECORD_VIEW','RECORD_CREATE','RECORD_EDIT','RECORD_DELETE','REPORTS_VIEW','REPORTS_EXPORT','DATA_EXPORT','USER_INVITE_MANAGE','PROPERTY_SETTINGS_EDIT','PIPELINE_CONFIG_EDIT','PLATFORM_ADMIN','AI_USE'],
  EPIC_MANAGER:   ['RECORD_VIEW','RECORD_CREATE','RECORD_EDIT','REPORTS_VIEW','REPORTS_EXPORT','USER_INVITE_MANAGE'],
  EPIC_VIEWER:    ['RECORD_VIEW','REPORTS_VIEW'],
  CLIENT_MANAGER: ['RECORD_VIEW','RECORD_CREATE','RECORD_EDIT','RECORD_DELETE','REPORTS_VIEW','REPORTS_EXPORT','USER_INVITE_MANAGE','PROPERTY_SETTINGS_EDIT'],
  CLIENT_EDITOR:  ['RECORD_VIEW','RECORD_CREATE','RECORD_EDIT','REPORTS_VIEW','REPORTS_EXPORT'],
  CLIENT_VIEWER:  ['RECORD_VIEW','REPORTS_VIEW'],
};

const WRITE_CAPS = ['RECORD_CREATE','RECORD_EDIT','RECORD_DELETE','REPORTS_EXPORT','PROPERTY_SETTINGS_EDIT','USER_INVITE_MANAGE'];
const MANAGE_CAPS = ['RECORD_DELETE','USER_INVITE_MANAGE','PROPERTY_SETTINGS_EDIT'];

async function writeAuditLog(base44, actor, resolvedRole, action, body, success, details) {
  try {
    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: actor?.email || 'unknown',
      actor_role: resolvedRole || actor?.role || 'unknown',
      action,
      property_id: body?.property_id || null,
      entity_type: body?.entity_type || null,
      entity_id: body?.entity_id || null,
      report_type: body?.report_type || null,
      details,
      success,
    });
  } catch { /* audit failure must not break the app */ }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ allowed: false, reason: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { capability, property_id } = body;

    if (!capability) {
      return Response.json({ allowed: false, reason: 'Missing capability' }, { status: 400 });
    }

    // Backward compat: legacy 'admin'/'user' roles map to new roles
    const rawRole = user.role || 'CLIENT_VIEWER';
    const role = rawRole === 'admin' ? 'EPIC_ADMIN' : rawRole === 'user' ? 'CLIENT_EDITOR' : rawRole;
    const roleCaps = ROLE_CAPABILITIES[role] || [];

    // Check role-level capability
    if (!roleCaps.includes(capability)) {
      await writeAuditLog(base44, user, role, 'ACCESS_DENIED', body, false,
        `Role ${role} does not have capability ${capability}`);
      return Response.json({ allowed: false, reason: `Role ${role} does not have capability ${capability}` });
    }

    // AI_USE: hard block + audit
    if (capability === 'AI_USE' && role !== 'EPIC_ADMIN') {
      await writeAuditLog(base44, user, role, 'AI_CALL_BLOCKED', body, false,
        `AI_USE blocked for role ${role}`);
      return Response.json({ allowed: false, reason: 'AI_USE restricted to EPIC_ADMIN' });
    }

    // EPIC roles: no property-level check needed
    if (EPIC_ROLES.includes(role)) {
      return Response.json({ allowed: true });
    }

    // Client roles: need a valid property grant
    if (!property_id) {
      return Response.json({ allowed: false, reason: 'property_id required for client roles' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const grants = await base44.asServiceRole.entities.UserPropertyAccess.filter({
      user_email: user.email,
      property_id,
      is_active: true,
    });

    const validGrant = grants.find((g) => {
      if (!g.is_active) return false;
      if (g.expires_at && g.expires_at < today) return false;
      return true;
    });

    if (!validGrant) {
      await writeAuditLog(base44, user, role, 'ACCESS_DENIED', body, false,
        `No valid grant for property ${property_id}`);
      return Response.json({ allowed: false, reason: `No access to property ${property_id}` });
    }

    const accessLevel = validGrant.access_level;

    if (WRITE_CAPS.includes(capability) && accessLevel === 'VIEW') {
      await writeAuditLog(base44, user, role, 'ACCESS_DENIED', body, false,
        `accessLevel VIEW insufficient for ${capability}`);
      return Response.json({ allowed: false, reason: `VIEW access insufficient for ${capability}` });
    }

    if (MANAGE_CAPS.includes(capability) && accessLevel !== 'MANAGE') {
      await writeAuditLog(base44, user, role, 'ACCESS_DENIED', body, false,
        `accessLevel ${accessLevel} insufficient for ${capability}`);
      return Response.json({ allowed: false, reason: `MANAGE access required for ${capability}` });
    }

    return Response.json({ allowed: true, access_level: accessLevel });

  } catch (error) {
    return Response.json({ allowed: false, reason: error.message }, { status: 500 });
  }
});