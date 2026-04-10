import React from 'react';
import { format, parseISO } from 'date-fns';
import { X, Building2, Mail, Phone, MapPin, Tag, Calendar, DollarSign, FileText, Hotel, Edit } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import NextActionBadge from "./NextActionBadge";

const STATUS_COLORS = {
  new_lead: 'bg-blue-100 text-blue-800 border-blue-300',
  reached_out: 'bg-cyan-100 text-cyan-800 border-cyan-300',
  solicitation_call: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  sent_proposal: 'bg-purple-100 text-purple-800 border-purple-300',
  follow_up: 'bg-pink-100 text-pink-800 border-pink-300',
  prospect: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  tentative: 'bg-orange-100 text-orange-800 border-orange-300',
  definite: 'bg-green-100 text-green-800 border-green-300',
  active: 'bg-green-100 text-green-800 border-green-300',
  inactive: 'bg-gray-100 text-gray-800 border-gray-300',
  vip: 'bg-purple-100 text-purple-800 border-purple-300',
  lost: 'bg-red-100 text-red-800 border-red-300',
};

function InfoRow({ icon: Icon, label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <span className="text-slate-400 text-xs">{label}</span>
        <p className="text-slate-200">{value}</p>
      </div>
    </div>
  );
}

export default function ClientDetailDrawer({ client, onClose, onEdit, activities = [] }) {
  if (!client) return null;

  const totalRooms = client.daily_rooms
    ? Object.values(client.daily_rooms).reduce((s, r) => s + (r || 0), 0)
    : 0;
  const revenue = totalRooms * (client.rate_offered || 0);

  const clientActivities = activities
    .filter(a => a.client_name?.toLowerCase() === client.company_name?.toLowerCase())
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-slate-900 border-l border-slate-700 h-full overflow-y-auto flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-700 bg-slate-800 sticky top-0 z-10">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-lg font-bold text-white truncate">{client.company_name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={`text-xs ${STATUS_COLORS[client.status]}`}>
                {client.status?.replace(/_/g, ' ')}
              </Badge>
              <NextActionBadge status={client.status} />
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={() => { onClose(); onEdit(client); }}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-6 flex-1">
          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</h3>
            <InfoRow icon={Building2} label="Contact Person" value={client.contact_person} />
            <InfoRow icon={Mail} label="Email" value={client.email} />
            <InfoRow icon={Phone} label="Phone" value={client.phone} />
            <InfoRow icon={MapPin} label="Address" value={client.address} />
            <InfoRow icon={Tag} label="Industry" value={client.industry} />
          </div>

          {/* Booking Info */}
          {(client.arrival_date || totalRooms > 0) && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Booking Details</h3>
              {client.arrival_date && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-xs">Arrival</span>
                    <p className="text-slate-200">{format(parseISO(client.arrival_date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              )}
              {client.departure_date && (
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-slate-400 text-xs">Departure</span>
                    <p className="text-slate-200">{format(parseISO(client.departure_date), 'MMM d, yyyy')}</p>
                  </div>
                </div>
              )}
              {totalRooms > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-blue-400">{totalRooms}</p>
                    <p className="text-xs text-slate-400">Room Nights</p>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-green-400">${revenue.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">Potential Revenue</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {client.notes && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</h3>
              <p className="text-sm text-slate-300 bg-slate-800 rounded-lg p-3 leading-relaxed">{client.notes}</p>
            </div>
          )}

          {/* Activity History */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Activity History</h3>
            {clientActivities.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No activities logged yet.</p>
            ) : (
              <div className="space-y-2">
                {clientActivities.map(a => (
                  <div key={a.id} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                      <Badge className={`text-xs ${STATUS_COLORS[a.status]}`}>{a.status?.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-slate-500">{a.activity_date ? format(parseISO(a.activity_date), 'MMM d, yyyy') : ''}</span>
                    </div>
                    {a.notes && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{a.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Quick Actions */}
        <div className="p-4 border-t border-slate-700 bg-slate-800 sticky bottom-0">
          <div className="flex gap-2">
            <Link to={createPageUrl('CRM') + `?account=${encodeURIComponent(client.company_name)}#add-production`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-blue-400 border-blue-500/40 hover:bg-blue-500/10">
                <Hotel className="w-3.5 h-3.5 mr-1.5" /> Add Booking
              </Button>
            </Link>
            <Link to={createPageUrl('RFPs') + `?company=${encodeURIComponent(client.company_name)}#add-rfp`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full text-purple-400 border-purple-500/40 hover:bg-purple-500/10">
                <FileText className="w-3.5 h-3.5 mr-1.5" /> Add RFP
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}