import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { DollarSign } from 'lucide-react';

export default function PipelineValueChart({ production, hotelId, dateRange }) {
  const stages = ['prospect', 'tentative', 'definite'];
  
  const stageLabels = {
    prospect: 'Prospect',
    tentative: 'Tentative',
    definite: 'Definite',
  };

  // Exclude actual_pickup to avoid double-counting
  const cleanProduction = production.filter(p => p.record_type !== 'actual_pickup');

  const data = stages.map(stage => {
    const items = cleanProduction.filter(p => p.status === stage);
    return {
      stage: stageLabels[stage],
      value: items.reduce((sum, p) => sum + (p.revenue || 0), 0),
      count: items.length,
      roomNights: items.reduce((sum, p) => sum + (p.room_nights || 0), 0)
    };
  });

  const totalValue = data.reduce((sum, d) => sum + d.value, 0);

  const buildBookingsUrl = () => {
    const params = new URLSearchParams();
    if (hotelId && hotelId !== 'all') params.set('property', hotelId);
    if (dateRange?.start && dateRange.start !== '2020-01-01') params.set('dateStart', dateRange.start);
    if (dateRange?.end && dateRange.end !== '2030-12-31') params.set('dateEnd', dateRange.end);
    const qs = params.toString();
    return createPageUrl('Bookings') + (qs ? `?${qs}` : '');
  };

  return (
    <Card className="bg-slate-800 border border-slate-700 rounded-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          Pipeline Value by Stage
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Link to={buildBookingsUrl()} className="mb-4 p-4 bg-slate-800 rounded-lg block hover:bg-slate-700 transition-colors">
          <div className="text-center">
            <div className="text-4xl font-bold text-cyan-400">
              ${totalValue.toLocaleString()}
            </div>
            <div className="text-sm text-slate-200 mt-1">Total Pipeline Value ↗</div>
          </div>
        </Link>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis dataKey="stage" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 13 }} />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 13 }} />
            <Tooltip 
              formatter={(value) => `$${value.toLocaleString()}`}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px' }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#14b8a6' }}
            />
            <Legend wrapperStyle={{ color: '#e2e8f0', fontSize: 13, paddingTop: '12px' }} />
            <Bar dataKey="value" name="Revenue" radius={[4,4,0,0]}>
              <Cell fill="#14b8a6" />
              <Cell fill="#f97316" />
              <Cell fill="#6b7280" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}