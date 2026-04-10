import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';

export default function BDPaceAnalysis({ data }) {
  // Generate next 90 days (current month + next 2 months)
  const generateForecastMonths = () => {
    const now = new Date();
    const months = [];
    
    for (let i = 0; i < 3; i++) {
      const monthDate = addMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthKey = format(monthStart, 'yyyy-MM');
      const monthLabel = format(monthStart, 'MMM yyyy');
      
      months.push({
        key: monthKey,
        label: monthLabel,
        date: monthStart
      });
    }
    
    return months;
  };

  const forecastMonths = generateForecastMonths();

  // Calculate metrics for each month
  const chartData = forecastMonths.map(month => {
    // Current year data
    const monthLeads = data.filter(lead => {
      if (!lead.created_date) return false;
      const leadDate = lead.created_date.split('T')[0];
      return leadDate.startsWith(month.key);
    });

    const pipelineCount = monthLeads.filter(l => l.status !== 'closed_lost').length;
    const signedCount = monthLeads.filter(l => l.status === 'signed_agreement').length;

    // STLY data (same month last year)
    const lastYearKey = format(subMonths(month.date, 12), 'yyyy-MM');
    const stlyLeads = data.filter(lead => {
      if (!lead.created_date) return false;
      const leadDate = lead.created_date.split('T')[0];
      return leadDate.startsWith(lastYearKey);
    });

    const stlyCount = stlyLeads.filter(l => l.status !== 'closed_lost').length;

    return {
      month: month.label,
      pipeline: pipelineCount,
      signed: signedCount,
      stly: stlyCount,
      total: monthLeads.length
    };
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>90-Day Lead Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip formatter={(value) => [value, 'Leads']} />
            <Legend />
            <Line type="monotone" dataKey="pipeline" stroke="#8b5cf6" strokeWidth={2} name="Pipeline Leads" />
            <Line type="monotone" dataKey="signed" stroke="#22c55e" strokeWidth={2} name="Signed Deals" />
            <Line type="monotone" dataKey="stly" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" name="STLY Pipeline" />
            <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={2} name="Total Leads" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}