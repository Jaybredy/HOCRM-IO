import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { differenceInDays } from 'date-fns';

export default function StaleLeadsAlert({ data, onEdit }) {
  const [expanded, setExpanded] = useState(false);

  const staleLeads = data.filter(item => {
    if (['lost', 'actual'].includes(item.status)) return false;
    const lastUpdate = item.updated_date || item.created_date;
    if (!lastUpdate) return false;
    return differenceInDays(new Date(), new Date(lastUpdate)) >= 7;
  });

  if (staleLeads.length === 0) return null;

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orange-500/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Clock className="w-4 h-4 text-orange-400 shrink-0" />
        <span className="text-orange-300 text-sm font-medium flex-1">
          <strong>{staleLeads.length}</strong> lead{staleLeads.length > 1 ? 's have' : ' has'} not been updated in 7+ days — follow up!
        </span>
        {expanded ? <ChevronUp className="w-4 h-4 text-orange-400" /> : <ChevronDown className="w-4 h-4 text-orange-400" />}
      </button>
      {expanded && (
        <div className="border-t border-orange-500/20 px-4 py-3 space-y-2">
          {staleLeads.slice(0, 8).map(item => {
            const days = differenceInDays(new Date(), new Date(item.updated_date || item.created_date));
            return (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="text-white font-medium">{item.client_name}</span>
                  <span className="text-slate-400 ml-2 text-xs capitalize">({item.status})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-orange-400 text-xs">{days} days ago</span>
                  <button onClick={() => onEdit(item)} className="text-blue-400 hover:text-blue-300 text-xs underline">Follow up</button>
                </div>
              </div>
            );
          })}
          {staleLeads.length > 8 && (
            <p className="text-slate-400 text-xs">...and {staleLeads.length - 8} more</p>
          )}
        </div>
      )}
    </div>
  );
}