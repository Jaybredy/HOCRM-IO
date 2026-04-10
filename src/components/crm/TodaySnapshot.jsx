import React from 'react';
import { differenceInDays, startOfMonth, startOfYear } from 'date-fns';

const fmt = (val) => val >= 1000000 ? `$${(val/1000000).toFixed(1)}M` : `$${(val/1000).toFixed(0)}K`;

export default function TodaySnapshot({ data, onDrillDown }) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Exclude actual_pickup records to avoid double-counting with their parent definite records
  const cleanData = data.filter(i => i.record_type !== 'actual_pickup');

  const newToday = cleanData.filter(i => i.created_date?.startsWith(todayStr)).length;

  // MTD metrics use the already-filtered data (respects all current filters)
  const mtdDefiniteCount = cleanData.filter(i => (i.record_type || i.status) === 'definite').length;
  const mtdDefiniteRev   = cleanData.filter(i => (i.record_type || i.status) === 'definite').reduce((s, i) => s + (i.revenue || 0), 0);
  const mtdTentativeCount = cleanData.filter(i => (i.record_type || i.status) === 'tentative').length;
  const mtdTentativeRev   = cleanData.filter(i => (i.record_type || i.status) === 'tentative').reduce((s, i) => s + (i.revenue || 0), 0);
  const mtdProspectCount  = cleanData.filter(i => (i.record_type || i.status) === 'prospect').length;
  const mtdProspectRev    = cleanData.filter(i => (i.record_type || i.status) === 'prospect').reduce((s, i) => s + (i.revenue || 0), 0);

  const upcomingArrivals = cleanData.filter(i => {
    if (!i.arrival_date) return false;
    const diff = differenceInDays(new Date(i.arrival_date), today);
    return diff >= 0 && diff <= 30 && ['definite', 'actual'].includes(i.record_type || i.status);
  }).length;

  const StatItem = ({ value, label, color = 'text-slate-100', sub, onClick }) => {
    const content = (
      <>
        <span className={`text-xl font-bold leading-tight ${color}`}>{value}</span>
        <span className="text-xs text-slate-400 font-medium leading-tight">{label}</span>
        {sub && <span className="text-xs text-slate-300 font-medium">{sub}</span>}
      </>
    );
    
    if (onClick) {
      return (
        <button
          onClick={onClick}
          className="flex flex-col min-w-0 hover:opacity-80 transition-opacity cursor-pointer text-left"
        >
          {content}
        </button>
      );
    }
    
    return <div className="flex flex-col min-w-0">{content}</div>;
  };

  const Divider = () => <div className="w-px h-10 bg-slate-700 self-center" />;

  return (
    <div className="bg-gradient-to-r from-slate-800/90 via-slate-800/70 to-slate-800/90 border border-slate-600/70 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-x-6 gap-y-3 shadow-md ring-1 ring-white/5">
      <div className="flex flex-col min-w-fit">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">MTD</span>
        <span className="text-[10px] text-slate-300 leading-tight">by arrival date</span>
      </div>

      <StatItem value={newToday} label="Added Today" color="text-blue-300" />
      <Divider />
      <div className="flex items-center gap-4">
        <StatItem 
          value={mtdDefiniteCount} 
          label="Definites" 
          color="text-green-400" 
          sub={fmt(mtdDefiniteRev)}
          onClick={() => onDrillDown?.(cleanData.filter(i => (i.record_type || i.status) === 'definite'))}
        />
        <StatItem 
          value={mtdTentativeCount} 
          label="Tentatives" 
          color="text-yellow-400" 
          sub={fmt(mtdTentativeRev)}
          onClick={() => onDrillDown?.(cleanData.filter(i => (i.record_type || i.status) === 'tentative'))}
        />
        <StatItem 
          value={mtdProspectCount} 
          label="Prospects" 
          color="text-orange-400" 
          sub={fmt(mtdProspectRev)}
          onClick={() => onDrillDown?.(cleanData.filter(i => (i.record_type || i.status) === 'prospect'))}
        />
      </div>
      <Divider />
      <StatItem value={upcomingArrivals} label="Arrivals (30d)" color="text-cyan-400" />
    </div>
  );
}