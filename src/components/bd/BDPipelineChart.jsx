import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths } from 'date-fns';

export default function BDPipelineChart({ data }) {
  const generateTimeData = () => {
    const now = new Date();
    const periods = [];

    // Current month + next 2 months (90 days)
    for (let i = 0; i < 3; i++) {
      const monthDate = addMonths(now, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      periods.push({
        label: format(monthDate, 'MMM yyyy'),
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
      });
    }

    return periods.map(period => {
      const periodLeads = data.filter(lead => {
        const createdDate = lead.created_date?.split('T')[0] || '';
        return createdDate >= period.start && createdDate <= period.end;
      });

      const signedLeads = periodLeads.filter(l => l.status === 'signed_agreement');

      return {
        name: period.label,
        leads: periodLeads.length,
        signed: signedLeads.length
      };
    });
  };

  const chartData = generateTimeData();

  return (
    <Card>
      <CardHeader>
        <CardTitle>90-Day Pipeline Forecast</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip formatter={(value, name) => {
              if (name === 'Total Leads') return [`${value} Leads`, 'Total Leads'];
              if (name === 'Signed Deals') return [`${value} Signed`, 'Signed Deals'];
              return value;
            }} />
            <Legend />
            <Bar dataKey="leads" fill="#8884d8" name="Total Leads" />
            <Bar dataKey="signed" fill="#22c55e" name="Signed Deals" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}