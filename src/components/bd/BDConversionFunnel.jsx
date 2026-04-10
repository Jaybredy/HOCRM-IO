import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingDown } from 'lucide-react';

export default function BDConversionFunnel({ data }) {
  const statusOrder = ['reached_out', 'in_progress', 'proposal_sent', 'signed_agreement'];
  const statusLabels = {
    reached_out: 'Reached Out',
    in_progress: 'In Progress',
    proposal_sent: 'Proposal Sent',
    signed_agreement: 'Signed'
  };

  const funnelData = statusOrder.map(status => ({
    name: statusLabels[status],
    count: data.filter(l => l.status === status).length,
    status
  }));

  // Calculate conversion rates
  const totalLeads = data.filter(l => l.status !== 'closed_lost').length;
  const conversions = funnelData.map((stage, idx) => {
    const rate = totalLeads > 0 ? (stage.count / totalLeads * 100) : 0;
    return { ...stage, rate };
  });

  const colors = ['#3b82f6', '#eab308', '#a855f7', '#22c55e'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5" />
          Conversion Funnel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={conversions}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-15} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => {
                if (name === 'rate') return [value.toFixed(1) + '%', 'Conversion Rate'];
                return [value, 'Count'];
              }}
            />
            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
              {conversions.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
          {conversions.map((stage, idx) => (
            <div key={idx}>
              <div className="font-semibold">{stage.count}</div>
              <div className="text-gray-500">{stage.rate.toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}