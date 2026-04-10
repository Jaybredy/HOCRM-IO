import React from 'react';
import { AlertTriangle, TrendingDown, CheckCircle2, Clock } from 'lucide-react';

function getRiskLevel(item) {
  const now = new Date();
  const arrival = item.arrival_date ? new Date(item.arrival_date) : null;
  const activity = item.activity_date ? new Date(item.activity_date) : null;
  const daysSinceActivity = activity ? Math.floor((now - activity) / (1000 * 60 * 60 * 24)) : 999;
  const daysToArrival = arrival ? Math.floor((arrival - now) / (1000 * 60 * 60 * 24)) : 999;

  if (item.status === 'lost') return null;
  if (!['prospect', 'tentative', 'definite'].includes(item.status)) return null;

  let riskScore = 0;
  if (daysSinceActivity > 30) riskScore += 3;
  else if (daysSinceActivity > 14) riskScore += 2;
  else if (daysSinceActivity > 7) riskScore += 1;

  if (item.status === 'prospect' && daysSinceActivity > 14) riskScore += 2;
  if (item.status === 'tentative' && daysToArrival < 30 && item.status !== 'definite') riskScore += 2;
  if (item.cutoff_date) {
    const daysToCtoff = Math.floor((new Date(item.cutoff_date) - now) / (1000 * 60 * 60 * 24));
    if (daysToCtoff < 0) riskScore += 3;
    else if (daysToCtoff < 7) riskScore += 2;
  }

  if (riskScore >= 5) return 'high';
  if (riskScore >= 3) return 'medium';
  if (riskScore >= 1) return 'low';
  return null;
}

const RISK_CONFIG = {
  high: { label: 'High Risk', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: AlertTriangle },
  medium: { label: 'Medium Risk', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: Clock },
  low: { label: 'Low Risk', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', icon: TrendingDown },
};

export default function ChurnPrediction({ production }) {
  const activeDeals = production.filter(p => !p.is_deleted && ['prospect', 'tentative', 'definite'].includes(p.status));
  const lostRate = production.length > 0
    ? Math.round((production.filter(p => p.status === 'lost').length / production.length) * 100)
    : 0;

  const atRisk = activeDeals
    .map(item => ({ item, risk: getRiskLevel(item) }))
    .filter(r => r.risk !== null)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.risk] - order[b.risk];
    });

  const highCount = atRisk.filter(r => r.risk === 'high').length;
  const medCount = atRisk.filter(r => r.risk === 'medium').length;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-100 mb-1">Churn Risk Analysis</h3>
      <p className="text-xs text-slate-400 mb-4">Deals at risk based on inactivity, cutoff dates & stage duration</p>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-red-400">{highCount}</div>
          <div className="text-xs text-slate-400">High Risk</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-yellow-400">{medCount}</div>
          <div className="text-xs text-slate-400">Medium Risk</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-slate-300">{lostRate}%</div>
          <div className="text-xs text-slate-400">Historical Loss Rate</div>
        </div>
      </div>

      {/* At-risk deals list */}
      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
        {atRisk.length === 0 ? (
          <div className="flex items-center gap-2 text-green-400 text-sm py-4 justify-center">
            <CheckCircle2 className="w-4 h-4" />
            No deals flagged as at-risk
          </div>
        ) : (
          atRisk.slice(0, 8).map(({ item, risk }) => {
            const cfg = RISK_CONFIG[risk];
            const Icon = cfg.icon;
            const daysSince = item.activity_date
              ? Math.floor((new Date() - new Date(item.activity_date)) / (1000 * 60 * 60 * 24))
              : null;
            return (
              <div key={item.id} className={`flex items-center justify-between rounded-lg px-3 py-2 border text-xs ${cfg.bg}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${cfg.color}`} />
                  <div className="truncate">
                    <span className="text-slate-200 font-medium">{item.client_name}</span>
                    <span className="text-slate-500 ml-1 capitalize">({item.status})</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  {daysSince !== null && (
                    <span className="text-slate-400">{daysSince}d inactive</span>
                  )}
                  <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}