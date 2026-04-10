import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Building2, TrendingUp, BedDouble, DollarSign } from "lucide-react";

const STATUS_COLORS = {
  new_lead: 'bg-blue-100 text-blue-800',
  reached_out: 'bg-cyan-100 text-cyan-800',
  solicitation_call: 'bg-indigo-100 text-indigo-800',
  sent_proposal: 'bg-purple-100 text-purple-800',
  follow_up: 'bg-pink-100 text-pink-800',
  prospect: 'bg-yellow-100 text-yellow-800',
  tentative: 'bg-orange-100 text-orange-800',
  definite: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  vip: 'bg-purple-100 text-purple-800',
  lost: 'bg-red-100 text-red-800',
};

export default function ClientProfileHeader({ client, deals = [] }) {
  const totalRevenue = deals.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalRoomNights = deals.reduce((s, d) => s + (d.room_nights || 0), 0);
  const activeDeals = deals.filter(d => ['prospect', 'tentative', 'definite'].includes(d.status)).length;

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-6">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="w-14 h-14 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
            <Building2 className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{client.company_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge className={STATUS_COLORS[client.status]}>{client.status?.replace(/_/g, ' ')}</Badge>
              {client.industry && <Badge variant="outline" className="border-slate-600 text-slate-300">{client.industry}</Badge>}
              {client.activity_type && <Badge variant="outline" className="border-slate-600 text-slate-400">{client.activity_type?.replace(/_/g, ' ')}</Badge>}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-blue-400">{deals.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Total Deals</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-amber-400">{totalRoomNights.toLocaleString()}</p>
            <p className="text-xs text-slate-400 mt-0.5">Room Nights</p>
          </div>
          <div className="bg-slate-900/50 rounded-lg p-3 text-center">
            <p className="text-xl font-bold text-green-400">${(totalRevenue / 1000).toFixed(0)}k</p>
            <p className="text-xs text-slate-400 mt-0.5">Total Revenue</p>
          </div>
        </div>
      </div>
    </div>
  );
}