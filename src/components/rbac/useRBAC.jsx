/**
 * useRBAC - React hook to load user + access context
 * Use this in any page that needs to enforce access control.
 *
 * Returns:
 *   user, role, allowedPropertyIds, grantMap, properties (all), loading
 *   can(capability, propertyId?) => boolean
 */

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { computeAccess, canDo, isEpicRole, ROLES } from './rbac';

export function useRBAC() {
  const [user, setUser]               = useState(null);
  const [properties, setProperties]   = useState([]);
  const [grants, setGrants]           = useState([]);
  const [access, setAccess]           = useState({ allowedPropertyIds: [], grantMap: {} });
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, allProps, allHotels] = await Promise.all([
          base44.auth.me(),
          base44.entities.Property.filter({ status: 'active' }),
          base44.entities.Hotel.filter({ is_active: true }),
        ]);

        if (cancelled) return;

        // Combine hotels and properties into one list for dropdowns
        const hotelsMapped = (allHotels || []).map(h => ({ ...h, type: h.hotel_type || 'HOTEL', location: h.location || '' }));
        const combinedProps = [...hotelsMapped, ...(allProps || [])];
        const allPropertyIds = combinedProps.map((p) => p.id);

        let userGrants = [];
        if (!isEpicRole(me?.role)) {
          userGrants = await base44.entities.UserPropertyAccess.filter({
            user_email: me.email,
            is_active: true,
          });
        }

        if (cancelled) return;

        const computed = computeAccess(me, userGrants, allPropertyIds);
        setUser(me);
        setProperties(combinedProps);
        setGrants(userGrants);
        setAccess(computed);
      } catch (e) {
        console.error('useRBAC error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const can = (capability, propertyId) =>
    canDo(user, capability, propertyId, access.grantMap);

  return {
    user,
    role: user?.role || ROLES.CLIENT_VIEWER,
    properties,
    allowedPropertyIds: access.allowedPropertyIds,
    grantMap: access.grantMap,
    can,
    isEpic: isEpicRole(user?.role),
    loading,
  };
}