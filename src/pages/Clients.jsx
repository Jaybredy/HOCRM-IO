import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Search, Edit, Trash2, Phone, Mail, ExternalLink,
  UserPlus, Activity, Building2, Upload, Download, Users, Star, TrendingUp, CalendarDays
} from "lucide-react";
import moment from 'moment';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ImportContactsModal from "@/components/clients/ImportContactsModal";

const STATUS_COLORS = {
  new_lead: 'bg-blue-100 text-blue-800',
  reached_out: 'bg-blue-100 text-blue-800',
  solicitation_call: 'bg-slate-100 text-slate-800',
  sent_proposal: 'bg-purple-100 text-purple-800',
  follow_up: 'bg-yellow-100 text-yellow-800',
  prospect: 'bg-orange-100 text-orange-800',
  tentative: 'bg-amber-100 text-amber-800',
  definite: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-slate-100 text-slate-800',
  vip: 'bg-pink-100 text-pink-800',
  lost: 'bg-red-100 text-red-800'
};

const BLANK_FORM = {
  company_name: '', contact_person: '', email: '', phone: '',
  industry: '', address: '', notes: '', status: 'new_lead',
  activity_type: 'sales', property_type: 'hotel', property_id: ''
};

export default function Clients() {
  const queryClient = useQueryClient();

  const [user, setUser] = useState(null);
  const [filterProperty, setFilterProperty] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = React.useRef(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortOption, setSortOption] = useState('recent_activity');
  const [showDialog, setShowDialog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [formData, setFormData] = useState(BLANK_FORM);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    const urlParams = new URLSearchParams(window.location.search);
    const newClientName = urlParams.get('newClientName');
    if (newClientName) {
      setFormData({ ...BLANK_FORM, company_name: decodeURIComponent(newClientName) });
      setShowDialog(true);
    }
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: rentalProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list()
  });

  const isAdmin = ['admin', 'EPIC_ADMIN', 'EPIC_MANAGER', 'EPIC_VIEWER'].includes(user?.role);

  const { data: userGrants = [] } = useQuery({
    queryKey: ['user-grants', user?.email],
    queryFn: () => base44.entities.UserPropertyAccess.filter({ user_email: user.email, is_active: true }),
    enabled: !!user && !isAdmin,
  });

  const today = new Date().toISOString().slice(0, 10);
  const accessibleIds = isAdmin
    ? null // null means all
    : userGrants.filter(g => !g.expires_at || g.expires_at >= today).map(g => g.property_id);

  const accessibleHotels = isAdmin ? hotels : hotels.filter(h => accessibleIds?.includes(h.id));
  const accessibleRentals = isAdmin ? rentalProperties : rentalProperties.filter(p => accessibleIds?.includes(p.id));

  const { data: productionItems = [] } = useQuery({
    queryKey: ['production-items-leads'],
    queryFn: () => base44.entities.ProductionItem.filter({ is_deleted: false })
  });

  const { data: rfps = [] } = useQuery({
    queryKey: ['rfps-leads'],
    queryFn: () => base44.entities.RFP.list()
  });

  const { data: activities = [] } = useQuery({
    queryKey: ['recent-activities'],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date', 30)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); setShowDialog(false); setFormData(BLANK_FORM); },
    onError: (err) => alert('Failed to create client: ' + (err?.message || 'Unknown error'))
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Client.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['clients'] }); setShowDialog(false); setFormData(BLANK_FORM); setEditClient(null); },
    onError: (err) => alert('Failed to update client: ' + (err?.message || 'Unknown error'))
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Client.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] })
  });

  const [bulkAssigning, setBulkAssigning] = useState(false);
  const handleBulkAssign = async () => {
    if (!filterProperty || filterProperty === 'all') return;
    const unlinked = clients.filter(c => !c.property_id);
    if (unlinked.length === 0) { alert('No unlinked clients to assign.'); return; }
    if (!confirm(`Assign ${unlinked.length} unlinked client(s) to this property?`)) return;
    setBulkAssigning(true);
    const propertyType = hotels.find(h => h.id === filterProperty) ? 'hotel' : 'rental';
    for (const c of unlinked) {
      await base44.entities.Client.update(c.id, { property_id: filterProperty, property_type: propertyType });
    }
    setBulkAssigning(false);
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  };

  const handleEdit = (client) => { setEditClient(client); setFormData(client); setShowDialog(true); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.property_id) {
      alert('Please select a property before saving.');
      return;
    }
    if (!formData.company_name?.trim()) {
      alert('Company name is required.');
      return;
    }
    editClient ? updateMutation.mutate({ id: editClient.id, data: formData }) : createMutation.mutate(formData);
  };

  const myActivities = activities.filter(a =>
    !user?.full_name || a.seller_name === user?.full_name || a.created_by === user?.email
  );

  const allProperties = [
    ...hotels.map(h => ({ id: h.id, name: h.name, type: 'hotel' })),
    ...rentalProperties.map(p => ({ id: p.id, name: p.name, type: 'rental' }))
  ];

  const getPropertyName = (client) => {
    const prop = allProperties.find(p => p.id === client.property_id);
    return prop?.name || '—';
  };

  const sortedAndFilteredClients = React.useMemo(() => {
    const clientActivityMap = new Map();
    const clientNameToIdMap = new Map(clients.map(c => [c.company_name, c.id]));

    myActivities.forEach(activity => {
      const clientId = clientNameToIdMap.get(activity.client_name);
      if (clientId) {
        const currentActivityDate = new Date(activity.activity_date);
        const existingRecentDate = clientActivityMap.get(clientId);
        if (!existingRecentDate || currentActivityDate > existingRecentDate) {
          clientActivityMap.set(clientId, currentActivityDate);
        }
      }
    });

    const filtered = clients.filter(c => {
      const q = searchText.toLowerCase();
      const matchesSearch = !q || c.company_name?.toLowerCase().includes(q) ||
        c.contact_person?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q);
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchesProperty = filterProperty === 'all' || c.property_id === filterProperty;
      return matchesSearch && matchesStatus && matchesProperty;
    });

    return filtered.sort((a, b) => {
      if (sortOption === 'recent_activity') {
        const dateA = clientActivityMap.get(a.id);
        const dateB = clientActivityMap.get(b.id);
        if (dateA && dateB) return dateB.getTime() - dateA.getTime();
        else if (dateA) return -1;
        else if (dateB) return 1;
      }
      return new Date(b.created_date).getTime() - new Date(a.created_date).getTime();
    });
  }, [clients, myActivities, searchText, filterStatus, sortOption, filterProperty]);

  const filteredClients = sortedAndFilteredClients;

  const handleExport = () => {
    const rows = [
      ['Company', 'Property', 'Contact', 'Email', 'Phone', 'Industry', 'Status', 'Address'],
      ...filteredClients.map(c => [
        c.company_name, getPropertyName(c), c.contact_person, c.email, c.phone, c.industry, c.status, c.address
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'clients.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleSeedExamples = async () => {
    try {
      await base44.entities.Client.bulkCreate([]);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (err) {
      alert('Unable to load example clients. Please create a client manually instead.');
    }
  };

  const firstName = (user?.display_name) || user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const sevenDaysAgo = moment().subtract(7, 'days').startOf('day');
  const filteredProduction = filterProperty === 'all' ? productionItems : productionItems.filter(p => p.hotel_id === filterProperty || p.property_id === filterProperty);
  const filteredRfps = filterProperty === 'all' ? rfps : rfps.filter(r => r.hotel_id === filterProperty);
  const newLeadsCount = filteredProduction.filter(p => ['prospect', 'tentative'].includes(p.status) && moment(p.created_date).isAfter(sevenDaysAgo)).length +
    filteredRfps.filter(r => !['approved', 'declined'].includes(r.status) && moment(r.created_date).isAfter(sevenDaysAgo)).length;
  const newBookingsLast7 = filteredProduction.filter(p => p.status === 'definite' && moment(p.created_date).isAfter(sevenDaysAgo)).length +
    filteredRfps.filter(r => r.status === 'approved' && moment(r.created_date).isAfter(sevenDaysAgo)).length;

  const stats = [
    { label: filterProperty === 'all' ? 'Total Clients' : 'Clients (filtered)', value: filteredClients.length, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-400/10', link: null },
    { label: 'Active', value: filteredClients.filter(c => c.status === 'active' || c.status === 'definite').length, icon: Users, color: 'text-green-400', bg: 'bg-green-400/10', link: null },
    { label: 'New Leads', value: newLeadsCount, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-400/10', link: createPageUrl('Bookings'), linkLabel: 'View Bookings & RFPs' },
    { label: 'New Bookings (Last 7 Days)', value: newBookingsLast7, icon: CalendarDays, color: 'text-purple-400', bg: 'bg-purple-400/10', link: createPageUrl('Bookings'), linkLabel: 'View Bookings' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{greeting}, {firstName}</h1>
              {sortOption === 'recent_activity' && (
                <Badge className="bg-blue-600/30 text-blue-300 border border-blue-500/50">recent</Badge>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-0.5">Client Management</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => { setFormData(BLANK_FORM); setEditClient(null); setShowDialog(true); }} className="bg-blue-600 hover:bg-blue-500 text-white">
              <UserPlus className="w-4 h-4 mr-1.5" /> New Client
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="text-white border-slate-500 bg-slate-700 hover:bg-slate-600">
              <Upload className="w-4 h-4 mr-1.5" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="text-white border-slate-500 bg-slate-700 hover:bg-slate-600">
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map(s => (
            <Card key={s.label} className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center shrink-0`}>
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                </div>
                <div>
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-slate-400">{s.label}</p>
                  {s.link && (
                    <Link to={s.link} className="text-xs text-slate-500 hover:text-slate-300 underline underline-offset-2 transition-colors">{s.linkLabel}</Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-0">
            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-3 p-4 border-b border-slate-700">
              {/* Property Filter */}
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-full md:w-56 bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {hotels.length > 0 && <SelectItem value="__hotels__" disabled className="text-slate-400 text-xs font-semibold">— Hotels —</SelectItem>}
                  {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  {rentalProperties.length > 0 && <SelectItem value="__rentals__" disabled className="text-slate-400 text-xs font-semibold">— Rentals —</SelectItem>}
                  {rentalProperties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="flex items-center gap-2 flex-1">
                <button
                  onClick={() => { setSearchOpen(v => !v); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-700/60 border border-slate-600 hover:bg-slate-600 transition-colors shrink-0"
                >
                  <Search className="w-4 h-4 text-slate-300" />
                </button>
                {searchOpen && (
                  <div className="relative flex-1">
                    <Input
                      ref={searchInputRef}
                      placeholder="Search by company, contact, industry..."
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                      autoFocus
                    />
                    {searchText && (
                      <button onClick={() => setSearchText('')} className="absolute right-2 top-2.5 text-slate-400 hover:text-white text-xs">✕</button>
                    )}
                  </div>
                )}
              </div>

              {/* Sort */}
              <Select value={sortOption} onValueChange={setSortOption}>
                <SelectTrigger className="w-full md:w-56 bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent_activity">Most Recent Activity</SelectItem>
                  <SelectItem value="newest_first">Creation Date (Newest)</SelectItem>
                  {['all','new_lead','reached_out','solicitation_call','sent_proposal','follow_up','prospect','tentative','definite','active','inactive','vip','lost'].map(s => (
                    <SelectItem key={s} value={s}>{s === 'all' ? 'All Status' : s.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Table Header */}
            {filteredClients.length > 0 && (
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <div className="col-span-3">Company</div>
                <div className="col-span-2">Property</div>
                <div className="col-span-2">Contact</div>
                <div className="col-span-1">Industry</div>
                <div className="col-span-1"></div>
              </div>
            )}

            {/* Rows */}
            {filteredClients.length === 0 ? (
              <div className="py-16 text-center">
                <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                {filterProperty !== 'all' ? (
                  <>
                    <p className="text-slate-400 mb-1">No clients linked to this property</p>
                    {isAdmin && (
                      <div className="flex gap-2 justify-center flex-wrap">
                        <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={() => setFilterProperty('all')}>
                          Show All Clients
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 mb-1">No clients yet</p>
                    <p className="text-slate-500 text-sm mb-4">Add your first client or load examples to get started.</p>
                    {clients.length === 0 && (
                      <Button variant="outline" size="sm" className="border-slate-600 text-slate-300" onClick={handleSeedExamples}>
                        <Star className="w-4 h-4 mr-1.5" /> Load Example Clients
                      </Button>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {filteredClients.map(client => (
                  <div key={client.id} className="group grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-700/30 transition-colors">
                    {/* Company */}
                    <div className="col-span-12 md:col-span-3 flex items-center gap-2 min-w-0">
                      <Link to={createPageUrl('ClientProfile') + `?id=${client.id}`} className="text-white font-medium hover:text-blue-400 transition-colors truncate text-sm flex items-center gap-1">
                        {client.company_name}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-60 shrink-0" />
                      </Link>
                    </div>
                    {/* Property */}
                    <div className="hidden md:flex col-span-2 items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-300 truncate">{getPropertyName(client)}</span>
                      {client.property_type === 'rental' && (
                        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-1 rounded">rental</span>
                      )}
                    </div>
                    {/* Contact */}
                    <div className="hidden md:block col-span-2 text-sm text-slate-300 truncate">
                      {client.contact_person || <span className="text-slate-600">—</span>}
                    </div>
                    {/* Email/Phone */}
                    <div className="hidden md:flex col-span-2 flex-col gap-0.5">
                      {client.email && (
                        <a href={`mailto:${client.email}`} className="text-xs text-slate-300 hover:text-white flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-slate-500 shrink-0" />{client.email}
                        </a>
                      )}
                      {client.phone && (
                        <a href={`tel:${client.phone}`} className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500 shrink-0" />{client.phone}
                        </a>
                      )}
                    </div>
                    {/* Industry */}
                    <div className="hidden md:block col-span-1 text-xs text-slate-400 truncate">
                      {client.industry || <span className="text-slate-600">—</span>}
                    </div>
                    {/* Actions */}
                    <div className="col-span-12 md:col-span-1 flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(client)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteMutation.mutate(client.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredClients.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
                Showing {filteredClients.length} of {clients.length} clients
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Modal */}
      <ImportContactsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
        existingClients={clients}
        hotels={accessibleHotels}
        rentalProperties={accessibleRentals}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setFormData(BLANK_FORM); setEditClient(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editClient ? 'Edit Client' : 'Create New Client Profile'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Property selector */}
              <div className="space-y-2 col-span-2">
                <Label>Property *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={formData.property_type} onValueChange={(val) => setFormData({ ...formData, property_type: val, property_id: '' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={formData.property_id} onValueChange={(val) => setFormData({ ...formData, property_id: val })}>
                    <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>
                      {formData.property_type === 'hotel'
                        ? hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)
                        : rentalProperties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                      }
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Company Name *</Label>
                <Input value={formData.company_name} onChange={(e) => setFormData({ ...formData, company_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Contact Person</Label>
                <Input value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['new_lead','reached_out','solicitation_call','sent_proposal','follow_up','prospect','tentative','definite','active','inactive','vip','lost'].map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Activity Type</Label>
                <Select value={formData.activity_type} onValueChange={(val) => setFormData({ ...formData, activity_type: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="business_development">Business Development</SelectItem>
                    <SelectItem value="customer_service">Customer Service</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
              {editClient ? 'Update Client' : 'Create Profile'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}