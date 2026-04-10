import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { differenceInDays, format, parseISO } from 'date-fns';
import { Bell, CalendarDays, AlertTriangle, Clock } from 'lucide-react';

const STATUS_COLORS = {
  prospect:  'bg-blue-500/20 text-blue-300 border-blue-500/40',
  tentative: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  definite:  'bg-green-500/20 text-green-300 border-green-500/40',
};

export default function UpcomingFollowUps({ data, onEdit }) {
  const today = new Date();

  // Upcoming arrivals within 60 days (definite/tentative)
  const upcomingArrivals = data
    .filter(i => {
      if (!i.arrival_date) return false;
      const diff = differenceInDays(parseISO(i.arrival_date), today);
      return diff >= 0 && diff <= 60 && ['definite', 'tentative'].includes(i.status);
    })
    .sort((a, b) => a.arrival_date.localeCompare(b.arrival_date))
    .slice(0, 5);

  // Stale leads: prospect/tentative not updated in 14+ days
  const staleLeads = data
    .filter(i => {
      if (!['prospect', 'tentative'].includes(i.status)) return false;
      const lastUpdate = i.updated_date || i.created_date;
      if (!lastUpdate) return true;
      return differenceInDays(today, new Date(lastUpdate)) >= 14;
    })
    .sort((a, b) => {
      const dA = differenceInDays(today, new Date(a.updated_date || a.created_date || 0));
      const dB = differenceInDays(today, new Date(b.updated_date || b.created_date || 0));
      return dB - dA;
    })
    .slice(0, 5);

  // Cutoff alerts: definite with cutoff within 14 days
  const cutoffAlerts = data
    .filter(i => {
      if (!i.cutoff_date || i.status !== 'definite') return false;
      const diff = differenceInDays(parseISO(i.cutoff_date), today);
      return diff >= 0 && diff <= 14;
    })
    .sort((a, b) => a.cutoff_date.localeCompare(b.cutoff_date))
    .slice(0, 5);

  const Section = ({ title, icon: Icon, color, items, emptyMsg, renderItem }) => (
    <div>
      <div className={`flex items-center gap-2 mb-2 text-sm font-semibold ${color}`}>
        <Icon className="w-4 h-4" /> {title}
        {items.length > 0 && (
          <span className="ml-1 bg-slate-700 text-slate-300 text-xs rounded-full px-1.5 py-0.5">{items.length}</span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500 italic pl-1">{emptyMsg}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map(renderItem)}
        </div>
      )}
    </div>
  );

  return (
    <Card className="bg-slate-800/60 border-slate-700 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" /> Upcoming & Follow-ups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-slate-200">

        <Section
          title="Cutoff Alerts (14 days)"
          icon={AlertTriangle}
          color="text-red-400"
          items={cutoffAlerts}
          emptyMsg="No cutoff alerts"
          renderItem={(item) => {
            const diff = differenceInDays(parseISO(item.cutoff_date), today);
            return (
              <button key={item.id} onClick={() => onEdit?.(item)}
                className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-700/60 transition-colors group">
                <span className="text-xs font-medium truncate text-slate-200 group-hover:text-white">{item.client_name}</span>
                <span className="text-xs text-red-400 font-semibold shrink-0">{diff === 0 ? 'Today' : `${diff}d`}</span>
              </button>
            );
          }}
        />

        <Section
          title="Arriving Soon (60 days)"
          icon={CalendarDays}
          color="text-cyan-400"
          items={upcomingArrivals}
          emptyMsg="No upcoming arrivals"
          renderItem={(item) => {
            const diff = differenceInDays(parseISO(item.arrival_date), today);
            return (
              <button key={item.id} onClick={() => onEdit?.(item)}
                className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-700/60 transition-colors group">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge className={`text-[10px] px-1 py-0 border shrink-0 ${STATUS_COLORS[item.status] || ''}`}>
                    {item.status}
                  </Badge>
                  <span className="text-xs font-medium truncate text-slate-200 group-hover:text-white">{item.client_name}</span>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {diff === 0 ? 'Today' : `in ${diff}d`}
                </span>
              </button>
            );
          }}
        />

        <Section
          title="Stale Leads (14+ days)"
          icon={Clock}
          color="text-amber-400"
          items={staleLeads}
          emptyMsg="No stale leads — great work!"
          renderItem={(item) => {
            const days = differenceInDays(today, new Date(item.updated_date || item.created_date || 0));
            return (
              <button key={item.id} onClick={() => onEdit?.(item)}
                className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-slate-700/60 transition-colors group">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Badge className={`text-[10px] px-1 py-0 border shrink-0 ${STATUS_COLORS[item.status] || ''}`}>
                    {item.status}
                  </Badge>
                  <span className="text-xs font-medium truncate text-slate-200 group-hover:text-white">{item.client_name}</span>
                </div>
                <span className="text-xs text-amber-400 font-medium shrink-0">{days}d ago</span>
              </button>
            );
          }}
        />

      </CardContent>
    </Card>
  );
}