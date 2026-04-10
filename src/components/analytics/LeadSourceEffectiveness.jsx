import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = {
  corporate: '#4e6d8c',
  wedding: '#7a4e6a',
  convention: '#5a4e7a',
  group: '#3d7a6a',
  leisure: '#7a6a3d',
  other: '#4a5568',
};

export default function LeadSourceEffectiveness({ production }) {
  // Group by event_type as lead source
  const sourceMap = {};
  production.filter(p => !p.is_deleted).forEach(p => {
    const src = p.event_type || 'other';
    if (!sourceMap[src]) sourceMap[src] = { total: 0, won: 0, revenue: 0 };
    sourceMap[src].total++;
    if (['definite', 'actual'].includes(p.status)) {
      sourceMap[src].won++;
      sourceMap[src].revenue += p.revenue || 0;
    }
  });

  const data = Object.entries(sourceMap).map(([key, val]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1).replace('_', ' '),
    key,
    total: val.total,
    won: val.won,
    revenue: val.revenue,
    convRate: val.total > 0 ? Math.round((val.won / val.total) * 100) : 0,
  })).sort((a, b) => b.revenue - a.revenue);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs">
        <p className="font-semibold text-white mb-1">{d.name}</p>
        <p className="text-slate-300">Total Leads: {d.total}</p>
        <p className="text-green-400">Won: {d.won} ({d.convRate}%)</p>
        <p className="text-blue-400">Revenue: ${d.revenue?.toLocaleString()}</p>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-100 mb-1">Lead Source Effectiveness</h3>
      <p className="text-xs text-slate-400 mb-4">Conversion rate & revenue by event type</p>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data available</div>
      ) : (
        <div className="flex gap-4 items-center">
          <ResponsiveContainer width="45%" height={200}>
            <PieChart>
              <Pie data={data} dataKey="total" cx="50%" cy="50%" outerRadius={80} innerRadius={45}>
                {data.map((d, i) => <Cell key={i} fill={COLORS[d.key] || '#64748b'} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {data.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[d.key] || '#64748b' }} />
                  <span className="text-slate-300">{d.name}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-slate-400">{d.total} leads</span>
                  <span className={`font-semibold w-10 text-right ${d.convRate >= 50 ? 'text-green-400' : d.convRate >= 25 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {d.convRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}