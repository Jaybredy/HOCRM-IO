import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useRBAC } from '@/components/rbac/useRBAC';
import { CAPABILITIES, ROLE_LABELS, ROLE_COLORS, roleHasCapability } from '@/components/rbac/rbac';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Shield, Plus, Trash2, Users, Building2, Clock, AlertTriangle, Pencil } from 'lucide-react';

export default function AccessManagement() {
  const { user, can, role, properties, loading } = useRBAC();
  const qc = useQueryClient();
  const [showGrantDialog, setShowGrantDialog] = useState(false);
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [editingUserRole, setEditingUserRole] = useState(null);
  const [editingDisplayName, setEditingDisplayName] = useState(null);
  const [editingPropertyGrant, setEditingPropertyGrant] = useState(null);
  const [grantForm, setGrantForm] = useState({ user_email: '', property_ids: [], role_at_property: 'sales_manager', expires_at: '' });
  const [propertyForm, setPropertyForm] = useState({ name: '', type: 'HOTEL', status: 'active', location: '', hotel_id: '' });
  const [search, setSearch] = useState('');
  const [selectedUserEmail, setSelectedUserEmail] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [nameOverrides, setNameOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem('access_name_overrides') || '{}'); } catch { return {}; }
  });
  const [editingEmailName, setEditingEmailName] = useState(null); // { email, name }

  const { data: grants = [] } = useQuery({
    queryKey: ['access-grants'],
    queryFn: () => base44.entities.UserPropertyAccess.list('-created_date', 200),
    enabled: !loading,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !loading,
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 50),
    enabled: !loading,
  });

  const { data: hotelsList = [] } = useQuery({
    queryKey: ['hotels-am'],
    queryFn: () => base44.entities.Hotel.filter({ is_active: true }),
    enabled: !loading,
  });

  const createPropertyMutation = useMutation({
    mutationFn: (data) => {
      // properties table column is `address`, not `location` — old form
      // never round-tripped (PGRST204 on insert). Translate at the boundary.
      const { location, ...rest } = data;
      return base44.entities.Property.create({
        ...rest,
        address: location || null,
        hotel_id: data.hotel_id && data.hotel_id !== '__none__' ? data.hotel_id : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['access-grants']);
      qc.invalidateQueries(['properties']);
      setShowPropertyDialog(false);
      setPropertyForm({ name: '', type: 'HOTEL', status: 'active', location: '', hotel_id: '' });
    },
  });

  const updateUserRoleMutation = useMutation({
    // Route through the update-user-role edge function so ROLE_HIERARCHY,
    // self-edit blocking, and audit log entries are enforced. The direct
    // User.update path skipped all three and additionally tripped the
    // protect_role_changes trigger for non-admin callers.
    mutationFn: ({ id, role }) => base44.users.updateUserRole(id, role),
    onSuccess: () => { qc.invalidateQueries(['all-users']); qc.invalidateQueries(['audit-logs']); setEditingUserRole(null); },
    onError: (err) => alert('Error updating role: ' + (err?.message || 'Unknown error')),
  });

  const updateDisplayNameMutation = useMutation({
    mutationFn: ({ id, display_name }) => base44.entities.User.update(id, { display_name }),
    onSuccess: () => { qc.invalidateQueries(['all-users']); setEditingDisplayName(null); },
  });

  const createGrantMutation = useMutation({
    mutationFn: async (data) => {
      const access_level = data.role_at_property === 'hotel_manager' ? 'MANAGE' : 'EDIT';
      await Promise.all(data.property_ids.map(pid => {
        const existing = grants.find(g => g.user_email?.toLowerCase() === data.user_email?.toLowerCase() && g.property_id === pid);
        if (existing) {
          return base44.entities.UserPropertyAccess.update(existing.id, { role_at_property: data.role_at_property, access_level, expires_at: data.expires_at || null, is_active: true });
        }
        return base44.entities.UserPropertyAccess.create({ user_email: data.user_email, property_id: pid, role_at_property: data.role_at_property, access_level, expires_at: data.expires_at || null, granted_by: user?.id, is_active: true });
      }));
    },
    onSuccess: () => { qc.invalidateQueries(['access-grants']); setShowGrantDialog(false); setGrantForm({ user_email: '', property_ids: [], role_at_property: 'sales_manager', expires_at: '' }); setDuplicateWarning([]); },
  });

  const revokeGrantMutation = useMutation({
    mutationFn: (id) => base44.entities.UserPropertyAccess.update(id, { is_active: false }),
    onSuccess: () => qc.invalidateQueries(['access-grants']),
  });

  const updateGrantRoleMutation = useMutation({
    mutationFn: ({ id, role_at_property }) => {
      const access_level = role_at_property === 'hotel_manager' ? 'MANAGE' : 'EDIT';
      return base44.entities.UserPropertyAccess.update(id, { role_at_property, access_level });
    },
    onSuccess: () => { qc.invalidateQueries(['access-grants']); setEditingPropertyGrant(null); },
  });

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 text-slate-400">Loading...</div>;

  // can() requires a propertyId for non-EPIC roles — Settings is page-level
  // not property-specific, so use roleHasCapability (role-only) here. Without
  // this, hotel_manager was being incorrectly denied (B-7.g).
  if (
    !roleHasCapability(user?.role, CAPABILITIES.PLATFORM_ADMIN) &&
    !roleHasCapability(user?.role, CAPABILITIES.USER_INVITE_MANAGE)
  ) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-8 flex items-center gap-3 text-red-400">
        <AlertTriangle className="w-5 h-5" />
        <span>You don't have permission to access this page.</span>
      </div>
    );
  }

  const isPlatformAdmin = can(CAPABILITIES.PLATFORM_ADMIN);
  const today = new Date().toISOString().slice(0, 10);
  const activeGrants = grants.filter(g => g.is_active && (!g.expires_at || g.expires_at >= today));
  const filteredGrants = activeGrants.filter(g =>
    !search || g.user_email?.toLowerCase().includes(search.toLowerCase())
  );

  const safeUsers = users.filter(u => u && u.id);
  const propMap = Object.fromEntries(properties.map(p => [p.id, p]));
  const userMap = Object.fromEntries(safeUsers.map(u => [u.email?.toLowerCase(), u]));
  const saveNameOverride = (email, name) => {
    const updated = { ...nameOverrides, [email.toLowerCase()]: name };
    setNameOverrides(updated);
    localStorage.setItem('access_name_overrides', JSON.stringify(updated));
    setEditingEmailName(null);
  };

  const getDisplayName = (u, email) => {
    const override = email && nameOverrides[email.toLowerCase()];
    if (override) return override;
    if (!u) return email || null;
    return u.display_name || u.full_name || u.email?.split('@')[0]?.replace(/[._]/g, ' ')?.replace(/\b\w/g, c => c.toUpperCase()) || u.email;
  };

  const accessLevelColor = { VIEW: 'bg-slate-700 text-slate-300', EDIT: 'bg-blue-900/50 text-blue-300', MANAGE: 'bg-purple-900/50 text-purple-300' };
  const roleAtPropertyColor = { hotel_manager: 'bg-purple-900/50 text-purple-300', sales_manager: 'bg-blue-900/50 text-blue-300' };
  const roleAtPropertyLabel = { hotel_manager: 'Hotel Manager', sales_manager: 'Sales Manager' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-amber-950/30 to-slate-900 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Access Management</h1>
            <p className="text-slate-400 text-sm">Manage user roles, property access, and audit logs</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isPlatformAdmin && (
            <Button variant="outline" onClick={() => setShowPropertyDialog(true)} className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent">
              <Building2 className="w-4 h-4 mr-1" /> New Property
            </Button>
          )}
          <Button onClick={() => setShowGrantDialog(true)} className="bg-blue-600 hover:bg-blue-500">
            <Plus className="w-4 h-4 mr-1" /> Grant Access
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="bg-slate-800 border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => document.getElementById('section-properties')?.scrollIntoView({ behavior: 'smooth' })}>
          <CardContent className="p-4 flex items-center gap-3">
            <Building2 className="w-8 h-8 text-emerald-400" />
            <div><p className="text-2xl font-bold text-white">{properties.length}</p><p className="text-sm text-slate-300">Properties</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => document.getElementById('section-users')?.scrollIntoView({ behavior: 'smooth' })}>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-400" />
            <div><p className="text-2xl font-bold text-white">{safeUsers.length}</p><p className="text-sm text-slate-300">Users</p></div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-600 cursor-pointer hover:bg-slate-700 transition-colors" onClick={() => document.getElementById('section-grants')?.scrollIntoView({ behavior: 'smooth' })}>
          <CardContent className="p-4 flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-400" />
            <div><p className="text-2xl font-bold text-white">{new Set(activeGrants.map(g => g.user_email)).size}</p><p className="text-sm text-slate-300">Users with Access</p></div>
          </CardContent>
        </Card>
      </div>

      <Card id="section-properties" className="bg-slate-800 border-slate-600">
        <CardHeader><CardTitle className="text-base text-white">Properties</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {(() => {
              const epicRoles = ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'EPIC_VIEWER'];
              const epicUserCount = safeUsers.filter(u => epicRoles.includes(u.role)).length;
              // useRBAC merges hotels + properties into `properties`. Hotels carry
              // `hotel_type`; properties don't. A property linked to a hotel via
              // hotel_id was previously rendered as a duplicate card next to its
              // parent hotel. Collapse: one card per logical hotel + standalone
              // (un-linked) properties separately. Grant count uses the linked
              // property's id since user_property_access.property_id points there.
              const hotelEntries = properties.filter(p => p.hotel_type !== undefined);
              const propertyEntries = properties.filter(p => p.hotel_type === undefined);
              // A hotel may have ≥1 linked properties (e.g. Hotel C + Hotel C
              // Annex). Group all linked properties by hotel_id so the merged
              // card can sum grants across every linked property.
              const propsByHotelId = {};
              for (const p of propertyEntries) {
                if (!p.hotel_id) continue;
                (propsByHotelId[p.hotel_id] ||= []).push(p);
              }
              const standaloneProps = propertyEntries.filter(p => !p.hotel_id);
              const cards = [
                ...hotelEntries.map(h => {
                  const linked = propsByHotelId[h.id] || [];
                  const linkedIds = linked.map(p => p.id);
                  return {
                    key: h.id,
                    name: h.name,
                    type: h.hotel_type || 'HOTEL',
                    location: h.location || 'No location',
                    status: h.is_active === false ? 'inactive' : 'active',
                    linkedIds,
                    linkedCount: linked.length,
                    raw: linked[0] || h,
                  };
                }),
                ...standaloneProps.map(p => ({
                  key: p.id,
                  name: p.name,
                  type: p.type || 'HOTEL',
                  location: p.address || p.location || 'No location',
                  status: p.status || 'active',
                  linkedIds: [p.id],
                  linkedCount: 0,
                  raw: p,
                })),
              ];
              return cards.map(c => {
                const grantCount = c.linkedIds.length
                  ? activeGrants.filter(g => c.linkedIds.includes(g.property_id)).length + epicUserCount
                  : epicUserCount;
                return (
                  <div
                    key={c.key}
                    className="border border-slate-500 rounded-lg p-3 bg-slate-700/60 flex items-start gap-2 cursor-pointer hover:bg-slate-600/60 hover:border-blue-500 transition-colors"
                    onClick={() => setSelectedProperty(c.raw)}
                  >
                    <Building2 className="w-4 h-4 text-blue-300 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-white">{c.name}</p>
                      <p className="text-xs text-slate-300">{c.type} · {c.location}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={c.status === 'active' ? 'bg-emerald-900/50 text-emerald-300 text-xs' : 'bg-slate-600 text-slate-300 text-xs'}>
                          {c.status}
                        </Badge>
                        <span className="text-xs text-blue-400">{grantCount} user{grantCount !== 1 ? 's' : ''}</span>
                        {c.linkedCount > 1 && (
                          <span className="text-xs text-slate-400">{c.linkedCount} properties</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Access Grants */}
      <Card id="section-grants" className="bg-slate-800 border-slate-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-white">Active Access Grants</CardTitle>
            <Input placeholder="Search by email..." value={search} onChange={e => setSearch(e.target.value)} className="w-56 h-8 text-sm bg-slate-800 border-slate-600 text-white placeholder:text-slate-400" />
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            // Group grants by user email
            const grouped = {};
            filteredGrants.forEach(g => {
              if (!grouped[g.user_email]) grouped[g.user_email] = [];
              grouped[g.user_email].push(g);
            });
            const entries = Object.entries(grouped);
            if (entries.length === 0) return <p className="py-6 text-center text-slate-400">No active grants</p>;
            return (
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-700 text-slate-300 text-xs">
                  <th className="text-left pb-2">Name</th>
                  <th className="text-left pb-2">Email</th>
                  <th className="text-left pb-2">Properties</th>
                  <th className="text-left pb-2">Roles</th>
                  <th className="pb-2"></th>
                </tr></thead>
                <tbody>
                  {entries.map(([email, userGrants]) => {
                    const roles = [...new Set(userGrants.map(g => roleAtPropertyLabel[g.role_at_property] || g.role_at_property))];
                    return (
                      <tr key={email} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                        <td className="py-2 text-blue-300">
                          {editingDisplayName?.id && editingDisplayName?.id === userMap[email?.toLowerCase()]?.id ? (
                            <div className="flex items-center gap-1">
                              <Input autoFocus value={editingDisplayName.display_name} onChange={e => setEditingDisplayName(d => ({ ...d, display_name: e.target.value }))} className="h-7 w-36 text-xs bg-white border-slate-300 text-slate-900" />
                              <Button size="sm" className="h-7 px-2 bg-blue-600 hover:bg-blue-500 text-xs" onClick={() => updateDisplayNameMutation.mutate({ id: editingDisplayName.id, display_name: editingDisplayName.display_name })}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-1 text-slate-400 hover:text-white" onClick={() => setEditingDisplayName(null)}>✕</Button>
                            </div>
                          ) : (
                            <span className="group flex items-center gap-1 cursor-pointer hover:text-blue-100 underline underline-offset-2" onClick={() => setSelectedUserEmail(email)}>
                              {getDisplayName(userMap[email?.toLowerCase()], email)}
                              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 cursor-pointer" onClick={e => { e.stopPropagation(); const u = userMap[email?.toLowerCase()]; if (u) { setEditingDisplayName({ id: u.id, display_name: u.display_name || u.full_name || '' }); } else { setEditingEmailName({ email, name: nameOverrides[email.toLowerCase()] || '' }); } }} />
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-slate-300">{email}</td>
                        <td className="py-2 text-slate-200">{userGrants.length} {userGrants.length === 1 ? 'property' : 'properties'}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            {roles.map(r => <Badge key={r} className="text-xs bg-blue-900/50 text-blue-300">{r}</Badge>)}
                          </div>
                        </td>
                        <td className="py-2">
                          <Button size="sm" variant="ghost" className="text-slate-400 hover:text-white h-7 px-2 text-xs" onClick={() => setSelectedUserEmail(email)}>
                            <Pencil className="w-3 h-3 mr-1" /> Manage
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </CardContent>
      </Card>

      {/* Users & Roles */}
      <Card id="section-users" className="bg-slate-800 border-slate-600">
        <CardHeader><CardTitle className="text-base text-white">Users & Platform Roles</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-700 text-slate-300 text-xs">
              <th className="text-left pb-2">Name</th>
              <th className="text-left pb-2">Email</th>
              <th className="text-left pb-2">Role</th>
              <th className="text-left pb-2">Status</th>
              <th className="pb-2"></th>
            </tr></thead>
            <tbody>
              {safeUsers.map(u => (
                <tr key={u.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                  <td className="py-2 text-blue-300 hover:text-blue-100 cursor-pointer underline underline-offset-2" onClick={() => setSelectedUserEmail(u.email)}>
                    {editingDisplayName?.id && editingDisplayName?.id === u.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Input autoFocus value={editingDisplayName.display_name} onChange={e => setEditingDisplayName(d => ({ ...d, display_name: e.target.value }))} className="h-7 w-36 text-xs bg-white border-slate-300 text-slate-900" />
                        <Button size="sm" className="h-7 px-2 bg-blue-600 hover:bg-blue-500 text-xs" onClick={() => updateDisplayNameMutation.mutate({ id: u.id, display_name: editingDisplayName.display_name })}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-1 text-slate-400 hover:text-white" onClick={() => setEditingDisplayName(null)}>✕</Button>
                      </div>
                    ) : (
                      <span className="group flex items-center gap-1">
                        {getDisplayName(u)}
                        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 cursor-pointer" onClick={e => { e.stopPropagation(); setEditingDisplayName({ id: u.id, display_name: u?.display_name || u?.full_name || '' }); }} />
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-slate-200">{u.email}</td>
                  <td className="py-2"><Badge className={`${ROLE_COLORS[u.role] || 'bg-slate-700 text-slate-300'} text-xs`}>{ROLE_LABELS[u.role] || u.role || 'No role'}</Badge></td>
                  <td className="py-2"><Badge className={u.is_active !== false ? 'bg-emerald-900/50 text-emerald-400 text-xs' : 'bg-red-900/50 text-red-400 text-xs'}>{u.is_active !== false ? 'Active' : 'Inactive'}</Badge></td>
                  <td className="py-2">
                    {editingUserRole?.id === u.id ? (
                      <div className="flex items-center gap-1">
                        <Select value={editingUserRole.role} onValueChange={v => setEditingUserRole(r => ({ ...r, role: v }))}>
                          <SelectTrigger className="h-7 w-52 text-xs bg-white border-slate-300 text-slate-900"><SelectValue /></SelectTrigger>
                          <SelectContent className="bg-white border-slate-200">
                            <SelectItem value="admin" className="text-slate-900 focus:bg-slate-100">Epic Admin – Full access including AI</SelectItem>
                            <SelectItem value="EPIC_MANAGER" className="text-slate-900 focus:bg-slate-100">Epic Manager – Full access, no AI</SelectItem>
                            <SelectItem value="hotel_manager" className="text-slate-900 focus:bg-slate-100">Hotel Manager</SelectItem>
                            <SelectItem value="sales_manager" className="text-slate-900 focus:bg-slate-100">Sales Manager</SelectItem>
                            <SelectItem value="EPIC_CONTRIBUTOR" className="text-slate-900 focus:bg-slate-100">Epic Contributor – Create & edit, no delete</SelectItem>
                            <SelectItem value="EPIC_VIEWER" className="text-slate-900 focus:bg-slate-100">Epic Viewer – View only</SelectItem>
                            <SelectItem value="user" className="text-slate-900 focus:bg-slate-100">User</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" className="h-7 px-2 bg-blue-600 hover:bg-blue-500 text-xs" onClick={() => updateUserRoleMutation.mutate({ id: u.id, role: editingUserRole.role })}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-400 hover:text-white" onClick={() => setEditingUserRole(null)}>✕</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-500 hover:text-slate-200" onClick={() => setEditingUserRole({ id: u.id, role: u.role || 'user' })}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Audit Log */}
      {isPlatformAdmin && (
        <Card className="bg-slate-800 border-slate-600">
          <CardHeader><CardTitle className="text-base text-white">Recent Audit Log</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-slate-700 text-slate-300">
                <th className="text-left pb-2">Actor</th>
                <th className="text-left pb-2">Action</th>
                <th className="text-left pb-2">Property</th>
                <th className="text-left pb-2">Details</th>
                <th className="text-left pb-2">Time</th>
              </tr></thead>
              <tbody>
                {auditLogs.map(l => {
                  // details is a jsonb object (e.g. role_change writes
                  // {new_role, old_role, actor_role, target_email}). React
                  // can't render an object as a child — format common shapes
                  // and JSON.stringify the rest.
                  let detailsText = '—';
                  if (l.details) {
                    if (typeof l.details === 'string') {
                      detailsText = l.details;
                    } else if (l.details.old_role && l.details.new_role) {
                      const target = l.details.target_email ? ` (${l.details.target_email})` : '';
                      detailsText = `${l.details.old_role} → ${l.details.new_role}${target}`;
                    } else {
                      try { detailsText = JSON.stringify(l.details); } catch { detailsText = '[object]'; }
                    }
                  }
                  return (
                    <tr key={l.id} className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50">
                      <td className="py-1.5 text-slate-200">{l.actor_email}</td>
                      <td className="py-1.5"><Badge className={`text-xs ${l.success ? 'bg-slate-700 text-slate-200' : 'bg-red-900/50 text-red-400'}`}>{l.action}</Badge></td>
                      <td className="py-1.5 text-slate-200">{l.property_id ? (propMap[l.property_id]?.name || l.property_id) : '—'}</td>
                      <td className="py-1.5 text-slate-400 max-w-xs truncate">{detailsText}</td>
                      <td className="py-1.5 text-slate-400">{new Date(l.created_date).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {auditLogs.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-slate-400">No audit logs yet</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* User Grants Dialog */}
      <Dialog open={!!selectedUserEmail} onOpenChange={(v) => { if (!v) setSelectedUserEmail(null); }}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" />
              {selectedUserEmail} — Access Grants
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-4">
            {/* Platform role */}
            {(() => {
              const u = safeUsers.find(u => u.email === selectedUserEmail);
              return u ? (
                <div className="flex items-center justify-between bg-slate-800 rounded-lg px-4 py-2">
                  <span className="text-slate-400 text-sm">Platform Role</span>
                  <Badge className={`${ROLE_COLORS[u.role] || 'bg-slate-700 text-slate-300'} text-xs`}>{ROLE_LABELS[u.role] || u.role || 'No role'}</Badge>
                </div>
              ) : null;
            })()}
            {/* Their grants */}
            <div>
              <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">Property Access</p>
            {(() => {
                const userGrants = activeGrants.filter(g => g.user_email === selectedUserEmail);
                if (userGrants.length === 0) return <p className="text-slate-500 text-sm py-2">No active property grants.</p>;
                return (
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                      <th className="text-left pb-2">Property</th>
                      <th className="text-left pb-2">Role</th>
                      <th className="text-left pb-2">Expires</th>
                      <th className="pb-2"></th>
                    </tr></thead>
                    <tbody>
                      {userGrants.map(g => (
                        <tr key={g.id} className="border-b border-slate-800 last:border-0">
                          <td className="py-2 text-slate-100">{propMap[g.property_id]?.name || g.property_id}</td>
                          <td className="py-2">
                            {isPlatformAdmin && editingPropertyGrant?.id === g.id ? (
                              <div className="flex items-center gap-1">
                                <Select value={editingPropertyGrant.role_at_property} onValueChange={v => setEditingPropertyGrant(r => ({ ...r, role_at_property: v }))}>
                                  <SelectTrigger className="h-7 w-44 text-xs bg-white border-slate-300 text-slate-900"><SelectValue /></SelectTrigger>
                                  <SelectContent className="bg-white border-slate-200">
                                    <SelectItem value="hotel_manager" className="text-slate-900 focus:bg-slate-100">Hotel Manager</SelectItem>
                                    <SelectItem value="sales_manager" className="text-slate-900 focus:bg-slate-100">Sales Manager</SelectItem>
                                    <SelectItem value="EPIC_MANAGER" className="text-slate-900 focus:bg-slate-100">Epic Manager</SelectItem>
                                    <SelectItem value="EPIC_CONTRIBUTOR" className="text-slate-900 focus:bg-slate-100">Epic Contributor</SelectItem>
                                    <SelectItem value="EPIC_VIEWER" className="text-slate-900 focus:bg-slate-100">Epic Viewer</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button size="sm" className="h-7 px-2 bg-blue-600 hover:bg-blue-500 text-xs" onClick={() => updateGrantRoleMutation.mutate({ id: g.id, role_at_property: editingPropertyGrant.role_at_property })}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-400 hover:text-white" onClick={() => setEditingPropertyGrant(null)}>✕</Button>
                              </div>
                            ) : (
                              <Badge
                                className={`${roleAtPropertyColor[g.role_at_property] || 'bg-slate-700 text-slate-300'} text-xs ${isPlatformAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
                                onClick={() => isPlatformAdmin && setEditingPropertyGrant({ id: g.id, role_at_property: g.role_at_property })}
                              >
                                {roleAtPropertyLabel[g.role_at_property] || g.role_at_property}
                                {isPlatformAdmin && <Pencil className="w-2.5 h-2.5 ml-1 inline" />}
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 text-slate-400 text-xs">{g.expires_at || 'Never'}</td>
                          <td className="py-2">
                            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 px-2" onClick={() => revokeGrantMutation.mutate(g.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            <div className="pt-3 border-t border-slate-700 mt-3">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-xs"
                onClick={() => {
                  setSelectedUserEmail(null);
                  setGrantForm(f => ({ ...f, user_email: selectedUserEmail, property_ids: [] }));
                  setShowGrantDialog(true);
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Add / Modify Property Access
              </Button>
            </div>
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Property Users Dialog */}
      <Dialog open={!!selectedProperty} onOpenChange={(v) => { if (!v) setSelectedProperty(null); }}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100 max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              {selectedProperty?.name} — Users with Access
            </DialogTitle>
          </DialogHeader>
          <div className="pt-2">
            {(() => {
              const propGrants = activeGrants.filter(g => g.property_id === selectedProperty?.id);
              const epicRoles = ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'EPIC_VIEWER'];
              const epicUsers = safeUsers.filter(u => epicRoles.includes(u.role));
              const hasAny = propGrants.length > 0 || epicUsers.length > 0;
              if (!hasAny) {
                return <p className="text-slate-400 text-sm py-4 text-center">No active grants for this property.</p>;
              }
              return (
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-slate-700 text-slate-400 text-xs">
                    <th className="text-left pb-2">User</th>
                    <th className="text-left pb-2">Role</th>
                    <th className="text-left pb-2">Expires</th>
                    <th className="pb-2"></th>
                  </tr></thead>
                  <tbody>
                    {epicUsers.map(u => (
                      <tr key={u.id} className="border-b border-slate-800">
                        <td className="py-2 text-slate-100">{u.email}</td>
                        <td className="py-2"><Badge className={`${ROLE_COLORS[u.role] || 'bg-slate-700 text-slate-300'} text-xs`}>{ROLE_LABELS[u.role] || u.role}</Badge></td>
                        <td className="py-2 text-xs text-purple-400 italic">Platform-wide</td>
                        <td className="py-2"></td>
                      </tr>
                    ))}
                    {propGrants.map(g => (
                      <tr key={g.id} className="border-b border-slate-800 last:border-0">
                        <td className="py-2 text-slate-100">{g.user_email}</td>
                        <td className="py-2">
                          {isPlatformAdmin && editingPropertyGrant?.id === g.id ? (
                            <div className="flex items-center gap-1">
                              <Select value={editingPropertyGrant.role_at_property} onValueChange={v => setEditingPropertyGrant(r => ({ ...r, role_at_property: v }))}>
                                <SelectTrigger className="h-7 w-44 text-xs bg-white border-slate-300 text-slate-900"><SelectValue /></SelectTrigger>
                                <SelectContent className="bg-white border-slate-200">
                                  <SelectItem value="hotel_manager" className="text-slate-900 focus:bg-slate-100">Hotel Manager</SelectItem>
                                  <SelectItem value="sales_manager" className="text-slate-900 focus:bg-slate-100">Sales Manager</SelectItem>
                                  <SelectItem value="EPIC_MANAGER" className="text-slate-900 focus:bg-slate-100">Epic Manager</SelectItem>
                                  <SelectItem value="EPIC_CONTRIBUTOR" className="text-slate-900 focus:bg-slate-100">Epic Contributor</SelectItem>
                                  <SelectItem value="EPIC_VIEWER" className="text-slate-900 focus:bg-slate-100">Epic Viewer</SelectItem>
                                </SelectContent>
                              </Select>
                              <Button size="sm" className="h-7 px-2 bg-blue-600 hover:bg-blue-500 text-xs" onClick={() => updateGrantRoleMutation.mutate({ id: g.id, role_at_property: editingPropertyGrant.role_at_property })}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-slate-400 hover:text-white" onClick={() => setEditingPropertyGrant(null)}>✕</Button>
                            </div>
                          ) : (
                            <Badge
                              className={`${roleAtPropertyColor[g.role_at_property] || accessLevelColor[g.access_level]} text-xs ${isPlatformAdmin ? 'cursor-pointer hover:opacity-80' : ''}`}
                              onClick={() => isPlatformAdmin && setEditingPropertyGrant({ id: g.id, role_at_property: g.role_at_property })}
                            >
                              {roleAtPropertyLabel[g.role_at_property] || g.access_level}
                              {isPlatformAdmin && <Pencil className="w-2.5 h-2.5 ml-1 inline" />}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 text-slate-400 text-xs">{g.expires_at ? g.expires_at : 'Never'}</td>
                        <td className="py-2">
                          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 px-2" onClick={() => revokeGrantMutation.mutate(g.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Grant Access Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={(v) => { setShowGrantDialog(v); if (!v) setDuplicateWarning([]); }}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100">
        <DialogHeader><DialogTitle className="text-white">Grant Property Access</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-slate-300">User Email</Label>
              <Input
                value={grantForm.user_email}
                onChange={e => {
                  const email = e.target.value;
                  setGrantForm(f => ({ ...f, user_email: email }));
                  setDuplicateWarning([]);
                }}
                placeholder="user@example.com"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
              />
              {/* Show existing grants for this email */}
              {(() => {
                const emailGrants = activeGrants.filter(g => g.user_email?.toLowerCase() === grantForm.user_email?.toLowerCase());
                if (!grantForm.user_email || emailGrants.length === 0) return null;
                return (
                  <div className="mt-2 rounded-md border border-slate-600 bg-slate-800/60 p-2">
                    <p className="text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wide">Existing active grants</p>
                    {emailGrants.map(g => (
                      <div key={g.id} className="flex items-center justify-between text-xs py-0.5">
                        <span className="text-slate-300">{propMap[g.property_id]?.name || g.property_id}</span>
                        <span className="text-slate-400">{g.role_at_property}</span>
                        {g.expires_at && <span className="text-slate-500">expires {g.expires_at}</span>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div>
              <Label className="text-slate-300">Properties <span className="text-slate-400 font-normal">(select one or more)</span></Label>
              <div className="mt-1 rounded-md border border-slate-600 bg-slate-800 p-2 space-y-1">
                <label className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-slate-700 border-b border-slate-700 mb-1">
                  <input
                    type="checkbox"
                    checked={grantForm.property_ids.length === properties.length && properties.length > 0}
                    onChange={e => setGrantForm(f => ({ ...f, property_ids: e.target.checked ? properties.map(p => p.id) : [] }))}
                    className="accent-blue-500 w-4 h-4"
                  />
                  <span className="text-sm text-slate-300 font-semibold">Select All</span>
                </label>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {properties.map(p => (
                    <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-slate-700">
                      <input
                        type="checkbox"
                        checked={grantForm.property_ids.includes(p.id)}
                        onChange={e => setGrantForm(f => ({ ...f, property_ids: e.target.checked ? [...f.property_ids, p.id] : f.property_ids.filter(id => id !== p.id) }))}
                        className="accent-blue-500 w-4 h-4"
                      />
                      <span className="text-sm text-slate-200">{p.name}</span>
                      <span className="text-xs text-slate-400 ml-auto">{p.type}</span>
                    </label>
                  ))}
                </div>
              </div>
              {grantForm.property_ids.length > 0 && <p className="text-xs text-blue-400 mt-1">{grantForm.property_ids.length} selected</p>}
            </div>
            <div>
              <Label className="text-slate-300">Role at Property</Label>
              <Select value={grantForm.role_at_property} onValueChange={v => setGrantForm(f => ({ ...f, role_at_property: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="hotel_manager" className="text-slate-900 focus:bg-slate-100">Hotel Manager – Full control (delete, settings)</SelectItem>
                  <SelectItem value="sales_manager" className="text-slate-900 focus:bg-slate-100">Sales Manager – Create & edit clients/bookings</SelectItem>
                  <SelectItem value="EPIC_MANAGER" className="text-slate-900 focus:bg-slate-100">Epic Manager – Full access, no AI</SelectItem>
                  <SelectItem value="EPIC_CONTRIBUTOR" className="text-slate-900 focus:bg-slate-100">Epic Contributor – Create & edit, no delete</SelectItem>
                  <SelectItem value="EPIC_VIEWER" className="text-slate-900 focus:bg-slate-100">Epic Viewer – View only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Expires At (optional)</Label>
              <Input type="date" value={grantForm.expires_at} onChange={e => setGrantForm(f => ({ ...f, expires_at: e.target.value }))} className="bg-slate-800 border-slate-600 text-white [&::-webkit-calendar-picker-indicator]:invert" />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowGrantDialog(false); setDuplicateWarning([]); }} className="border-slate-400 text-slate-800 bg-white hover:bg-slate-100">Cancel</Button>
              <Button
                onClick={() => createGrantMutation.mutate(grantForm)}
                disabled={!grantForm.user_email || grantForm.property_ids.length === 0 || !grantForm.role_at_property}
                className="bg-blue-600 hover:bg-blue-500"
              >
                Save Access
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Property Dialog */}
      <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
        <DialogContent className="bg-slate-900 border border-slate-700 text-slate-100">
          <DialogHeader><DialogTitle className="text-white">New Property</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-slate-300">Name</Label>
              <Input value={propertyForm.name} onChange={e => setPropertyForm(f => ({ ...f, name: e.target.value }))} placeholder="Property name" className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" />
            </div>
            <div>
              <Label className="text-slate-300">Type</Label>
              <Select value={propertyForm.type} onValueChange={v => setPropertyForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="HOTEL" className="text-slate-900 focus:bg-slate-100">Hotel</SelectItem>
                  <SelectItem value="RENTAL" className="text-slate-900 focus:bg-slate-100">Rental</SelectItem>
                  <SelectItem value="PORTFOLIO" className="text-slate-900 focus:bg-slate-100">Portfolio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300">Location</Label>
              <Input value={propertyForm.location} onChange={e => setPropertyForm(f => ({ ...f, location: e.target.value }))} placeholder="City or address" className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500" />
            </div>
            <div>
              <Label className="text-slate-300">Linked Hotel</Label>
              <Select value={propertyForm.hotel_id || '__none__'} onValueChange={v => setPropertyForm(f => ({ ...f, hotel_id: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Pick parent hotel (recommended)" /></SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="__none__" className="text-slate-900 focus:bg-slate-100">No hotel</SelectItem>
                  {(hotelsList || []).map(h => (
                    <SelectItem key={h.id} value={h.id} className="text-slate-900 focus:bg-slate-100">{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400 mt-1">Required for the property to inherit hotel-scoped data isolation.</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowPropertyDialog(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">Cancel</Button>
              <Button onClick={() => createPropertyMutation.mutate(propertyForm)} disabled={!propertyForm.name} className="bg-blue-600 hover:bg-blue-500">Create Property</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}