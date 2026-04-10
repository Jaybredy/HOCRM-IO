import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function ForecastAccuracy({ production, budgets }) {
  // Build month-by-month: budget vs pipeline (definite+actual)
  const year = new Date().getFullYear();

  const data = MONTHS.map((month, idx) => {
    const monthNum = idx + 1;
    const budget = budgets
      .filter(b => b.year === year && b.month === monthNum)
      .reduce((s, b) => s + (b.group_budget_revenue || b.budget_revenue || 0), 0);

    const pipeline = production
      .filter(p => {
        if (p.is_deleted) return false;
        if (!['definite', 'actual', 'tentative'].includes(p.status)) return false;
        const d = new Date(p.arrival_date);
        return d.getFullYear() === year && d.getMonth() === idx;
      })
      .reduce((s, p) => s + (p.revenue || 0), 0);

    const actual = production
      .filter(p => {
        if (p.is_deleted) return false;
        if (!['actual', 'definite'].includes(p.status)) return false;
        const d = new Date(p.arrival_date);
        return d.getFullYear() === year && d.getMonth() === idx;
      })
      .reduce((s, p) => s + (p.revenue || 0), 0);

    const accuracy = budget > 0 ? Math.round((actual / budget) * 100) : null;

    return { month, budget, pipeline, actual, accuracy };
  });

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs space-y-1">
        <p className="font-semibold text-white">{label}</p>
        {d.budget > 0 && <p className="text-slate-400">Budget: ${d.budget.toLocaleString()}</p>}
        <p className="text-blue-400">Pipeline: ${d.pipeline.toLocaleString()}</p>
        <p className="text-green-400">Definite/Actual: ${d.actual.toLocaleString()}</p>
        {d.accuracy !== null && d.budget > 0 && (
          <p className={`font-semibold ${d.accuracy >= 90 ? 'text-green-400' : d.accuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            Accuracy: {d.accuracy}%
          </p>
        )}
      </div>
    );
  };

  const hasBudgets = data.some(d => d.budget > 0);

  // Overall accuracy
  const totalBudget = data.reduce((s, d) => s + d.budget, 0);
  const totalActual = data.reduce((s, d) => s + d.actual, 0);
  const totalPipeline = data.reduce((s, d) => s + d.pipeline, 0);
  const overallAccuracy = totalBudget > 0 ? Math.round((totalActual / totalBudget) * 100) : null;
  const pipelineCoverage = totalBudget > 0 ? Math.round((totalPipeline / totalBudget) * 100) : null;

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-100 mb-1">Forecast Accuracy Analysis</h3>
      <p className="text-xs text-slate-400 mb-4">Budget vs pipeline vs actual revenue — {year}</p>

      {/* Summary badges */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-green-400">${Math.round(totalActual / 1000).toLocaleString()}K</div>
          <div className="text-xs text-slate-400">Actualized</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className="text-xl font-bold text-blue-400">${Math.round(totalPipeline / 1000).toLocaleString()}K</div>
          <div className="text-xs text-slate-400">In Pipeline</div>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3 text-center">
          <div className={`text-xl font-bold ${overallAccuracy === null ? 'text-slate-500' : overallAccuracy >= 90 ? 'text-green-400' : overallAccuracy >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
            {overallAccuracy !== null ? `${overallAccuracy}%` : 'N/A'}
          </div>
          <div className="text-xs text-slate-400">vs Budget</div>
        </div>
      </div>

      {!hasBudgets && (
        <p className="text-xs text-amber-400 mb-3 flex items-center gap-1">
          ⚠ No budget data set — showing pipeline only. Add budgets in Settings for full accuracy tracking.
        </p>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barGap={2}>
          <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
            tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
          <Tooltip content={<CustomTooltip />} />
          {hasBudgets && (
            <Bar dataKey="budget" fill="#475569" fillOpacity={0.5} radius={[3, 3, 0, 0]} name="Budget" />
          )}
          <Bar dataKey="pipeline" fill="#4e6d8c" fillOpacity={0.8} radius={[3, 3, 0, 0]} name="Pipeline" />
          <Bar dataKey="actual" fill="#3d7a6a" fillOpacity={0.85} radius={[3, 3, 0, 0]} name="Definite/Actual" />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-4 mt-2 justify-center">
        {hasBudgets && <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="w-3 h-3 rounded bg-slate-500/70" />Budget</div>}
        <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="w-3 h-3 rounded" style={{background:'#4e6d8c'}} />Pipeline</div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400"><div className="w-3 h-3 rounded" style={{background:'#3d7a6a'}} />Definite/Actual</div>
      </div>
    </div>
  );
}