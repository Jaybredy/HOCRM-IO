import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DollarSign, Clock } from 'lucide-react';
import { format, startOfMonth, differenceInDays } from 'date-fns';

export default function BDDealMetrics({ data }) {
  // Average deal size by month
  const signedDeals = data.filter(l => l.status === 'signed_agreement');
  
  const dealsByMonth = {};
  signedDeals.forEach(deal => {
    if (!deal.created_date) return;
    const month = format(startOfMonth(new Date(deal.created_date)), 'MMM yyyy');
    const dealValue = Object.values(deal.service_pricing || {}).reduce((sum, price) => sum + price, 0);
    
    if (!dealsByMonth[month]) {
      dealsByMonth[month] = { total: 0, count: 0 };
    }
    dealsByMonth[month].total += dealValue;
    dealsByMonth[month].count += 1;
  });

  const chartData = Object.entries(dealsByMonth)
    .map(([month, data]) => ({
      month,
      avgDealSize: data.count > 0 ? data.total / data.count : 0,
      deals: data.count
    }))
    .sort((a, b) => new Date(a.month) - new Date(b.month))
    .slice(-6); // Last 6 months

  // Average sales cycle
  const cycleData = signedDeals
    .filter(d => d.created_date && d.updated_date)
    .map(d => differenceInDays(new Date(d.updated_date), new Date(d.created_date)));
  
  const avgCycle = cycleData.length > 0 
    ? Math.round(cycleData.reduce((sum, days) => sum + days, 0) / cycleData.length)
    : 0;

  const totalSignedValue = signedDeals.reduce((sum, deal) => {
    return sum + Object.values(deal.service_pricing || {}).reduce((s, price) => s + price, 0);
  }, 0);

  const avgDealSize = signedDeals.length > 0 ? totalSignedValue / signedDeals.length : 0;

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-5 h-5" />
            Average Deal Size Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="text-2xl font-bold">${avgDealSize.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Current Average</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} fontSize={11} />
              <YAxis />
              <Tooltip formatter={(value) => ['$' + value.toLocaleString(), 'Avg Deal Size']} />
              <Line type="monotone" dataKey="avgDealSize" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="w-5 h-5" />
            Sales Cycle Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div>
              <div className="text-2xl font-bold">{avgCycle} days</div>
              <div className="text-sm text-gray-600">Average Sales Cycle</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xl font-semibold">{signedDeals.length}</div>
                <div className="text-xs text-gray-600">Deals Closed</div>
              </div>
              <div>
                <div className="text-xl font-semibold">
                  {data.filter(l => l.status === 'in_progress').length}
                </div>
                <div className="text-xs text-gray-600">In Progress</div>
              </div>
              <div>
                <div className="text-xl font-semibold">
                  {data.filter(l => l.status === 'proposal_sent').length}
                </div>
                <div className="text-xs text-gray-600">Proposals Out</div>
              </div>
              <div>
                <div className="text-xl font-semibold">
                  {data.filter(l => l.status === 'closed_lost').length}
                </div>
                <div className="text-xs text-gray-600">Lost</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}