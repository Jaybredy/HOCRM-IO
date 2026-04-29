import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { TrendingUp, Calendar, Building2, DollarSign, Users, Wrench } from "lucide-react";

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function PropertyAnalytics() {
  const [user, setUser] = useState(null);
  const [propertyType, setPropertyType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    setDateFrom(thirtyDaysAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, []);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels-analytics'],
    queryFn: async () => {
      const allHotels = await base44.entities.Hotel.list();
      return user ? allHotels.filter(h => h.created_by === user.email && (h.hotel_type === 'apartment' || !h.hotel_type)) : [];
    },
    enabled: !!user
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units-analytics', hotels],
    queryFn: async () => {
      const allUnits = await base44.entities.Unit.list();
      const hotelIds = hotels.map(h => h.id);
      return allUnits.filter(u => hotelIds.includes(u.hotel_id));
    },
    enabled: hotels.length > 0
  });

  const firstName = (user?.display_name) || user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Filter hotels by type
  const filteredHotels = propertyType === 'all' ? hotels : hotels.filter(h => h.id === propertyType);
  const filteredHotelIds = filteredHotels.map(h => h.id);
  const filteredUnits = units.filter(u => filteredHotelIds.includes(u.hotel_id));

  // Calculate metrics
  const totalUnits = filteredUnits.length;
  const occupiedUnits = filteredUnits.filter(u => u.status === 'rented').length;
  const occupancyRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0;
  const averageMonthlyRent = filteredUnits.length > 0 ? (filteredUnits.reduce((sum, u) => sum + (u.monthly_rent || 0), 0) / filteredUnits.length).toFixed(2) : 0;
  const totalMonthlyRevenue = filteredUnits.reduce((sum, u) => sum + (u.monthly_rent || 0) * (u.status === 'rented' ? 1 : 0), 0).toFixed(2);

  // Occupancy by Hotel
  const occupancyByHotel = filteredHotels.map(hotel => {
    const hotelUnits = filteredUnits.filter(u => u.hotel_id === hotel.id);
    const occupied = hotelUnits.filter(u => u.status === 'rented').length;
    return {
      name: hotel.name,
      occupied,
      available: hotelUnits.length - occupied,
      total: hotelUnits.length,
      rate: hotelUnits.length > 0 ? ((occupied / hotelUnits.length) * 100).toFixed(1) : 0
    };
  });

  // Revenue by Hotel
  const revenueByHotel = filteredHotels.map(hotel => {
    const hotelUnits = filteredUnits.filter(u => u.hotel_id === hotel.id);
    const revenue = hotelUnits.reduce((sum, u) => sum + (u.monthly_rent || 0) * (u.status === 'rented' ? 1 : 0), 0);
    return {
      name: hotel.name,
      revenue: parseFloat(revenue.toFixed(2))
    };
  });

  // Unit Status Distribution
  const statusCounts = {
    available: filteredUnits.filter(u => u.status === 'available').length,
    rented: filteredUnits.filter(u => u.status === 'rented').length,
    maintenance: filteredUnits.filter(u => u.status === 'maintenance').length
  };

  const statusData = [
    { name: 'Available', value: statusCounts.available, fill: '#10b981' },
    { name: 'Rented', value: statusCounts.rented, fill: '#3b82f6' },
    { name: 'Maintenance', value: statusCounts.maintenance, fill: '#f59e0b' }
  ];

  // Unit Type Distribution
  const typeCounts = {};
  filteredUnits.forEach(u => {
    typeCounts[u.unit_type] = (typeCounts[u.unit_type] || 0) + 1;
  });
  const typeData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  // Average Rent by Type
  const rentByType = {};
  filteredUnits.forEach(u => {
    if (!rentByType[u.unit_type]) rentByType[u.unit_type] = { total: 0, count: 0 };
    rentByType[u.unit_type].total += u.monthly_rent || 0;
    rentByType[u.unit_type].count += 1;
  });
  const rentByTypeData = Object.entries(rentByType).map(([type, data]) => ({
    type,
    avgRent: (data.total / data.count).toFixed(2)
  }));

  const metrics = [
    { label: 'Total Units', value: totalUnits, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: Users, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Avg Monthly Rent', value: `$${averageMonthlyRent}`, icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Monthly Revenue', value: `$${totalMonthlyRevenue}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{greeting}, {firstName}</h1>
            <p className="text-slate-400 text-sm mt-0.5">Property Analytics Dashboard</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Property Type</Label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Properties</SelectItem>
                    {hotels.map(h => (
                      <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-slate-700/50 border-slate-600 text-white [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-100"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map(m => (
            <Card key={m.label} className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center shrink-0`}>
                  <m.icon className={`w-5 h-5 ${m.color}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-xs text-slate-400">{m.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Occupancy by Hotel */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Occupancy by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={occupancyByHotel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Bar dataKey="occupied" stackId="a" fill="#3b82f6" name="Rented" />
                  <Bar dataKey="available" stackId="a" fill="#10b981" name="Available" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by Hotel */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Monthly Revenue by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByHotel}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(value) => `$${value}`} />
                  <Bar dataKey="revenue" fill="#10b981" name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Unit Status Distribution */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Unit Status Distribution</CardTitle>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={80} dataKey="value">
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Average Rent by Type */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Average Rent by Unit Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={rentByTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="type" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(value) => `$${value}`} />
                  <Bar dataKey="avgRent" fill="#f59e0b" name="Avg Rent" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Unit Type Distribution */}
          {typeData.length > 0 && (
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Unit Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {typeData.map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                        <span className="text-slate-300 capitalize">{item.name}</span>
                      </div>
                      <span className="text-white font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}