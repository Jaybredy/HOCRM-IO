import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, Users, FileText, Eye, Handshake, Globe, Mic2, UtensilsCrossed, RefreshCw, Activity, Target, ChevronRight, Trash2, Download, Pencil } from "lucide-react";
import ClientSearchSelect from "@/components/clients/ClientSearchSelect";
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subMonths, startOfQuarter, endOfQuarter, subQuarters, format, parseISO } from "date-fns";

const ACTIVITY_TYPES = [
  { value: 'solicitation_call', label: 'Solicitation Call', icon: Phone, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  { value: 'prospecting', label: 'Prospecting', icon: Users, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { value: 'sent_proposal', label: 'Sent Proposal', icon: FileText, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  { value: 'follow_up', label: 'Follow Up', icon: RefreshCw, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  { value: 'site_inspection', label: 'Site Inspection', icon: Eye, color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
  { value: 'network_event', label: 'Network Event', icon: Globe, color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  { value: 'tradeshow', label: 'Tradeshow', icon: Mic2, color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  { value: 'client_entertainment', label: 'Client Entertainment', icon: UtensilsCrossed, color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { value: 'definite', label: 'Definite Booking', icon: Handshake, color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  { value: 'other', label: 'Other', icon: Activity, color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
];

const PERIOD_OPTIONS = [
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'q1', label: 'Q1 (Jan–Mar)' },
  { value: 'q2', label: 'Q2 (Apr–Jun)' },
  { value: 'q3', label: 'Q3 (Jul–Sep)' },
  { value: 'q4', label: 'Q4 (Oct–Dec)' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_30', label: 'Last 30 Days' },
  { value: 'all_time', label: 'All Time' },
];

function getPeriodRange(period) {
  const today = new Date();
  const year = today.getFullYear();
  switch (period) {
    case 'this_month': return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'last_month': return { start: startOfMonth(subMonths(today, 1)), end: endOfMonth(subMonths(today, 1)) };
    case 'this_quarter': return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case 'last_quarter': return { start: startOfQuarter(subQuarters(today, 1)), end: endOfQuarter(subQuarters(today, 1)) };
    case 'q1': return { start: new Date(year, 0, 1), end: new Date(year, 2, 31) };
    case 'q2': return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) };
    case 'q3': return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) };
    case 'q4': return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) };
    case 'this_year': return { start: startOfYear(today), end: endOfYear(today) };
    case 'last_30': return { start: subDays(today, 30), end: today };
    default: return { start: new Date('2020-01-01'), end: new Date('2030-12-31') };
  }
}

const getActivityConfig = (type) => ACTIVITY_TYPES.find(t => t.value === type) || ACTIVITY_TYPES[ACTIVITY_TYPES.length - 1];

export default function SalesActivities() {
  const [showForm, setShowForm] = useState(false);
  const [editingActivity, setEditingActivity] = useState(null);
  const [period, setPeriod] = useState('this_month');
  const [dateField, setDateField] = useState('activity_date');
  const [filterSeller, setFilterSeller] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterHotel, setFilterHotel] = useState('');
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    hotel_id: '', activity_type: 'solicitation_call', client_name: '', client_id: '', seller_name: '',
    activity_date: new Date().toISOString().split('T')[0], notes: '', source: '', other_source_details: '', outcome: ''
  });

  // Pre-fill hotel when filter changes
  useEffect(() => {
    if (filterHotel) setFormData(prev => ({ ...prev, hotel_id: filterHotel }));
  }, [filterHotel]);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      const admin = ['admin', 'EPIC_ADMIN'].includes(u?.role);
      setIsAdmin(admin);
      if (u?.full_name) {
        setFormData(prev => ({ ...prev, seller_name: u.full_name }));
        // Non-admins are locked to their own data
        if (!admin) setFilterSeller(u.full_name);
      }
    }).catch(() => {});
  }, []);

  const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: () => base44.entities.Hotel.list() });
  const { data: clients = [] } = useQuery({ queryKey: ['clients'], queryFn: () => base44.entities.Client.list() });
  const { data: activities = [] } = useQuery({ queryKey: ['activityLogs'], queryFn: () => base44.entities.ActivityLog.list('-activity_date') });
  const { data: goals = [] } = useQuery({ queryKey: ['activityGoals'], queryFn: () => base44.entities.ActivityGoal.list() });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ActivityLog.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activityLogs'] }); setShowForm(false); resetForm(); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ActivityLog.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activityLogs'] }); setShowForm(false); setEditingActivity(null); resetForm(); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ActivityLog.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activityLogs'] })
  });

  const resetForm = () => setFormData({
    hotel_id: filterHotel || '', activity_type: 'solicitation_call', client_name: '', client_id: '', seller_name: user?.full_name || '',
    activity_date: new Date().toISOString().split('T')[0], notes: '', source: '', other_source_details: '', outcome: ''
  });

  const range = getPeriodRange(period);
  const rangeStart = range.start.toISOString().split('T')[0];
  const rangeEnd = range.end.toISOString().split('T')[0];

  const sellers = [...new Set(activities.map(a => a.seller_name).filter(Boolean))].sort();

  const filtered = activities.filter(a => {
    const dateVal = dateField === 'created_date' ? a.created_date?.split('T')[0] : a.activity_date;
    if (!dateVal || dateVal < rangeStart || dateVal > rangeEnd) return false;
    if (filterSeller && a.seller_name !== filterSeller) return false;
    if (filterType && a.activity_type !== filterType) return false;
    if (filterHotel && a.hotel_id !== filterHotel) return false;
    return true;
  });

  // Summary counts by type
  const countsByType = {};
  ACTIVITY_TYPES.forEach(t => { countsByType[t.value] = filtered.filter(a => a.activity_type === t.value).length; });

  // Goals for current period (month-based)
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const relevantGoals = goals.filter(g => g.year === currentYear && g.month === currentMonth && (!filterSeller || g.seller_name === filterSeller || g.seller_name === 'Team'));

  const getGoalTarget = (activityType) => {
    const goal = relevantGoals.find(g => g.seller_name === (filterSeller || 'Team'));
    return goal?.[activityType] || 0;
  };

  const SOURCE_OPTIONS = [
    { value: 'website', label: 'Website' },
    { value: 'direct', label: 'Direct' },
    { value: 'via_solicitation', label: 'Via Solicitation' },
    { value: 'cvb', label: 'CVB' },
    { value: 'other', label: 'Other' },
  ];

  const OUTCOME_OPTIONS = [
    { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
    { value: 'qualified_lead', label: 'Qualified Lead' },
    { value: 'proposal_requested', label: 'Proposal Requested' },
    { value: 'no_interest', label: 'No Interest' },
    { value: 'follow_up_required', label: 'Follow-up Required' },
    { value: 'converted', label: 'Converted' },
    { value: 'other', label: 'Other' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.activity_type || !formData.activity_date || !formData.seller_name || !formData.client_name || !formData.hotel_id || !formData.source) return;
    if (editingActivity) {
      updateMutation.mutate({ id: editingActivity.id, data: { ...formData, status: formData.activity_type } });
    } else {
      createMutation.mutate({ ...formData, status: formData.activity_type });
    }
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 min-h-screen p-6 text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Sales Activities</h1>
            <p className="text-slate-400 mt-1">Track and measure your team's sales activities and progress toward goals</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              const headers = ['Date', 'Activity', 'Seller', 'Client', 'Notes'];
              const rows = filtered.map(a => [
                a.activity_date || '',
                getActivityConfig(a.activity_type).label,
                a.seller_name || '',
                a.client_name || '',
                (a.notes || '').replace(/,/g, ' ')
              ]);
              const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `sales-activities-${period}-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
            }}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent"
          >
            <Download className="w-4 h-4" /> Export Report
          </Button>
          <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-900/30">
            <Plus className="w-4 h-4" /> Log Activity
          </Button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Property</Label>
            <Select value={filterHotel || 'all'} onValueChange={v => setFilterHotel(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm"><SelectValue placeholder="All Properties" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {isAdmin ? (
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Seller</Label>
              <Select value={filterSeller || 'all'} onValueChange={v => setFilterSeller(v === 'all' ? '' : v)}>
                <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm"><SelectValue placeholder="All Sellers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sellers</SelectItem>
                  {sellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Seller</Label>
              <div className="h-9 bg-slate-700 border border-slate-600 rounded-md px-3 flex items-center text-slate-300 text-sm">
                {user?.full_name || 'You'} <span className="ml-2 text-xs text-slate-500">(your data only)</span>
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Activity Type</Label>
            <Select value={filterType || 'all'} onValueChange={v => setFilterType(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Date Field</Label>
            <Select value={dateField} onValueChange={setDateField}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activity_date">Activity Date</SelectItem>
                <SelectItem value="created_date">Created Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <div className="text-sm text-slate-400 py-2">{filtered.length} activities</div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {ACTIVITY_TYPES.filter(t => countsByType[t.value] > 0 || getGoalTarget(t.value) > 0).map(type => {
            const count = countsByType[type.value] || 0;
            const target = getGoalTarget(type.value);
            const pct = target > 0 ? Math.min(100, Math.round((count / target) * 100)) : null;
            const Icon = type.icon;
            return (
              <Card key={type.value} className={`bg-slate-800/60 border border-slate-700 cursor-pointer hover:border-slate-500 transition-all ${filterType === type.value ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setFilterType(filterType === type.value ? '' : type.value)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg border ${type.color}`}><Icon className="w-3.5 h-3.5" /></div>
                    <span className="text-xs text-slate-400 leading-tight">{type.label}</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{count}</div>
                  {pct !== null && (
                    <div className="mt-1.5">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Goal: {target}</span><span>{pct}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {/* Total card */}
          <Card className="bg-blue-600/20 border border-blue-500/40">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30"><Activity className="w-3.5 h-3.5 text-blue-400" /></div>
                <span className="text-xs text-slate-400">Total</span>
              </div>
              <div className="text-2xl font-bold text-white">{filtered.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Activities Table */}
        <Card className="bg-slate-800/50 border border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Activity Log</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <div className="text-center text-slate-500 py-12">No activities found for the selected filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/50 border-b border-slate-700">
                    <tr>
                      <th className="text-left p-3 text-slate-400 font-medium">Date</th>
                      <th className="text-left p-3 text-slate-400 font-medium">Activity</th>
                      <th className="text-left p-3 text-slate-400 font-medium">Seller</th>
                      <th className="text-left p-3 text-slate-400 font-medium">Client</th>
                      <th className="text-left p-3 text-slate-400 font-medium">Hotel</th>
                      <th className="text-left p-3 text-slate-400 font-medium">Notes</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(activity => {
                      const cfg = getActivityConfig(activity.activity_type);
                      const hotel = hotels.find(h => h.id === activity.hotel_id);
                      const Icon = cfg.icon;
                      return (
                        <tr key={activity.id} className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 text-slate-300 whitespace-nowrap">{activity.activity_date ? format(parseISO(activity.activity_date), 'MMM d, yyyy') : '—'}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                              <Icon className="w-3 h-3" />{cfg.label}
                            </span>
                          </td>
                          <td className="p-3 text-slate-200 font-medium">{activity.seller_name || '—'}</td>
                          <td className="p-3 text-slate-300">{activity.client_name || '—'}</td>
                          <td className="p-3 text-slate-400">{hotel?.name || '—'}</td>
                          <td className="p-3 text-slate-400 max-w-xs truncate">{activity.notes || '—'}</td>
                          <td className="p-3 flex items-center gap-1">
                            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-200 h-7 w-7 p-0"
                              onClick={() => {
                                setEditingActivity(activity);
                                setFormData({
                                  hotel_id: activity.hotel_id || '',
                                  activity_type: activity.activity_type || 'solicitation_call',
                                  client_name: activity.client_name || '',
                                  client_id: activity.client_id || '',
                                  seller_name: activity.seller_name || '',
                                  activity_date: activity.activity_date || '',
                                  notes: activity.notes || '',
                                  source: activity.source || '',
                                  other_source_details: activity.other_source_details || '',
                                  outcome: activity.outcome || ''
                                });
                                setShowForm(true);
                              }}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 h-7 w-7 p-0"
                              onClick={() => { if (confirm('Delete this activity?')) deleteMutation.mutate(activity.id); }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Log Activity Dialog */}
        <Dialog open={showForm} onOpenChange={(v) => { setShowForm(v); if (!v) { setEditingActivity(null); resetForm(); } }}>
          <DialogContent className="max-w-lg bg-slate-900 border border-slate-700 text-slate-100">
            <DialogHeader>
              <DialogTitle className="text-white">{editingActivity ? 'Edit Sales Activity' : 'Log Sales Activity'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Activity Type *</Label>
                  <Select value={formData.activity_type} onValueChange={v => setFormData(prev => ({ ...prev, activity_type: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Date *</Label>
                  <Input type="date" value={formData.activity_date} onChange={e => setFormData(prev => ({ ...prev, activity_date: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white [&::-webkit-calendar-picker-indicator]:invert" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Seller Name *</Label>
                  <Input value={formData.seller_name} onChange={e => setFormData(prev => ({ ...prev, seller_name: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white" placeholder="Your name" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Property * {filterHotel && <span className="text-blue-400 text-xs">(pre-filled)</span>}</Label>
                  <Select value={formData.hotel_id || ''} onValueChange={v => setFormData(prev => ({ ...prev, hotel_id: v }))} required>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Select property" /></SelectTrigger>
                    <SelectContent>{hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                </div>
                <div className="space-y-1.5">
                <Label className="text-slate-300">Client / Company Name *</Label>
                <ClientSearchSelect
                  clients={clients}
                  hotels={hotels}
                  selectedClientName={formData.client_name}
                  selectedClientId={formData.client_id}
                  propertyId={formData.hotel_id}
                  required
                  onSelect={(c) => setFormData(prev => ({ ...prev, client_name: c?.company_name || '', client_id: c?.id || '' }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Source <span className="text-red-400">*</span></Label>
                  <Select value={formData.source} onValueChange={v => setFormData(prev => ({ ...prev, source: v }))} required>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Select source" /></SelectTrigger>
                    <SelectContent>{SOURCE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Outcome</Label>
                  <Select value={formData.outcome} onValueChange={v => setFormData(prev => ({ ...prev, outcome: v }))}>
                    <SelectTrigger className="bg-slate-800 border-slate-600 text-white"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                    <SelectContent>{OUTCOME_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {formData.source === 'other' && (
                <div className="space-y-1.5">
                  <Label className="text-slate-300">Other Source Details</Label>
                  <Input value={formData.other_source_details} onChange={e => setFormData(prev => ({ ...prev, other_source_details: e.target.value }))}
                    className="bg-slate-800 border-slate-600 text-white" placeholder="Describe the source..." />
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-slate-300">Notes</Label>
                <Textarea value={formData.notes} onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" rows={3} placeholder="What was discussed? Any follow-up actions?" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 bg-blue-600 hover:bg-blue-500">
                  {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editingActivity ? 'Save Changes' : 'Log Activity'}
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowForm(false); resetForm(); }} className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">Cancel</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}