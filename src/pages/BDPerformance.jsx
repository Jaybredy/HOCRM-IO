import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, TrendingUp, Target, DollarSign } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function BDPerformance() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: bdLeads = [] } = useQuery({
    queryKey: ['bdLeads'],
    queryFn: () => base44.entities.BDLead.list(),
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list(),
  });

  // Filter my leads
  const myLeads = bdLeads.filter(lead => lead.seller_name === user?.full_name);
  
  // My stats
  const myActiveLeads = myLeads.filter(l => ['reached_out', 'in_progress', 'proposal_sent'].includes(l.status)).length;
  const mySignedDeals = myLeads.filter(l => l.status === 'signed_agreement').length;
  const myRevenue = myLeads
    .filter(l => l.status === 'signed_agreement')
    .reduce((sum, lead) => {
      const leadValue = Object.values(lead.service_pricing || {}).reduce((s, p) => s + (p || 0), 0);
      return sum + leadValue;
    }, 0);

  const myPipelineValue = myLeads
    .filter(l => l.status !== 'closed_lost')
    .reduce((sum, lead) => {
      const leadValue = Object.values(lead.service_pricing || {}).reduce((s, p) => s + (p || 0), 0);
      return sum + leadValue;
    }, 0);

  // My goals
  const myGoals = goals.filter(g => g.seller_name === user?.full_name && g.seller_type === 'business_development');

  // Services breakdown
  const servicesList = ['revenue_management', 'sales', 'digital_marketing', 'techstack_implementation', 'project_management', 'advisory', 'audit'];
  const servicesData = servicesList.map(service => ({
    name: service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    count: myLeads.filter(l => l.services?.includes(service)).length
  })).filter(s => s.count > 0);

  // Status breakdown
  const statusData = [
    { name: 'Reached Out', value: myLeads.filter(l => l.status === 'reached_out').length, color: '#60a5fa' },
    { name: 'In Progress', value: myLeads.filter(l => l.status === 'in_progress').length, color: '#a78bfa' },
    { name: 'Proposal Sent', value: myLeads.filter(l => l.status === 'proposal_sent').length, color: '#34d399' },
    { name: 'Signed', value: myLeads.filter(l => l.status === 'signed_agreement').length, color: '#22c55e' },
    { name: 'Closed Lost', value: myLeads.filter(l => l.status === 'closed_lost').length, color: '#ef4444' }
  ].filter(s => s.value > 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Award className="w-8 h-8 text-purple-600" />
          My Performance
        </h1>
        <p className="text-gray-600 mt-1">Your individual BD metrics and goals</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Leads</CardTitle>
            <div className="bg-blue-50 p-2 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{myActiveLeads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Signed Deals</CardTitle>
            <div className="bg-green-50 p-2 rounded-lg">
              <Target className="w-5 h-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{mySignedDeals}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Revenue Closed</CardTitle>
            <div className="bg-purple-50 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">${myRevenue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pipeline Value</CardTitle>
            <div className="bg-orange-50 p-2 rounded-lg">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">${myPipelineValue.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Goals Progress */}
      {myGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Goals Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {myGoals.map(goal => {
              const revenueProgress = goal.target_revenue > 0 ? (myRevenue / goal.target_revenue * 100) : 0;
              const leadsProgress = goal.target_leads > 0 ? (myLeads.length / goal.target_leads * 100) : 0;
              
              return (
                <div key={goal.id} className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{goal.period_type} Goal</span>
                    <span className="text-sm text-gray-600">
                      {new Date(goal.period_start).toLocaleDateString()} - {new Date(goal.period_end).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {goal.target_revenue > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Revenue</span>
                        <span>${myRevenue.toLocaleString()} / ${goal.target_revenue.toLocaleString()}</span>
                      </div>
                      <Progress value={Math.min(revenueProgress, 100)} className="h-2" />
                      <p className="text-xs text-gray-600 mt-1">{revenueProgress.toFixed(1)}% achieved</p>
                    </div>
                  )}

                  {goal.target_leads > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Total Leads</span>
                        <span>{myLeads.length} / {goal.target_leads}</span>
                      </div>
                      <Progress value={Math.min(leadsProgress, 100)} className="h-2" />
                      <p className="text-xs text-gray-600 mt-1">{leadsProgress.toFixed(1)}% achieved</p>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Services Breakdown */}
        {servicesData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Services Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={servicesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Status Distribution */}
        {statusData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}