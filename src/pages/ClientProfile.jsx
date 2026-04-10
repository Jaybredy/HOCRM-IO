import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft, Edit, FileText, Building2, User, Mail, Phone, MapPin, Tag,
  Plus, Pin, Trash2, BedDouble, DollarSign, TrendingUp, Activity,
  MessageSquare, Clock, Search, SortAsc, SortDesc, Hotel,
  Paperclip, FolderOpen, Calendar, CheckCircle2, AlertCircle
} from "lucide-react";

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
  lost: 'bg-red-100 text-red-800',
};

const DEAL_STATUS_COLORS = {
  solicitation: 'bg-slate-100 text-slate-700',
  prospect: 'bg-yellow-100 text-yellow-800',
  tentative: 'bg-orange-100 text-orange-800',
  definite: 'bg-green-100 text-green-800',
  actual: 'bg-blue-100 text-blue-800',
  lost: 'bg-red-100 text-red-800',
};

const ACTIVITY_COLORS = {
  solicitation_call: { dot: 'bg-blue-500', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  sent_proposal:     { dot: 'bg-purple-500', badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  follow_up:         { dot: 'bg-yellow-500', badge: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  tentative:         { dot: 'bg-orange-500', badge: 'bg-orange-50 text-orange-700 border-orange-200' },
  definite:          { dot: 'bg-green-500', badge: 'bg-green-50 text-green-700 border-green-200' },
  site_visit:        { dot: 'bg-teal-500', badge: 'bg-teal-50 text-teal-700 border-teal-200' },
  lost:              { dot: 'bg-red-500', badge: 'bg-red-50 text-red-700 border-red-200' },
};

// Mock data shown when no real data exists
const MOCK_ACTIVITIES = [
  { id: 'm1', status: 'solicitation_call', activity_date: '2026-02-20', notes: 'Initial outreach call. Client expressed interest in Q3 group block.', seller_name: 'Alex Morgan' },
  { id: 'm2', status: 'sent_proposal', activity_date: '2026-02-15', notes: 'Sent proposal for 80 room nights at $189/night for May conference.', seller_name: 'Alex Morgan' },
  { id: 'm3', status: 'follow_up', activity_date: '2026-02-10', notes: 'Left voicemail. Followed up via email with updated rate sheet.', seller_name: 'Jordan Lee' },
  { id: 'm4', status: 'site_visit', activity_date: '2026-01-28', notes: 'Client toured the property. Very positive feedback on the ballroom.', seller_name: 'Alex Morgan' },
  { id: 'm5', status: 'solicitation_call', activity_date: '2026-01-15', notes: 'First contact. Referred by BlackRock Advisors account.', seller_name: 'Jordan Lee' },
];

const MOCK_NOTES = [
  { id: 'n1', title: 'VIP Preferences', content: 'Client prefers high-floor rooms, non-smoking. Always requests early check-in. Coffee in meeting rooms.', is_pinned: true, created_date: '2026-02-18' },
  { id: 'n2', title: 'Decision Timeline', content: 'Final decision expected by March 15. Budget sign-off requires two approvals from their CFO and CTO.', is_pinned: false, created_date: '2026-02-12' },
  { id: 'n3', title: 'Competing Bids', content: 'Also considering Hilton downtown. Our advantage: closer to convention center + complimentary AV.', is_pinned: false, created_date: '2026-02-05' },
];

const MOCK_DOCS = [
  { id: 'd1', name: 'Proposal_Q3_2026.pdf', type: 'PDF', size: '1.2 MB', date: '2026-02-15', icon: FileText, color: 'text-red-500' },
  { id: 'd2', name: 'Rate_Sheet_Spring.xlsx', type: 'Excel', size: '340 KB', date: '2026-02-10', icon: FileText, color: 'text-green-600' },
  { id: 'd3', name: 'Site_Visit_Notes.docx', type: 'Word', size: '85 KB', date: '2026-01-28', icon: FileText, color: 'text-blue-500' },
];

export default function ClientProfile() {
  const urlParams = new URLSearchParams(window.location.search);
  const clientId = urlParams.get('id');

  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showLinkBooking, setShowLinkBooking] = useState(false);
  const [bookingSearch, setBookingSearch] = useState('');
  const [editFormData, setEditFormData] = useState({});
  const [contactForm, setContactForm] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false });
  const [noteForm, setNoteForm] = useState({ title: '', content: '' });

  // History tab state
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySortDir, setHistorySortDir] = useState('desc'); // 'desc' = recent first

  const { data: client, isLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => base44.entities.Client.filter({ id: clientId }).then(r => r[0]),
    enabled: !!clientId,
  });

  const { data: deals = [] } = useQuery({
    queryKey: ['client-deals', clientId],
    queryFn: () => base44.entities.ProductionItem.list('-arrival_date', 200),
    enabled: !!clientId && !!client,
    select: (items) => items.filter(i =>
      i.client_id === clientId ||
      (i.client_name && client?.company_name && i.client_name.toLowerCase().trim() === client.company_name.toLowerCase().trim())
    ),
  });

  const { data: rawActivities = [] } = useQuery({
    queryKey: ['client-activities', clientId],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date', 50),
    enabled: !!clientId && !!client,
    select: (items) => items.filter(i => i.client_name === client?.company_name),
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts', clientId],
    queryFn: () => base44.entities.Contact.filter({ client_id: clientId }),
    enabled: !!clientId,
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['all-bookings-for-link'],
    queryFn: () => base44.entities.ProductionItem.filter({ is_deleted: false }),
    enabled: showLinkBooking,
  });

  const { data: rawNotes = [] } = useQuery({
    queryKey: ['client-notes', clientId],
    queryFn: () => base44.entities.TeamNote.filter({ related_entity_type: 'Client', related_entity_id: clientId }),
    enabled: !!clientId,
  });

  const updateClientMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.update(clientId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['client', clientId] }); setShowEditDialog(false); }
  });

  const createContactMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create({ ...data, client_id: clientId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contacts', clientId] }); setShowAddContact(false); setContactForm({ first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false }); }
  });

  const deleteContactMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts', clientId] })
  });

  const createNoteMutation = useMutation({
    mutationFn: (data) => base44.entities.TeamNote.create({ ...data, related_entity_type: 'Client', related_entity_id: clientId }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] }); setShowAddNote(false); setNoteForm({ title: '', content: '' }); }
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id) => base44.entities.TeamNote.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-notes', clientId] })
  });

  if (!clientId) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 mb-4">No client selected.</p>
        <Link to={createPageUrl('Clients')}><Button variant="outline">Go to Clients</Button></Link>
      </div>
    </div>
  );

  if (isLoading || !client) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Loading client profile...</p>
    </div>
  );

  // Use mock data if no real data
  const activities = rawActivities.length > 0 ? rawActivities : MOCK_ACTIVITIES;
  const notes = rawNotes.length > 0 ? rawNotes : MOCK_NOTES;
  const usingMock = rawActivities.length === 0;

  // History: combine activities + notes into one sorted feed
  const activityEntries = activities.map(a => ({ ...a, _type: 'activity', _date: a.activity_date || '' }));
  const noteEntries = notes.map(n => ({ ...n, _type: 'note', _date: n.created_date || '' }));

  let historyEntries = [...activityEntries, ...noteEntries];

  // Filter
  if (historyFilter === 'activities') historyEntries = historyEntries.filter(e => e._type === 'activity');
  if (historyFilter === 'notes') historyEntries = historyEntries.filter(e => e._type === 'note');
  if (historyFilter !== 'all' && historyFilter !== 'activities' && historyFilter !== 'notes') {
    historyEntries = historyEntries.filter(e => e._type === 'activity' && e.status === historyFilter);
  }

  // Search
  if (historySearch.trim()) {
    const q = historySearch.toLowerCase();
    historyEntries = historyEntries.filter(e =>
      e.notes?.toLowerCase().includes(q) ||
      e.content?.toLowerCase().includes(q) ||
      e.title?.toLowerCase().includes(q) ||
      e.status?.toLowerCase().includes(q) ||
      e.seller_name?.toLowerCase().includes(q)
    );
  }

  // Sort — default desc (recent first)
  historyEntries = [...historyEntries].sort((a, b) => {
    const da = a._date || '';
    const db = b._date || '';
    return historySortDir === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
  });

  const totalRevenue = deals.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalNights = deals.reduce((s, d) => s + (d.room_nights || 0), 0);
  const sortedContacts = [...contacts].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <Link to={createPageUrl('Clients')}>
          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-800 gap-1.5 pl-0">
            <ArrowLeft className="w-4 h-4" /> Back to Clients
          </Button>
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="text-blue-600 border-blue-300"
            onClick={() => window.location.href = createPageUrl('CRM') + '#add-production'}>
            <Hotel className="w-3.5 h-3.5 mr-1.5" /> Add Booking
          </Button>
          <Button variant="outline" size="sm" className="text-purple-600 border-purple-300"
            onClick={() => window.location.href = createPageUrl('RFPs') + '#new-rfp'}>
            <FileText className="w-3.5 h-3.5 mr-1.5" /> Add RFP
          </Button>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700"
            onClick={() => { setEditFormData({ ...client }); setShowEditDialog(true); }}>
            <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Client
          </Button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xl">
            {client.company_name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{client.company_name}</h1>
              {client.status && <Badge className={`${STATUS_COLORS[client.status]} text-xs`}>{client.status.replace(/_/g, ' ')}</Badge>}
              {client.industry && <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">{client.industry}</Badge>}
            </div>
            {client.contact_person && (
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> {client.contact_person}
              </p>
            )}
            {/* Quick contact buttons */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {client.email && (
                <a href={`mailto:${client.email}`}>
                  <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 text-xs gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> {client.email}
                  </Button>
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`}>
                  <Button variant="outline" size="sm" className="text-green-600 border-green-200 hover:bg-green-50 h-8 text-xs gap-1.5">
                    <Phone className="w-3.5 h-3.5" /> {client.phone}
                  </Button>
                </a>
              )}
              {client.address && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400 py-1">
                  <MapPin className="w-3.5 h-3.5" /> {client.address}
                </span>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{deals.length}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Deals</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-600">{totalNights}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1"><BedDouble className="w-3 h-3" />Room Nights</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-gray-400 flex items-center gap-1"><DollarSign className="w-3 h-3" />Revenue</p>
            </div>
          </div>
        </div>
        {client.notes && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
            <span className="font-medium">Note: </span>{client.notes}
          </div>
        )}
      </div>

      {/* Main Tabs */}
      <div className="px-6 py-4">
        <Tabs defaultValue="history">
          <TabsList className="mb-4">
            <TabsTrigger value="history" className="gap-1.5"><Activity className="w-3.5 h-3.5" />History</TabsTrigger>
            <TabsTrigger value="deals" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" />Deals</TabsTrigger>
            <TabsTrigger value="contacts" className="gap-1.5"><User className="w-3.5 h-3.5" />Contacts</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5"><Paperclip className="w-3.5 h-3.5" />Documents</TabsTrigger>
          </TabsList>

          {/* HISTORY TAB */}
          <TabsContent value="history">
            <Card>
              <CardContent className="p-0">
                {/* Toolbar */}
                <div className="flex flex-wrap gap-3 p-4 border-b border-gray-100 items-center">
                  {usingMock && (
                    <div className="w-full flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      Showing example history — real activity logs will appear here once logged.
                    </div>
                  )}
                  <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
                    <Input
                      placeholder="Search history..."
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="w-44 h-9 text-sm">
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Activity</SelectItem>
                      <SelectItem value="activities">Activities Only</SelectItem>
                      <SelectItem value="notes">Notes Only</SelectItem>
                      <SelectItem value="solicitation_call">Solicitation Calls</SelectItem>
                      <SelectItem value="sent_proposal">Proposals Sent</SelectItem>
                      <SelectItem value="follow_up">Follow Ups</SelectItem>
                      <SelectItem value="site_visit">Site Visits</SelectItem>
                      <SelectItem value="tentative">Tentative</SelectItem>
                      <SelectItem value="definite">Definite</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline" size="sm" className="h-9 gap-1.5 text-sm"
                    onClick={() => setHistorySortDir(d => d === 'desc' ? 'asc' : 'desc')}
                  >
                    {historySortDir === 'desc' ? <><SortDesc className="w-3.5 h-3.5" />Recent First</> : <><SortAsc className="w-3.5 h-3.5" />Oldest First</>}
                  </Button>
                </div>

                {/* Timeline */}
                {historyEntries.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 text-sm">No history entries match your filter.</div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {historyEntries.map((entry, idx) => {
                      if (entry._type === 'activity') {
                        const cfg = ACTIVITY_COLORS[entry.status] || { dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200' };
                        return (
                          <div key={entry.id || idx} className="flex gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                            <div className="flex flex-col items-center pt-1">
                              <span className={`w-3 h-3 rounded-full ${cfg.dot} shrink-0`} />
                              {idx < historyEntries.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1.5" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded border capitalize ${cfg.badge}`}>
                                  {entry.status?.replace(/_/g, ' ')}
                                </span>
                                {entry.activity_date && (
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />{entry.activity_date}
                                  </span>
                                )}
                                {entry.seller_name && (
                                  <span className="text-xs text-gray-400">by {entry.seller_name}</span>
                                )}
                              </div>
                              {entry.notes && <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{entry.notes}</p>}
                            </div>
                          </div>
                        );
                      } else {
                        return (
                          <div key={entry.id || idx} className="flex gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                            <div className="flex flex-col items-center pt-1">
                              <span className={`w-3 h-3 rounded-full ${entry.is_pinned ? 'bg-amber-400' : 'bg-indigo-400'} shrink-0`} />
                              {idx < historyEntries.length - 1 && <div className="w-px flex-1 bg-gray-200 mt-1.5" />}
                            </div>
                            <div className="flex-1 min-w-0 pb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded border ${entry.is_pinned ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                                  {entry.is_pinned ? '📌 Pinned Note' : '📝 Note'}
                                </span>
                                {entry.created_date && (
                                  <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />{entry.created_date}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-medium text-gray-800 mt-1">{entry.title}</p>
                              {entry.content && <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{entry.content}</p>}
                            </div>
                            {!usingMock && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-300 hover:text-red-400 shrink-0 mt-1"
                                onClick={() => deleteNoteMutation.mutate(entry.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        );
                      }
                    })}
                  </div>
                )}

                {/* Add note CTA */}
                <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
                  <Button variant="outline" size="sm" className="text-indigo-600 border-indigo-200" onClick={() => setShowAddNote(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Note
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEALS TAB */}
          <TabsContent value="deals">
            <Card>
              <CardContent className="p-0">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Linked Bookings</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-blue-600 border-blue-200"
                      onClick={() => window.location.href = createPageUrl('CRM') + '#add-production'}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Booking
                    </Button>
                    <Button variant="outline" size="sm" className="text-amber-600 border-amber-200"
                      onClick={() => { setBookingSearch(''); setShowLinkBooking(true); }}>
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Link Existing
                    </Button>
                  </div>
                </div>
                {deals.length === 0 ? (
                  <div className="py-12 text-center">
                    <TrendingUp className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No deals linked yet.</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Dates</th>
                        <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500">Seller</th>
                        <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500">Rooms</th>
                        <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {deals.map(deal => (
                        <tr key={deal.id} className="hover:bg-blue-50 cursor-pointer" onClick={() => window.location.href = createPageUrl('CRM') + `?edit=${deal.id}&returnTo=ClientProfile&clientId=${clientId}`}>
                          <td className="px-5 py-3">
                            <Badge className={`${DEAL_STATUS_COLORS[deal.status] || 'bg-gray-100 text-gray-700'} text-xs`}>
                              {deal.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">
                            {deal.arrival_date} → {deal.departure_date}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-500">{deal.seller_name || '—'}</td>
                          <td className="px-3 py-3 text-right text-xs text-gray-700">{deal.room_nights}</td>
                          <td className="px-5 py-3 text-right text-xs font-semibold text-green-700">${(deal.revenue || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CONTACTS TAB */}
          <TabsContent value="contacts">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">People at {client.company_name}</h3>
                  <Button size="sm" variant="outline" className="text-blue-600 border-blue-200" onClick={() => setShowAddContact(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Contact
                  </Button>
                </div>
                {sortedContacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No contacts yet.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sortedContacts.map(c => (
                      <div key={c.id} className="group flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold shrink-0 text-sm">
                          {c.first_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-800">{c.first_name} {c.last_name}</p>
                            {c.is_primary && <Badge className="bg-green-100 text-green-700 text-xs">Primary</Badge>}
                          </div>
                          {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                          <div className="flex gap-3 mt-1.5">
                            {c.email && <a href={`mailto:${c.email}`} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Mail className="w-3 h-3" />{c.email}</a>}
                            {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" />{c.phone}</a>}
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100" onClick={() => deleteContactMutation.mutate(c.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCUMENTS TAB */}
          <TabsContent value="documents">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Files & Documents</h3>
                  <Button size="sm" variant="outline" className="text-gray-500 border-gray-300" disabled>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Upload File
                  </Button>
                </div>

                {/* Mock docs */}
                <div className="space-y-2 mb-4">
                  {MOCK_DOCS.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                      <doc.icon className={`w-8 h-8 ${doc.color} shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                        <p className="text-xs text-gray-400">{doc.type} · {doc.size} · {doc.date}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 text-xs" disabled>
                        Download
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                  <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">File uploads coming soon</p>
                  <p className="text-xs text-gray-400 mt-1">You'll be able to attach proposals, contracts, and other documents directly to this client profile.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Link Existing Booking Dialog */}
      <Dialog open={showLinkBooking} onOpenChange={setShowLinkBooking}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Link Existing Booking</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500 -mt-2">Find a booking and open it in the CRM to update its client name.</p>
          <Input
            placeholder="Search by booking name or client name..."
            value={bookingSearch}
            onChange={e => setBookingSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
            {allBookings
              .filter(b => {
                const q = bookingSearch.toLowerCase();
                return !q || b.booking_name?.toLowerCase().includes(q) || b.client_name?.toLowerCase().includes(q);
              })
              .slice(0, 30)
              .map(b => (
                <button
                  key={b.id}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    setShowLinkBooking(false);
                    window.location.href = createPageUrl('CRM') + `?edit=${b.id}`;
                  }}
                >
                  <p className="text-sm font-medium text-gray-800">{b.booking_name || b.client_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.client_name} · {b.arrival_date} → {b.departure_date} · {b.status}</p>
                </button>
              ))
            }
            {allBookings.filter(b => {
              const q = bookingSearch.toLowerCase();
              return !q || b.booking_name?.toLowerCase().includes(q) || b.client_name?.toLowerCase().includes(q);
            }).length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No bookings found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Edit Client</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); updateClientMutation.mutate(editFormData); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Company Name *</Label><Input value={editFormData.company_name || ''} onChange={(e) => setEditFormData({ ...editFormData, company_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Contact Person</Label><Input value={editFormData.contact_person || ''} onChange={(e) => setEditFormData({ ...editFormData, contact_person: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={editFormData.email || ''} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={editFormData.phone || ''} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Industry</Label><Input value={editFormData.industry || ''} onChange={(e) => setEditFormData({ ...editFormData, industry: e.target.value })} /></div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editFormData.status || ''} onValueChange={(val) => setEditFormData({ ...editFormData, status: val })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['new_lead','reached_out','solicitation_call','sent_proposal','follow_up','prospect','tentative','definite','active','inactive','vip','lost'].map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={editFormData.address || ''} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={editFormData.notes || ''} onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })} rows={3} /></div>
            <Button type="submit" className="w-full" disabled={updateClientMutation.isPending}>{updateClientMutation.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createContactMutation.mutate(contactForm); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>First Name *</Label><Input value={contactForm.first_name} onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label>Last Name</Label><Input value={contactForm.last_name} onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })} /></div>
              <div className="space-y-2"><Label>Title</Label><Input value={contactForm.title} onChange={(e) => setContactForm({ ...contactForm, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div>
            </div>
            <Button type="submit" className="w-full" disabled={createContactMutation.isPending}>{createContactMutation.isPending ? 'Adding...' : 'Add Contact'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={showAddNote} onOpenChange={setShowAddNote}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createNoteMutation.mutate(noteForm); }} className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={noteForm.title} onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })} required /></div>
            <div className="space-y-2"><Label>Content *</Label><Textarea value={noteForm.content} onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })} rows={4} required /></div>
            <Button type="submit" className="w-full" disabled={createNoteMutation.isPending}>{createNoteMutation.isPending ? 'Saving...' : 'Save Note'}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}