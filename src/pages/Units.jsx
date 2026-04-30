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
import { Search, Edit, Trash2, Plus, Building2, User, Calendar, DollarSign, X, Download, Upload } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import ImportTenantsModal from "@/components/rentals/ImportTenantsModal";

const STATUS_COLORS = {
  available: 'bg-green-100 text-green-800',
  rented: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-yellow-100 text-yellow-800'
};

const UNIT_TYPE_COLORS = {
  studio: 'bg-slate-100 text-slate-800',
  '1-bedroom': 'bg-indigo-100 text-indigo-800',
  '2-bedroom': 'bg-purple-100 text-purple-800',
  suite: 'bg-pink-100 text-pink-800',
  penthouse: 'bg-amber-100 text-amber-800',
  other: 'bg-slate-100 text-slate-800'
};

const BLANK_FORM = {
  hotel_id: '',
  unit_number: '',
  unit_type: 'studio',
  status: 'available',
  current_resident_id: '',
  monthly_rent: '',
  lease_start_date: '',
  lease_end_date: '',
  notes: ''
};

export default function Units() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [filterHotel, setFilterHotel] = useState('all');
  const [filterStatus, setFilterStatus] = useState([]);
  const [filterUnitTypes, setFilterUnitTypes] = useState([]);
  const [rentMin, setRentMin] = useState('');
  const [rentMax, setRentMax] = useState('');
  const [leaseStartMin, setLeaseStartMin] = useState('');
  const [leaseStartMax, setLeaseStartMax] = useState('');
  const [leaseEndMin, setLeaseEndMin] = useState('');
  const [leaseEndMax, setLeaseEndMax] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editUnit, setEditUnit] = useState(null);
  const [formData, setFormData] = useState(BLANK_FORM);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: async () => {
      // RLS already scopes the result to hotels the user can see (via
      // has_hotel_access). The previous filter `created_by === user.email`
      // excluded any hotel the caller didn't personally create — which
      // broke the Units feature for invited collaborators (test users had
      // empty dropdowns, the audit-flagged blocker C1). Drop the email
      // filter; trust RLS.
      // The hotel_type filter (apartment-only) is also dropped: hotels
      // created as type='hotel' should still be selectable here for
      // properties that mix group sales + extended-stay units.
      return await base44.entities.Hotel.list();
    },
    enabled: !!user
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units', hotels],
    queryFn: async () => {
      const allUnits = await base44.entities.Unit.list();
      const hotelIds = hotels.map(h => h.id);
      return allUnits.filter(u => hotelIds.includes(u.hotel_id));
    },
    enabled: hotels.length > 0
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const createMutation = useMutation({
    // units.property_id is NOT NULL but the form only collects hotel_id
    // (per the rentals UX). Resolve to a property in the chosen hotel.
    mutationFn: async (data) => {
      let property_id = data.property_id;
      if (!property_id && data.hotel_id) {
        const candidates = await base44.entities.Property.filter({ hotel_id: data.hotel_id });
        property_id = candidates?.[0]?.id;
        if (!property_id) {
          throw new Error('Selected hotel has no property record. Add a property under this hotel first (Access Control → New Property).');
        }
      }
      return base44.entities.Unit.create({ ...data, property_id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setShowDialog(false);
      setFormData(BLANK_FORM);
    },
    onError: (err) => alert('Failed to create unit: ' + (err?.message || 'Unknown error')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Unit.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setShowDialog(false);
      setFormData(BLANK_FORM);
      setEditUnit(null);
    },
    onError: (err) => alert('Failed to update unit: ' + (err?.message || 'Unknown error')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Unit.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['units'] }),
    onError: (err) => alert('Failed to delete unit: ' + (err?.message || 'Unknown error')),
  });

  const handleEdit = (unit) => {
    setEditUnit(unit);
    setFormData(unit);
    setShowDialog(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    editUnit ? updateMutation.mutate({ id: editUnit.id, data: formData }) : createMutation.mutate(formData);
  };

  const handleExport = () => {
    const rows = [
      ['Unit Number', 'Hotel', 'Type', 'Status', 'Resident', 'Monthly Rent', 'Lease Start', 'Lease End', 'Notes'],
      ...filteredUnits.map(u => [
        u.unit_number,
        getHotelName(u.hotel_id),
        u.unit_type,
        u.status,
        getResidentName(u.current_resident_id),
        u.monthly_rent,
        u.lease_start_date,
        u.lease_end_date,
        u.notes
      ])
    ];
    const csv = rows.map(r => r.map(v => `"${v || ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'units.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredUnits = units.filter(u => {
    const q = searchText.toLowerCase();
    const matchesSearch = !q || u.unit_number?.toLowerCase().includes(q) || u.current_resident_id?.toLowerCase().includes(q);
    const matchesHotel = filterHotel === 'all' || u.hotel_id === filterHotel;
    const matchesStatus = filterStatus.length === 0 || filterStatus.includes(u.status);
    const matchesUnitType = filterUnitTypes.length === 0 || filterUnitTypes.includes(u.unit_type);
    const matchesRent = (!rentMin || u.monthly_rent >= parseFloat(rentMin)) && (!rentMax || u.monthly_rent <= parseFloat(rentMax));
    const matchesLeaseStart = (!leaseStartMin || u.lease_start_date >= leaseStartMin) && (!leaseStartMax || u.lease_start_date <= leaseStartMax);
    const matchesLeaseEnd = (!leaseEndMin || u.lease_end_date >= leaseEndMin) && (!leaseEndMax || u.lease_end_date <= leaseEndMax);
    return matchesSearch && matchesHotel && matchesStatus && matchesUnitType && matchesRent && matchesLeaseStart && matchesLeaseEnd;
  });

  const getHotelName = (hotelId) => hotels.find(h => h.id === hotelId)?.name || 'Unknown';
  const getResidentName = (residentId) => clients.find(c => c.id === residentId)?.company_name || residentId || '—';

  const stats = [
    { label: 'Total Units', value: units.length, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Rented', value: units.filter(u => u.status === 'rented').length, icon: User, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Available', value: units.filter(u => u.status === 'available').length, icon: Building2, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'Maintenance', value: units.filter(u => u.status === 'maintenance').length, icon: Building2, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  const firstName = (user?.display_name) || user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{greeting}, {firstName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">Unit Management</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="text-slate-300 border-slate-600 hover:bg-slate-700">
              <Upload className="w-4 h-4 mr-1.5" /> Import
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="text-slate-300 border-slate-600 hover:bg-slate-700">
              <Download className="w-4 h-4 mr-1.5" /> Export
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500" onClick={() => { setEditUnit(null); setFormData(BLANK_FORM); setShowDialog(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> New Unit
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-0">
            {/* Filters */}
            <div className="p-4 border-b border-slate-700 space-y-4">
              {/* Basic Filters */}
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by unit number or resident..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <Select value={filterHotel} onValueChange={setFilterHotel}>
                  <SelectTrigger className="w-full md:w-40 bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="Hotel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Hotels</SelectItem>
                    {hotels.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="text-slate-300 border-slate-600 hover:bg-slate-700"
                >
                  {showAdvancedFilters ? 'Hide' : 'Show'} Filters
                </Button>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="space-y-4 pt-4 border-t border-slate-700">
                  {/* Status Multi-Select */}
                  <div className="space-y-2">
                    <Label className="text-slate-200">Status</Label>
                    <div className="flex flex-wrap gap-3">
                      {['available', 'rented', 'maintenance'].map(status => (
                        <label key={status} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={filterStatus.includes(status)}
                            onCheckedChange={(checked) => {
                              setFilterStatus(checked
                                ? [...filterStatus, status]
                                : filterStatus.filter(s => s !== status)
                              );
                            }}
                          />
                          <span className="text-sm text-slate-300 capitalize">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Unit Type Multi-Select */}
                  <div className="space-y-2">
                    <Label className="text-slate-200">Unit Type</Label>
                    <div className="flex flex-wrap gap-3">
                      {['studio', '1-bedroom', '2-bedroom', 'suite', 'penthouse'].map(type => (
                        <label key={type} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={filterUnitTypes.includes(type)}
                            onCheckedChange={(checked) => {
                              setFilterUnitTypes(checked
                                ? [...filterUnitTypes, type]
                                : filterUnitTypes.filter(t => t !== type)
                              );
                            }}
                          />
                          <span className="text-sm text-slate-300 capitalize">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Monthly Rent Range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-200 text-xs">Min Monthly Rent</Label>
                      <Input
                        type="number"
                        placeholder="Min"
                        value={rentMin}
                        onChange={(e) => setRentMin(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200 text-xs">Max Monthly Rent</Label>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={rentMax}
                        onChange={(e) => setRentMax(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                      />
                    </div>
                  </div>

                  {/* Lease Start Date Range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-200 text-xs">Lease Start From</Label>
                      <Input
                        type="date"
                        value={leaseStartMin}
                        onChange={(e) => setLeaseStartMin(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200 text-xs">Lease Start Until</Label>
                      <Input
                        type="date"
                        value={leaseStartMax}
                        onChange={(e) => setLeaseStartMax(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  {/* Lease End Date Range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-slate-200 text-xs">Lease End From</Label>
                      <Input
                        type="date"
                        value={leaseEndMin}
                        onChange={(e) => setLeaseEndMin(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-200 text-xs">Lease End Until</Label>
                      <Input
                        type="date"
                        value={leaseEndMax}
                        onChange={(e) => setLeaseEndMax(e.target.value)}
                        className="bg-slate-700/50 border-slate-600 text-white"
                      />
                    </div>
                  </div>

                  {/* Clear Filters */}
                  {(filterStatus.length > 0 || filterUnitTypes.length > 0 || rentMin || rentMax || leaseStartMin || leaseStartMax || leaseEndMin || leaseEndMax) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFilterStatus([]);
                        setFilterUnitTypes([]);
                        setRentMin('');
                        setRentMax('');
                        setLeaseStartMin('');
                        setLeaseStartMax('');
                        setLeaseEndMin('');
                        setLeaseEndMax('');
                      }}
                      className="text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-4 h-4 mr-1.5" /> Clear Filters
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Table Header */}
            {filteredUnits.length > 0 && (
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                <div className="col-span-2">Unit</div>
                <div className="col-span-2">Hotel</div>
                <div className="col-span-2">Type</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Resident</div>
                <div className="col-span-2">Rent</div>
              </div>
            )}

            {/* Rows */}
            {filteredUnits.length === 0 ? (
              <div className="py-16 text-center">
                <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 mb-1">No units yet</p>
                <p className="text-slate-500 text-sm mb-4">Add your first unit to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {filteredUnits.map(unit => (
                  <div key={unit.id} className="group grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-700/30 transition-colors">
                    {/* Unit Number */}
                    <div className="col-span-12 md:col-span-2 flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-md bg-blue-600/20 border border-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-sm">
                        {unit.unit_number?.[0]?.toUpperCase()}
                      </div>
                      <span className="text-white font-medium truncate text-sm">{unit.unit_number}</span>
                    </div>
                    {/* Hotel */}
                    <div className="hidden md:block col-span-2 text-sm text-slate-300 truncate">
                      {getHotelName(unit.hotel_id)}
                    </div>
                    {/* Type */}
                    <div className="hidden md:block col-span-2">
                      <Badge className={`text-xs ${UNIT_TYPE_COLORS[unit.unit_type]}`}>
                        {unit.unit_type}
                      </Badge>
                    </div>
                    {/* Status */}
                    <div className="hidden md:block col-span-2">
                      <Badge className={`text-xs ${STATUS_COLORS[unit.status]}`}>
                        {unit.status}
                      </Badge>
                    </div>
                    {/* Resident */}
                    <div className="hidden md:block col-span-2 text-xs text-slate-400 truncate">
                      {getResidentName(unit.current_resident_id)}
                    </div>
                    {/* Rent */}
                    <div className="hidden md:flex col-span-2 items-center gap-1 text-sm text-slate-300">
                      <DollarSign className="w-3 h-3" />
                      {unit.monthly_rent}
                    </div>
                    {/* Actions */}
                    <div className="col-span-12 md:col-span-0 flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(unit)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteMutation.mutate(unit.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {filteredUnits.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
                Showing {filteredUnits.length} of {units.length} units
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Modal */}
      <ImportTenantsModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ['units'] })}
        hotels={hotels}
      />

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setFormData(BLANK_FORM); setEditUnit(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editUnit ? 'Edit Unit' : 'Create New Unit'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hotel *</Label>
                <Select value={formData.hotel_id} onValueChange={(val) => setFormData({ ...formData, hotel_id: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hotels.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Unit Number *</Label>
                <Input value={formData.unit_number} onChange={(e) => setFormData({ ...formData, unit_number: e.target.value })} placeholder="e.g., A101" required />
              </div>
              <div className="space-y-2">
                <Label>Unit Type *</Label>
                <Input value={formData.unit_type} onChange={(e) => setFormData({ ...formData, unit_type: e.target.value })} placeholder="e.g., Studio, 1-Bedroom, 2-Bedroom" required />
              </div>
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="rented">Rented</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly Rent *</Label>
                <Input type="number" step="0.01" value={formData.monthly_rent} onChange={(e) => setFormData({ ...formData, monthly_rent: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Current Resident</Label>
                <Select value={formData.current_resident_id} onValueChange={(val) => setFormData({ ...formData, current_resident_id: val })}>
                  <SelectTrigger><SelectValue placeholder="Select resident" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Lease Start Date</Label>
                <Input type="date" value={formData.lease_start_date} onChange={(e) => setFormData({ ...formData, lease_start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Lease End Date</Label>
                <Input type="date" value={formData.lease_end_date} onChange={(e) => setFormData({ ...formData, lease_end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending || updateMutation.isPending}>
              {editUnit ? 'Update Unit' : 'Create Unit'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}