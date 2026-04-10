import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PieChart, Pie, Cell } from 'recharts';
import { Package } from 'lucide-react';

export default function BDServiceMix({ data }) {
  const serviceLabels = {
    sales: 'Sales',
    revenue_management: 'Revenue Mgmt',
    digital_marketing: 'Digital Marketing',
    tech_stack: 'Tech Stack',
    project_management: 'Project Mgmt',
    advisory: 'Advisory',
    audit: 'Audit'
  };

  // Count services in signed deals
  const signedDeals = data.filter(l => l.status === 'signed_agreement');
  const serviceCounts = {};
  const serviceRevenue = {};

  signedDeals.forEach(deal => {
    deal.services?.forEach(service => {
      serviceCounts[service] = (serviceCounts[service] || 0) + 1;
      const price = deal.service_pricing?.[service] || 0;
      serviceRevenue[service] = (serviceRevenue[service] || 0) + price;
    });
  });

  const chartData = Object.entries(serviceCounts).map(([service, count]) => ({
    name: serviceLabels[service] || service,
    count,
    revenue: serviceRevenue[service] || 0
  })).sort((a, b) => b.count - a.count);

  const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#eab308', '#f97316', '#ec4899', '#06b6d4'];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5" />
          Service Mix Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm font-semibold mb-3">Service Count</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <p className="text-sm font-semibold mb-3">Revenue by Service</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: $${(entry.revenue / 1000).toFixed(0)}k`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => '$' + value.toLocaleString()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}