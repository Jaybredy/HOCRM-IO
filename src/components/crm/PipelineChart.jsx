import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STAGE_COLORS = {
  solicitation: '#94a3b8',
  prospect: '#3b82f6',
  tentative: '#f59e0b',
  definite: '#10b981',
  actual: '#06b6d4',
  lost: '#ef4444'
};

const STAGE_LABELS = {
  solicitation: 'Solicitation',
  prospect: 'Prospect',
  tentative: 'Tentative',
  definite: 'Definite',
  actual: 'Actual',
  lost: 'Lost'
};

export default function PipelineChart({ data }) {
  const stages = ['solicitation', 'prospect', 'tentative', 'definite', 'actual', 'lost'];
  
  const chartData = stages.map(stage => {
    const items = data.filter(item => item.status === stage);
    const count = items.length;
    const revenue = items.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const roomNights = items.reduce((sum, item) => sum + (item.room_nights || 0), 0);
    
    return {
      name: STAGE_LABELS[stage],
      count,
      revenue,
      roomNights,
      stage
    };
  });

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white">Sales Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#94a3b8' }}
              formatter={(value, name) => {
                if (name === 'revenue') return `$${value.toLocaleString()}`;
                return value.toLocaleString();
              }}
            />
            <Bar dataKey="count" name="Count" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={STAGE_COLORS[entry.stage]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}