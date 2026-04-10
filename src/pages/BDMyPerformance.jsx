import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Target, TrendingUp, DollarSign } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, startOfMonth } from 'date-fns';

export default function BDMyPerformance() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: bdLeads = [] } = useQuery({
    queryKey: ['bdLeads'],
    queryFn: () => base44.entities.BDLead.list(),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['bdGoals'],
    queryFn: () => base44.entities.Goal.filter({ seller_type: 'business_development' }),
  });

  const myLeads = bdLeads.filter(l => l.seller_name === user?.full_name);
  const mySignedDeals = myLeads.filter(l => l.status === 'signed_agreement');
  const myActiveLeads = myLeads.filter(l => l.status !== 'closed_lost');

  const totalRevenue = mySignedDeals.reduce((sum, lead) => {
    return sum + Object.values(lead.service_pricing || {}).reduce((s, price) => s + price, 0);
  }, 0);

  const conversionRate = myActiveLeads.length > 0 
    ? ((mySignedDeals.length / myActiveLeads.length) * 100).toFixed(1)
    : 0;

  // Monthly performance
  const monthlyData = {};
  mySignedDeals.forEach(deal => {
    if (!deal.created_date) return;
    const month = format(startOfMonth(new Date(deal.created_date)), 'MMM yyyy');
    const dealValue = Object.values(deal.service_pricing || {}).reduce((sum, price) => sum + price, 0);
    
    if (!monthlyData[month]) {
      monthlyData[month] = { deals: 0, revenue: 0 };
    }
    monthlyData[month].deals += 1;
    monthlyData[month].revenue += dealValue;
  });

  const chartData = Object.entries(monthlyData)
    .map(([month, data]) => ({ month, ...data }))
    .sort((a, b) => new Date(a.month) - new Date(b.month))
    .slice(-6);

  const myGoals = goals.filter(g => g.seller_name === user?.full_name);
  const activeGoal = myGoals.find(g => {
    const now = new Date();
    return new Date(g.period_start) <= now && new Date(g.period_end) >= now;
  });

  const goalProgress = activeGoal ? {
    leads: activeGoal.target_leads > 0 ? (myLeads.length / activeGoal.target_leads * 100).toFixed(0) : 0,
    revenue: activeGoal.target_revenue > 0 ? (totalRevenue / activeGoal.target_revenue * 100).toFixed(0) : 0
  } : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00a3e0] to-[#0066cc] bg-clip-text text-transparent">
          My BD Performance
        </h1>
        <p className="text-gray-600 mt-1">Track your business development metrics and goal progress</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">My Leads</CardTitle>
            <div className="bg-[#e6f7ff] p-2 rounded-lg">
              <Target className="w-5 h-5 text-[#00a3e0]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#00a3e0]">{myLeads.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Signed Deals</CardTitle>
            <div className="bg-blue-50 p-2 rounded-lg">
              <Award className="w-5 h-5 text-[#0066cc]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#0066cc]">{mySignedDeals.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            <div className="bg-emerald-50 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">${totalRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Conversion Rate</CardTitle>
            <div className="bg-amber-50 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{conversionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress */}
      {goalProgress && (
        <Card>
          <CardHeader>
            <CardTitle>Current Goal Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Leads Target</span>
                  <span className="text-sm text-gray-600">{goalProgress.leads}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-[#00a3e0] h-2 rounded-full" style={{ width: `${Math.min(goalProgress.leads, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Revenue Target</span>
                  <span className="text-sm text-gray-600">{goalProgress.revenue}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${Math.min(goalProgress.revenue, 100)}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Deals Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="deals" fill="#00a3e0" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip formatter={(value) => '$' + value.toLocaleString()} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}