import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Shield, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLES = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Epic Admin (Full Access)' },
  { value: 'hotel_manager', label: 'Hotel Manager' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'EPIC_MANAGER', label: 'Epic Manager' },
  { value: 'EPIC_CONTRIBUTOR', label: 'Epic Contributor' },
  { value: 'EPIC_VIEWER', label: 'Epic Viewer' },
];

const getRoleBadgeColor = (role) => {
  if (role === 'admin' || role === 'EPIC_ADMIN') return 'bg-red-500';
  if (role === 'EPIC_MANAGER' || role === 'hotel_manager') return 'bg-purple-500';
  if (role === 'sales_manager') return 'bg-blue-500';
  if (role === 'EPIC_VIEWER') return 'bg-slate-500';
  return 'bg-blue-500';
};

const getRoleLabel = (role) =>
  ROLES.find(r => r.value === role)?.label ||
  (role ? role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'User');

export default function UserManagement() {
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [editingUser, setEditingUser] = useState(null);
  const [editRole, setEditRole] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const inviteMutation = useMutation({
    mutationFn: (data) => base44.users.inviteUser(data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('user');
    },
    onError: (error) => alert(`Error inviting user: ${error.message}`)
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, role }) => base44.entities.User.update(id, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
    },
    onError: (error) => alert(`Error updating role: ${error.message}`)
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const handleEditRole = (e) => {
    e.preventDefault();
    updateRoleMutation.mutate({ id: editingUser.id, role: editRole });
  };

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-slate-400">Only administrators can manage users.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              User Management
            </h1>
            <p className="text-slate-400 mt-1">Manage team members and permissions</p>
          </div>
          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Invite User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={inviteMutation.isPending}>
                  {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Users Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-slate-400">No users yet</p>
            </div>
          ) : (
            users.map((user) => (
              <Card key={user.id} className="bg-slate-800/60 border-slate-700 hover:border-slate-600 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base text-white flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {user.full_name}
                      </CardTitle>
                      <p className="text-sm text-slate-400 mt-1 flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5" />
                        {user.email}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-500" />
                      <Badge className={getRoleBadgeColor(user.role)}>
                        {getRoleLabel(user.role)}
                      </Badge>
                    </div>
                    {user.id !== currentUser?.id && (
                      <button
                        onClick={() => { setEditingUser(user); setEditRole(user.role || 'user'); }}
                        className="text-xs text-slate-400 hover:text-white underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    Joined {new Date(user.created_date).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Edit Role Dialog */}
      {editingUser && (
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Role — {editingUser.full_name}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditRole} className="space-y-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending ? 'Saving...' : 'Save Role'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}