import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, TrendingUp } from 'lucide-react';
import { parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

export default function ConversionFunnel({ production = [], dateRange = {} }) {
  if (!production || production.length === 0) {
    return (
      <Card className="bg-slate-800 border border-slate-700 rounded-xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            On the Books — by Arrival Date
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8 text-slate-400">No data available</CardContent>
      </Card>
    );
  }
  // Exclude actual_pickup to avoid double-counting
  const cleanProduction = production.filter(p => p.record_type !== 'actual_pickup');
  const byStatus = (status) => cleanProduction.filter(p => p.status === status);

  const prospectItems  = byStatus('prospect');
  const tentativeItems = byStatus('tentative');
  const definiteItems  = byStatus('definite');
  const total = prospectItems.length + tentativeItems.length + definiteItems.length;

  const sum = (items, field) => items.reduce((s, p) => s + (p[field] || 0), 0);

  const stages = [
    {
      label: 'Prospect',
      count: prospectItems.length,
      revenue: sum(prospectItems, 'revenue'),
      roomNights: sum(prospectItems, 'room_nights'),
      pct: total > 0 ? Math.round((prospectItems.length / total) * 100) : 0,
      color: 'bg-teal-500',
      textColor: 'text-slate-200',
      subColor: 'text-slate-400',
      bgCard: 'bg-slate-700/50 border-slate-600/40',
    },
    {
      label: 'Tentative',
      count: tentativeItems.length,
      revenue: sum(tentativeItems, 'revenue'),
      roomNights: sum(tentativeItems, 'room_nights'),
      pct: total > 0 ? Math.round((tentativeItems.length / total) * 100) : 0,
      color: 'bg-orange-500',
      textColor: 'text-orange-200',
      subColor: 'text-orange-400/70',
      bgCard: 'bg-slate-700/50 border-slate-600/40',
    },
    {
      label: 'Definite',
      count: definiteItems.length,
      revenue: sum(definiteItems, 'revenue'),
      roomNights: sum(definiteItems, 'room_nights'),
      pct: total > 0 ? Math.round((definiteItems.length / total) * 100) : 0,
      color: 'bg-gray-500',
      textColor: 'text-gray-200',
      subColor: 'text-gray-400/70',
      bgCard: 'bg-slate-700/50 border-slate-600/40',
    },
  ];

  const confidenceScore = total > 0 ? Math.round((definiteItems.length / total) * 100) : 0;

  // Month to Date Booked (Definite with arrival within selected date range)
  const filterStart = dateRange.start ? parseISO(dateRange.start) : startOfMonth(new Date());
  const filterEnd = dateRange.end ? parseISO(dateRange.end) : endOfMonth(new Date());
  const mtdBookedItems = definiteItems.filter(item => {
    if (!item.arrival_date) return false;
    try {
      const arrivalDate = parseISO(item.arrival_date);
      return isWithinInterval(arrivalDate, { start: filterStart, end: filterEnd });
    } catch {
      return false;
    }
  });
  const mtdRevenue = sum(mtdBookedItems, 'revenue');
  const mtdRoomNights = sum(mtdBookedItems, 'room_nights');

  const fmt = (n) => n >= 1000000
    ? `$${(n / 1000000).toFixed(1)}M`
    : n >= 1000
    ? `$${(n / 1000).toFixed(0)}K`
    : `$${n}`;

  const fmtRN = (n) => n >= 1000 ? `${(n / 1000).toFixed(1)}K RNs` : `${n} RNs`;

  return (
    <Card className="bg-slate-800 border border-slate-700 rounded-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          On the Books — by Arrival Date
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Stacked Bar */}
        <div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {stages.map(s => (
              <div
                key={s.label}
                className={`${s.color} transition-all`}
                style={{ width: `${s.pct}%`, minWidth: s.pct > 0 ? '4px' : '0' }}
                title={`${s.label}: ${s.pct}%`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {stages.map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${s.color}`} />
                <span className="text-sm text-white font-semibold">{s.label} {s.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Confidence */}
        <div className="text-center p-4 bg-slate-800 rounded border border-slate-700">
          <div className="text-4xl font-bold text-cyan-400">{confidenceScore}%</div>
          <div className="text-sm font-semibold text-white mt-1">Pipeline Confidence</div>
        </div>

        {/* Month to Date Booked */}
        <div className="p-4 bg-slate-700/40 rounded border border-slate-600 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <div className="text-sm font-semibold text-white">Month to Date Booked (Definite)</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{fmt(mtdRevenue)}</div>
              <div className="text-xs text-slate-400 mt-1">Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{mtdRoomNights.toLocaleString()}</div>
              <div className="text-xs text-slate-400 mt-1">Room Nights</div>
            </div>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}