import React, { useState } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Edit, Hotel, FileText, Building2,
  User, Mail, Phone, MapPin, Tag, Plus, Pin, Trash2,
  BedDouble, Calendar, MessageSquare, CheckCircle2, AlertCircle
} from "lucide-react";

// ── Sample data ──────────────────────────────────────────────────────────────
const CLIENT = {
  company_name: "Acme Corporation",
  status: "definite",
  industry: "Technology",
  activity_type: "corporate",
  contact_person: "Jane Smith",
  email: "jane.smith@acme.com",
  phone: "+1 (212) 555-0198",
  address: "350 5th Ave, New York, NY 10118",
  notes: "Long-term corporate account. Prefers suite-level rooms and AV packages.",
};

const DEALS = [
  { id: 1, status: "definite", hotel: "Grand Hyatt NYC", arrival: "Mar 10, 2026", departure: "Mar 14, 2026", nights: 48, revenue: 62400, seller: "M. Torres", event_type: "corporate" },
  { id: 2, status: "tentative", hotel: "Park Regency", arrival: "Jun 5, 2026", departure: "Jun 8, 2026", nights: 30, revenue: 39000, seller: "A. Patel", event_type: "group" },
  { id: 3, status: "actual", hotel: "Grand Hyatt NYC", arrival: "Nov 20, 2025", departure: "Nov 23, 2025", nights: 36, revenue: 44100, seller: "M. Torres", event_type: "corporate" },
];

const ACTIVITIES = [
  { id: 1, status: "definite", date: "Feb 18, 2026", seller: "M. Torres", notes: "Contract signed for March group booking. Confirmed 48 rooms at $1,300/night." },
  { id: 2, status: "sent_proposal", date: "Feb 10, 2026", seller: "M. Torres", notes: "Sent detailed proposal for spring retreat including AV and catering packages." },
  { id: 3, status: "solicitation_call", date: "Jan 28, 2026", seller: "A. Patel", notes: "Initial discovery call. Interested in Q2 block for 30–50 rooms." },
];

const CONTACTS = [
  { id: 1, name: "Jane Smith", title: "VP of Operations", email: "jane.smith@acme.com", phone: "+1 212 555-0198", primary: true },
  { id: 2, name: "Robert Chen", title: "Travel Coordinator", email: "r.chen@acme.com", phone: "+1 212 555-0172", primary: false },
];

const NOTES = [
  { id: 1, title: "Preferred Room Type", content: "Always request corner suites on floors 20+. Jane is adamant about quiet floors.", pinned: true, date: "Feb 5", author: "m.torres@epic.com" },
  { id: 2, title: "Billing Contact", content: "All invoices go to accounts@acme.com — do not send to Jane directly.", pinned: false, date: "Jan 14", author: "a.patel@epic.com" },
];

// ── Status colours ────────────────────────────────────────────────────────────
const CLIENT_STATUS_COLORS = {
  definite: 'bg-green-100 text-green-800',
  tentative: 'bg-orange-100 text-orange-800',
  prospect: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
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

const ACTIVITY_META = {
  solicitation_call: { color: 'text-blue-400', badge: 'bg-blue-100 text-blue-800' },
  sent_proposal:     { color: 'text-purple-400', badge: 'bg-purple-100 text-purple-800' },
  follow_up:         { color: 'text-yellow-400', badge: 'bg-yellow-100 text-yellow-800' },
  tentative:         { color: 'text-orange-400', badge: 'bg-orange-100 text-orange-800' },
  definite:          { color: 'text-green-400',  badge: 'bg-green-100 text-green-800' },
};

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ClientProfileMock() {
  const totalRevenue = DEALS.reduce((s, d) => s + d.revenue, 0);
  const totalNights  = DEALS.reduce((s, d) => s + d.nights, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Mock notice */}
        <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg px-4 py-2 text-amber-300 text-sm font-medium text-center">
          ⚠️ This is a static mock — all data is sample / placeholder
        </div>

        {/* Top nav */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link to={createPageUrl('Clients')}>
            <Button variant="ghost" className="text-slate-400 hover:text-white gap-2 pl-0">
              <ArrowLeft className="w-4 h-4" /> Back to Clients
            </Button>
          </Link>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="text-blue-400 border-blue-500/40 hover:bg-blue-500/10">
              <Hotel className="w-3.5 h-3.5 mr-1.5" /> Add Booking
            </Button>
            <Button variant="outline" size="sm" className="text-purple-400 border-purple-500/40 hover:bg-purple-500/10">
              <FileText className="w-3.5 h-3.5 mr-1.5" /> Add RFP
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500">
              <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Client
            </Button>
          </div>
        </div>

        {/* ── Header ── */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-14 h-14 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">{CLIENT.company_name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={CLIENT_STATUS_COLORS[CLIENT.status]}>{CLIENT.status}</Badge>
                  <Badge variant="outline" className="border-slate-600 text-slate-300">{CLIENT.industry}</Badge>
                  <Badge variant="outline" className="border-slate-600 text-slate-400">{CLIENT.activity_type}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-400">{DEALS.length}</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Deals</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-amber-400">{totalNights}</p>
                <p className="text-xs text-slate-400 mt-0.5">Room Nights</p>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-400">${(totalRevenue / 1000).toFixed(0)}k</p>
                <p className="text-xs text-slate-400 mt-0.5">Total Revenue</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column */}
          <div className="space-y-6">

            {/* Contact Info */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Contact Info</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white"><Edit className="w-3.5 h-3.5" /></Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { icon: User,   label: "Contact Person", value: CLIENT.contact_person },
                  { icon: Mail,   label: "Email",           value: CLIENT.email },
                  { icon: Phone,  label: "Phone",           value: CLIENT.phone },
                  { icon: MapPin, label: "Address",         value: CLIENT.address },
                  { icon: Tag,    label: "Industry",        value: CLIENT.industry },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-3 text-sm">
                    <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className="text-slate-200">{value}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-slate-700">
                  <p className="text-xs text-slate-500 mb-1">Notes</p>
                  <p className="text-sm text-slate-300 leading-relaxed">{CLIENT.notes}</p>
                </div>
              </CardContent>
            </Card>

            {/* Contacts List */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Contacts ({CONTACTS.length})</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white"><Plus className="w-3.5 h-3.5" /></Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {CONTACTS.map(c => (
                  <div key={c.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm font-medium text-white">{c.name}</span>
                        {c.primary && <Badge className="bg-amber-100 text-amber-800 text-xs py-0">Primary</Badge>}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    <p className="text-xs text-slate-400 pl-5">{c.title}</p>
                    <div className="flex items-center gap-1.5 pl-5"><Mail className="w-3 h-3 text-slate-500" /><span className="text-xs text-slate-300">{c.email}</span></div>
                    <div className="flex items-center gap-1.5 pl-5"><Phone className="w-3 h-3 text-slate-500" /><span className="text-xs text-slate-300">{c.phone}</span></div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Deals Table */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Booking History & Deals ({DEALS.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {DEALS.map(deal => (
                  <div key={deal.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={DEAL_STATUS_COLORS[deal.status]}>{deal.status}</Badge>
                          <span className="text-xs text-slate-400">{deal.hotel}</span>
                          <span className="text-xs text-slate-500 capitalize">{deal.event_type}</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <Calendar className="w-3 h-3" />{deal.arrival} → {deal.departure}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            <BedDouble className="w-3 h-3" />{deal.nights} nights
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-green-400">${deal.revenue.toLocaleString()}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{deal.seller}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Activity Timeline */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Communication Log ({ACTIVITIES.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {ACTIVITIES.map((act, idx) => {
                    const meta = ACTIVITY_META[act.status] || { color: 'text-slate-400', badge: 'bg-slate-100 text-slate-700' };
                    return (
                      <div key={act.id} className="flex gap-3 pb-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-7 h-7 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shrink-0`}>
                            <MessageSquare className={`w-3 h-3 ${meta.color}`} />
                          </div>
                          {idx < ACTIVITIES.length - 1 && <div className="w-px flex-1 bg-slate-700 mt-1" />}
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={`text-xs ${meta.badge}`}>{act.status.replace(/_/g, ' ')}</Badge>
                            <span className="text-xs text-slate-500">{act.date}</span>
                            <span className="text-xs text-slate-500">· {act.seller}</span>
                          </div>
                          <p className="text-sm text-slate-300 mt-1 leading-relaxed">{act.notes}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Notes ({NOTES.length})</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white"><Plus className="w-3.5 h-3.5" /></Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {NOTES.map(note => (
                  <div key={note.id} className={`rounded-lg p-3 border ${note.pinned ? 'bg-amber-900/20 border-amber-700/40' : 'bg-slate-900/50 border-slate-700'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {note.pinned && <Pin className="w-3 h-3 text-amber-400" />}
                        <span className="text-sm font-medium text-white">{note.title}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">{note.date}</span>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-300 mt-1 leading-relaxed">{note.content}</p>
                    <p className="text-xs text-slate-500 mt-1">by {note.author}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}