import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, FileText, CheckCircle, XCircle, Clock, Send } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";
import RFPForm from "../components/rfp/RFPForm";

const STATUS_CONFIG = {
  in_progress: { label: 'In Progress', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30', icon: Clock },
  submitted: { label: 'Submitted', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30', icon: Send },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-300 border-green-500/30', icon: CheckCircle },
  declined: { label: 'Declined', color: 'bg-red-500/20 text-red-300 border-red-500/30', icon: XCircle },
};

export default function RFPs() {
  const [showForm, setShowForm] = useState(false);
  const [editRFP, setEditRFP] = useState(null);
  const location = useLocation();

  // useLocation re-fires on every Link nav (including same-page hash changes);
  // window's `hashchange` event does not fire from React Router pushState.
  useEffect(() => {
    if (location.hash === '#new-rfp') {
      setShowForm(true);
      setEditRFP(null);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [location.hash, location.key]);
  const [search, setSearch] = useState('');
  const [hotelFilter, setHotelFilter] = useState('all');
  const [dateMode, setDateMode] = useState('ytd');
  const [rfpDateField, setRfpDateField] = useState('submission_date');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const queryClient = useQueryClient();

  const { data: rfps = [] } = useQuery({ queryKey: ['rfps'], queryFn: () => base44.entities.RFP.list('-created_date') });
  const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: () => base44.entities.Hotel.list() });

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || '-';

  const getDateRange = () => {
    const now = new Date();
    if (dateMode === 'mtd') return { start: startOfMonth(now).toISOString().split('T')[0], end: endOfMonth(now).toISOString().split('T')[0] };
    if (dateMode === 'ytd') return { start: startOfYear(now).toISOString().split('T')[0], end: endOfYear(now).toISOString().split('T')[0] };
    return { start: customStart, end: customEnd };
  };

  const { start, end } = getDateRange();

  const filtered = rfps.filter(r => {
    const matchSearch = r.company_name?.toLowerCase().includes(search.toLowerCase()) || r.contact_person?.toLowerCase().includes(search.toLowerCase()) || r.seller_name?.toLowerCase().includes(search.toLowerCase());
    const matchHotel = hotelFilter === 'all' || r.hotel_id === hotelFilter;
    const dateField = rfpDateField === 'created_date' ? r.created_date?.split('T')[0] : rfpDateField === 'response_date' ? r.response_date : r.submission_date || r.created_date?.split('T')[0];
    const matchDate = (!start || !dateField || dateField >= start) && (!end || !dateField || dateField <= end);
    return matchSearch && matchHotel && matchDate;
  });

  const counts = {
    all: filtered.length,
    in_progress: filtered.filter(r => r.status === 'in_progress').length,
    submitted: filtered.filter(r => r.status === 'submitted').length,
    approved: filtered.filter(r => r.status === 'approved').length,
    declined: filtered.filter(r => r.status === 'declined').length,
  };

  const totalRoomNights = filtered.reduce((s, r) => s + (r.potential_room_nights || 0), 0);

  const handleDelete = async (id) => {
    if (!confirm('Delete this RFP?')) return;
    try {
      await base44.entities.RFP.delete(id);
      queryClient.invalidateQueries({ queryKey: ['rfps'] });
    } catch (err) {
      alert('Failed to delete RFP: ' + (err?.message || 'Unknown error'));
    }
  };

  const RFPCard = ({ rfp }) => {
    const cfg = STATUS_CONFIG[rfp.status] || STATUS_CONFIG.in_progress;
    const Icon = cfg.icon;
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-all">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-semibold truncate">{rfp.company_name}</h3>
              <Badge className={`${cfg.color} border text-xs flex items-center gap-1`}>
                <Icon className="w-3 h-3" />{cfg.label}
              </Badge>
            </div>
            <p className="text-slate-400 text-sm mt-0.5">{getHotelName(rfp.hotel_id)}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
              {rfp.contact_person && <span>👤 {rfp.contact_person}</span>}
              {rfp.seller_name && <span>🧑‍💼 {rfp.seller_name}</span>}
              {rfp.potential_room_nights > 0 && <span>🛏 {rfp.potential_room_nights} RNs</span>}
              {rfp.submission_date && <span>📅 {format(new Date(rfp.submission_date), 'MMM d, yyyy')}</span>}
            </div>
            {rfp.about_account && <p className="text-xs text-slate-500 mt-2 line-clamp-2">{rfp.about_account}</p>}
            {rfp.seasons?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {rfp.seasons.map((s, i) => (
                  <span key={i} className="text-xs bg-slate-700 text-slate-300 rounded px-2 py-0.5">
                    {s.season_name}: {s.rate_type === 'flat_rate' ? `$${s.rate_value}` : `${s.rate_value}% off`}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 w-8" onClick={() => { setEditRFP(rfp); setShowForm(true); }}>
              <Edit className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-red-400 hover:bg-red-500/10 h-8 w-8" onClick={() => handleDelete(rfp.id)}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <FileText className="w-8 h-8 text-blue-400" />
              RFP Tracker
            </h1>
            <p className="text-slate-400 mt-1">Track and manage Request for Proposals by hotel</p>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditRFP(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New RFP
          </Button>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col md:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="Search company, contact, seller..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400" />
          </div>
          <Select value={hotelFilter} onValueChange={setHotelFilter}>
            <SelectTrigger className="w-48 bg-slate-700 border-slate-600 text-white"><SelectValue placeholder="All Hotels" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hotels</SelectItem>
              {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={rfpDateField} onValueChange={setRfpDateField}>
            <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="submission_date">Submission Date</SelectItem>
              <SelectItem value="created_date">Created Date</SelectItem>
              <SelectItem value="response_date">Response Date</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateMode} onValueChange={setDateMode}>
            <SelectTrigger className="w-44 bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mtd">Month to Date</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {dateMode === 'custom' && (
            <>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-40 bg-slate-700 border-slate-600 text-white [color-scheme:dark]" />
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-40 bg-slate-700 border-slate-600 text-white [color-scheme:dark]" />
            </>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Total RFPs', value: counts.all, color: 'text-white' },
            { label: 'In Progress', value: counts.in_progress, color: 'text-yellow-400' },
            { label: 'Submitted', value: counts.submitted, color: 'text-blue-400' },
            { label: 'Approved', value: counts.approved, color: 'text-green-400' },
            { label: 'Declined', value: counts.declined, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
              <p className="text-slate-400 text-xs">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-center gap-3">
          <span className="text-slate-400 text-sm">Total Potential Room Nights (filtered):</span>
          <span className="text-white font-bold text-lg">{totalRoomNights.toLocaleString()}</span>
        </div>

        {/* Tabs by status */}
        <Tabs defaultValue="all">
          <TabsList className="bg-slate-800 border border-slate-700">
            <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">All ({counts.all})</TabsTrigger>
            <TabsTrigger value="in_progress" className="data-[state=active]:bg-yellow-600 data-[state=active]:text-white text-slate-400">In Progress ({counts.in_progress})</TabsTrigger>
            <TabsTrigger value="submitted" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">Submitted ({counts.submitted})</TabsTrigger>
            <TabsTrigger value="approved" className="data-[state=active]:bg-green-600 data-[state=active]:text-white text-slate-400">Approved ({counts.approved})</TabsTrigger>
            <TabsTrigger value="declined" className="data-[state=active]:bg-red-600 data-[state=active]:text-white text-slate-400">Declined ({counts.declined})</TabsTrigger>
          </TabsList>

          {['all', 'in_progress', 'submitted', 'approved', 'declined'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filtered.filter(r => tab === 'all' || r.status === tab).length === 0 ? (
                  <div className="col-span-2 text-center text-slate-500 py-12">No RFPs found</div>
                ) : (
                  filtered.filter(r => tab === 'all' || r.status === tab).map(rfp => <RFPCard key={rfp.id} rfp={rfp} />)
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={open => { setShowForm(open); if (!open) setEditRFP(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">{editRFP ? 'Edit RFP' : 'New RFP'}</DialogTitle>
          </DialogHeader>
          <RFPForm rfp={editRFP} onSuccess={() => { setShowForm(false); setEditRFP(null); }} onCancel={() => { setShowForm(false); setEditRFP(null); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}