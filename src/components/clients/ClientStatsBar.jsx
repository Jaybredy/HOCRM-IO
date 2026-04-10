import React from 'react';

export default function ClientStatsBar({ clients }) {
  const total = clients.length;
  const byStatus = {
    new_lead: clients.filter(c => c.status === 'new_lead').length,
    prospect: clients.filter(c => ['prospect', 'solicitation_call', 'sent_proposal', 'follow_up', 'reached_out'].includes(c.status)).length,
    tentative: clients.filter(c => c.status === 'tentative').length,
    definite: clients.filter(c => c.status === 'definite').length,
    lost: clients.filter(c => c.status === 'lost').length,
  };

  const totalRevenue = clients.reduce((sum, c) => {
    if (!c.daily_rooms || !c.rate_offered) return sum;
    const rooms = Object.values(c.daily_rooms).reduce((s, r) => s + (r || 0), 0);
    return sum + rooms * (c.rate_offered || 0);
  }, 0);

  const stats = [
    { label: 'Total Clients', value: total, color: 'text-slate-200' },
    { label: 'New Leads', value: byStatus.new_lead, color: 'text-blue-400' },
    { label: 'In Pipeline', value: byStatus.prospect, color: 'text-yellow-400' },
    { label: 'Tentative', value: byStatus.tentative, color: 'text-orange-400' },
    { label: 'Definite', value: byStatus.definite, color: 'text-green-400' },
    { label: 'Lost', value: byStatus.lost, color: 'text-red-400' },
    {
      label: 'Pipeline Value',
      value: totalRevenue >= 1000000
        ? `$${(totalRevenue / 1000000).toFixed(1)}M`
        : `$${(totalRevenue / 1000).toFixed(0)}K`,
      color: 'text-purple-400'
    },
  ];

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-4 py-3 flex flex-wrap gap-x-6 gap-y-2">
      {stats.map(s => (
        <div key={s.label} className="flex items-center gap-2">
          <span className={`text-lg font-bold ${s.color}`}>{s.value}</span>
          <span className="text-xs text-slate-400">{s.label}</span>
        </div>
      ))}
    </div>
  );
}