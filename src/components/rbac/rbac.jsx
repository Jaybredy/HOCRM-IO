/**
 * RBAC - Single source of truth for roles and capabilities
 */

export const ROLES = {
  EPIC_ADMIN:     'EPIC_ADMIN',
  HOTEL_MANAGER:  'hotel_manager',
  SALES_MANAGER:  'sales_manager',
  USER:           'user',
  // Legacy keys kept for backward compatibility
  EPIC_MANAGER:     'EPIC_MANAGER',
  EPIC_CONTRIBUTOR: 'EPIC_CONTRIBUTOR',
  EPIC_VIEWER:      'EPIC_VIEWER',
  CLIENT_MANAGER:   'CLIENT_MANAGER',
  CLIENT_EDITOR:    'CLIENT_EDITOR',
  CLIENT_VIEWER:    'CLIENT_VIEWER',
};

export const CAPABILITIES = {
  RECORD_VIEW:            'RECORD_VIEW',
  RECORD_CREATE:          'RECORD_CREATE',
  RECORD_EDIT:            'RECORD_EDIT',
  RECORD_DELETE:          'RECORD_DELETE',
  REPORTS_VIEW:           'REPORTS_VIEW',
  REPORTS_EXPORT:         'REPORTS_EXPORT',
  DATA_EXPORT:            'DATA_EXPORT',
  USER_INVITE_MANAGE:     'USER_INVITE_MANAGE',
  PROPERTY_SETTINGS_EDIT: 'PROPERTY_SETTINGS_EDIT',
  PIPELINE_CONFIG_EDIT:   'PIPELINE_CONFIG_EDIT',
  PLATFORM_ADMIN:         'PLATFORM_ADMIN',
  AI_USE:                 'AI_USE',
};

// Capabilities granted per role
const ROLE_CAPABILITIES = {
  admin: Object.values(CAPABILITIES),
  EPIC_ADMIN: Object.values(CAPABILITIES),

  EPIC_MANAGER: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.RECORD_CREATE,
    CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.RECORD_DELETE,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.DATA_EXPORT,
    CAPABILITIES.PROPERTY_SETTINGS_EDIT,
    // NOTE: AI_USE, USER_INVITE_MANAGE, PIPELINE_CONFIG_EDIT intentionally excluded
  ],

  // Hotel Supervisor — broad property oversight, no AI
  hotel_manager: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.RECORD_CREATE,
    CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.RECORD_DELETE,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.DATA_EXPORT,
    CAPABILITIES.USER_INVITE_MANAGE,
    CAPABILITIES.PROPERTY_SETTINGS_EDIT,
    // NOTE: AI_USE is intentionally excluded
  ],

  // Hotel Sales Manager — create & edit clients/bookings/activities, view colleagues, no AI
  sales_manager: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.RECORD_CREATE,
    CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.DATA_EXPORT,
    // NOTE: AI_USE, RECORD_DELETE, PROPERTY_SETTINGS_EDIT intentionally excluded
  ],

  EPIC_CONTRIBUTOR: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.RECORD_CREATE,
    CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
    // NOTE: RECORD_DELETE, DATA_EXPORT, USER_INVITE_MANAGE, PROPERTY_SETTINGS_EDIT, AI_USE intentionally excluded
  ],

  EPIC_VIEWER: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.REPORTS_VIEW,
  ],

  CLIENT_MANAGER: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.RECORD_CREATE,
    CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.RECORD_DELETE,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.USER_INVITE_MANAGE,
    CAPABILITIES.PROPERTY_SETTINGS_EDIT,
  ],

  CLIENT_EDITOR: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.RECORD_CREATE,
    CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.REPORTS_VIEW,
    CAPABILITIES.REPORTS_EXPORT,
  ],

  CLIENT_VIEWER: [
    CAPABILITIES.RECORD_VIEW,
    CAPABILITIES.REPORTS_VIEW,
  ],

  user: [],
};

/** Whether a role has access to all properties without per-property grants */
export const isEpicRole = (role) =>
  ['admin', 'EPIC_ADMIN', ROLES.EPIC_MANAGER, ROLES.EPIC_VIEWER].includes(role);

/** Check if a role has a capability */
export const roleHasCapability = (role, capability) =>
  (ROLE_CAPABILITIES[role] || []).includes(capability);

/**
 * Compute the set of property IDs a user can access.
 * epicRoles get ALL properties.
 * clientRoles get only what's in their non-expired UserPropertyAccess grants.
 */
export const computeAccess = (user, grants = [], allPropertyIds = []) => {
  if (!user) return { allowedPropertyIds: [], grantMap: {} };

  const role = user.role || ROLES.CLIENT_VIEWER;
  const today = new Date().toISOString().slice(0, 10);

  if (isEpicRole(role)) {
    const grantMap = {};
    allPropertyIds.forEach((id) => { grantMap[id] = 'MANAGE'; });
    return { allowedPropertyIds: allPropertyIds, grantMap };
  }

  const activeGrants = grants.filter((g) => {
    if (!g.is_active) return false;
    if (g.expires_at && g.expires_at < today) return false;
    if (g.user_email !== user.email) return false;
    return true;
  });

  const grantMap = {};
  activeGrants.forEach((g) => { grantMap[g.property_id] = g.access_level; });
  const allowedPropertyIds = Object.keys(grantMap);

  return { allowedPropertyIds, grantMap };
};

/**
 * Check if a user can perform a capability on a specific property.
 */
export const canDo = (user, capability, propertyId, grantMap = {}) => {
  if (!user) return false;
  const role = user.role || ROLES.CLIENT_VIEWER;

  // Epic/admin roles have all capabilities
  if (isEpicRole(role)) return true;

  if (!roleHasCapability(role, capability)) return false;
  if (!propertyId) return false;

  const accessLevel = grantMap[propertyId];
  if (!accessLevel) return false;

  const writeCapabilities = [
    CAPABILITIES.RECORD_CREATE,
    CAPABILITIES.RECORD_EDIT,
    CAPABILITIES.RECORD_DELETE,
    CAPABILITIES.REPORTS_EXPORT,
    CAPABILITIES.PROPERTY_SETTINGS_EDIT,
    CAPABILITIES.USER_INVITE_MANAGE,
  ];
  if (writeCapabilities.includes(capability) && accessLevel === 'VIEW') return false;

  const manageCapabilities = [
    CAPABILITIES.RECORD_DELETE,
    CAPABILITIES.USER_INVITE_MANAGE,
    CAPABILITIES.PROPERTY_SETTINGS_EDIT,
  ];
  if (manageCapabilities.includes(capability) && accessLevel !== 'MANAGE') return false;

  return true;
};

/** Write to AuditLog */
export const writeAuditLog = async (base44, { action, propertyId, entityType, entityId, reportType, details, success = true }) => {
  try {
    const user = await base44.auth.me().catch(() => null);
    await base44.entities.AuditLog.create({
      actor_email: user?.email || 'unknown',
      actor_role: user?.role || 'unknown',
      action,
      property_id: propertyId || null,
      entity_type: entityType || null,
      entity_id: entityId || null,
      report_type: reportType || null,
      details: details || null,
      success,
    });
  } catch {
    // Audit log failure should never break the app
  }
};

export const ROLE_LABELS = {
  admin:          'EPIC Admin',
  hotel_manager:  'Hotel Manager',
  sales_manager:  'Sales Manager',
  user:           'User',
  EPIC_ADMIN:     'Epic Admin',
  EPIC_MANAGER:       'Epic Manager',
  EPIC_CONTRIBUTOR:   'Epic Contributor',
  EPIC_VIEWER:        'Epic Viewer',
  CLIENT_MANAGER: 'Client Manager',
  CLIENT_EDITOR:  'Client Editor',
  CLIENT_VIEWER:  'Client Viewer',
};

export const ROLE_COLORS = {
  admin:          'bg-red-100 text-red-800',
  hotel_manager:  'bg-purple-100 text-purple-800',
  sales_manager:  'bg-blue-100 text-blue-800',
  user:           'bg-gray-100 text-gray-600',
  EPIC_ADMIN:     'bg-red-100 text-red-800',
  EPIC_MANAGER:       'bg-blue-100 text-blue-800',
  EPIC_CONTRIBUTOR:   'bg-teal-100 text-teal-800',
  EPIC_VIEWER:        'bg-slate-100 text-slate-700',
  CLIENT_MANAGER: 'bg-emerald-100 text-emerald-800',
  CLIENT_EDITOR:  'bg-yellow-100 text-yellow-800',
  CLIENT_VIEWER:  'bg-gray-100 text-gray-600',
};