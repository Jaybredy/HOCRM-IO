import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function PaceComparison({ productionData, budgetData, paceView, setPaceView }) {
  // Calculate OTB (On The Books) - definite + actual
  const otbByMonth = {};
  productionData.filter(item => ['definite', 'actual'].includes(item.status)).forEach(item => {
    if (!item.arrival_date) return;
    const date = new Date(item.arrival_date);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!otbByMonth[key]) {
      otbByMonth[key] = { roomNights: 0, revenue: 0 };
    }
    otbByMonth[key].roomNights += item.room_nights || 0;
    otbByMonth[key].revenue += item.revenue || 0;
  });

  // Calculate STLY (Same Time Last Year)
  const stlyByMonth = {};
  productionData.filter(item => ['definite', 'actual'].includes(item.status)).forEach(item => {
    if (!item.arrival_date) return;
    const date = new Date(item.arrival_date);
    const lastYear = date.getFullYear() - 1;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const stlyKey = `${lastYear}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!stlyByMonth[stlyKey]) {
      stlyByMonth[stlyKey] = { roomNights: 0, revenue: 0 };
    }
  });

  // Group budget data by month
  const budgetByMonth = {};
  budgetData.forEach(budget => {
    const key = `${budget.year}-${String(budget.month).padStart(2, '0')}`;
    if (!budgetByMonth[key]) {
      budgetByMonth[key] = { roomNights: 0, revenue: 0 };
    }
    budgetByMonth[key].roomNights += budget.budget_room_nights || 0;
    budgetByMonth[key].revenue += budget.budget_revenue || 0;
  });

  // Combine data for chart
  const allMonths = new Set([
    ...Object.keys(budgetByMonth),
    ...Object.keys(otbByMonth)
  ]);

  const chartData = Array.from(allMonths).sort().map(month => {
    const [year, monthNum] = month.split('-');
    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'short' });
    
    const result = {
      month: `${monthName} ${year}`,
      otb: otbByMonth[month]?.revenue || 0,
    };

    if (paceView === 'budget') {
      result.budget = budgetByMonth[month]?.revenue || 0;
    } else if (paceView === 'stly') {
      // For STLY, look at same month last year
      const lastYearMonth = `${parseInt(year) - 1}-${monthNum}`;
      result.stly = otbByMonth[lastYearMonth]?.revenue || 0;
    }

    return result;
  });

  const getSecondBarName = () => {
    if (paceView === 'budget') return 'Budget';
    return 'STLY';
  };

  const getSecondBarKey = () => {
    if (paceView === 'budget') return 'budget';
    return 'stly';
  };

  return (
    <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-white">Pace Analysis</CardTitle>
        <Tabs value={paceView} onValueChange={setPaceView}>
          <TabsList className="bg-slate-800/50 border border-slate-700">
            <TabsTrigger value="budget" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">OTB vs Budget</TabsTrigger>
            <TabsTrigger value="stly" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">OTB vs STLY</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              formatter={(value) => `$${value.toLocaleString()}`}
              contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
              labelStyle={{ color: '#e2e8f0' }}
              itemStyle={{ color: '#94a3b8' }}
            />
            <Legend wrapperStyle={{ color: '#94a3b8' }} />
            <Bar dataKey="otb" fill="#3b82f6" name="OTB (On The Books)" />
            <Bar dataKey={getSecondBarKey()} fill="#94a3b8" name={getSecondBarName()} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}