import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';
import { format, parseISO, startOfMonth, eachMonthOfInterval, min, max } from 'date-fns';

export default function RevenueTrendChart({ data }) {
  const chartData = useMemo(() => {
    if (!data.length) return [];

    const dates = data.map(i => parseISO(i.activity_date || i.arrival_date)).filter(Boolean);
    if (!dates.length) return [];

    const minDate = startOfMonth(min(dates));
    const maxDate = startOfMonth(max(dates));

    const months = eachMonthOfInterval({ start: minDate, end: maxDate });

    return months.map(month => {
      const key = format(month, 'yyyy-MM');
      const monthItems = data.filter(i => {
        const d = i.activity_date || i.arrival_date;
        return d && d.startsWith(key);
      });

      const definite = monthItems.filter(i => ['definite', 'actual'].includes(i.status))
        .reduce((s, i) => s + (i.revenue || 0), 0);
      const tentative = monthItems.filter(i => i.status === 'tentative')
        .reduce((s, i) => s + (i.revenue || 0), 0);
      const prospect = monthItems.filter(i => i.status === 'prospect')
        .reduce((s, i) => s + (i.revenue || 0), 0);

      return {
        month: format(month, 'MMM yy'),
        Definite: Math.round(definite),
        Tentative: Math.round(tentative),
        Prospect: Math.round(prospect),
      };
    });
  }, [data]);

  const fmt = (v) => v >= 1000000
    ? `$${(v / 1000000).toFixed(1)}M`
    : v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue Trend by Month
        </CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colDefinite" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colTentative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#eab308" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colProspect" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tickFormatter={fmt} tick={{ fill: '#94a3b8', fontSize: 11 }} width={55} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
                formatter={(v, name) => [fmt(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Area type="monotone" dataKey="Definite" stroke="#22c55e" fill="url(#colDefinite)" strokeWidth={2} />
              <Area type="monotone" dataKey="Tentative" stroke="#eab308" fill="url(#colTentative)" strokeWidth={2} />
              <Area type="monotone" dataKey="Prospect" stroke="#3b82f6" fill="url(#colProspect)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}