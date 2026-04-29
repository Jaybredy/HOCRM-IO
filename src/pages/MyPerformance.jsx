import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Bed, Target, Award, ArrowUpRight, ArrowDownRight, Download } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, format } from "date-fns";
import DateFilters from "../components/common/DateFilters";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function MyPerformance() {
  const [selectedSeller, setSelectedSeller] = useState('');
  const [sellerType, setSellerType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: startOfYear(new Date()).toISOString().split('T')[0],
    end: endOfYear(new Date()).toISOString().split('T')[0]
  });
  const [compareWith, setCompareWith] = useState('previous_period');
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState('');

  useEffect(() => {
    base44.auth.me().then(user => {
      if (['admin', 'EPIC_ADMIN'].includes(user?.role)) setIsAdmin(true);
      setCurrentUserEmail(user?.email || '');
    }).catch(() => {});
  }, []);

  const { data: allProduction = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list('-created_date')
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin
  });

  // Get unique sellers from production data
  const sellers = [...new Set(allProduction.map(p => p.seller_name).filter(Boolean))];

  const handleExport = () => {
    const rows = sellerProduction.map(item => {
      const hotel = hotels.find(h => h.id === item.hotel_id);
      return {
        'Activity Date': item.activity_date || '',
        'Seller Name': item.seller_name || '',
        'Client Name': item.client_name || '',
        'Hotel': hotel?.name || '',
        'Status': item.status || '',
        'Event Type': item.event_type || '',
        'Room Nights': item.room_nights || 0,
        'Revenue': item.revenue || 0,
        'Accommodation Revenue': item.accommodation_revenue || 0,
        'ADR': item.room_nights ? ((item.revenue || 0) / item.room_nights).toFixed(2) : '',
        'Arrival Date': item.arrival_date || '',
        'Departure Date': item.departure_date || '',
        'Notes': item.notes || ''
      };
    });

    const headers = Object.keys(rows[0] || {});
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance_export_${dateRange.start}_to_${dateRange.end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter data for selected seller, status, and date range
  const sellerProduction = allProduction.filter(item => {
    if (selectedSeller && item.seller_name !== selectedSeller) return false;
    if (sellerType !== 'all' && (item.seller_type || 'hotel_sales') !== sellerType) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (item.activity_date < dateRange.start || item.activity_date > dateRange.end) return false;
    return true;
  });

  // Calculate comparison period data
  const daysDiff = Math.ceil((new Date(dateRange.end) - new Date(dateRange.start)) / (1000 * 60 * 60 * 24));
  const comparisonStart = new Date(dateRange.start);
  comparisonStart.setDate(comparisonStart.getDate() - daysDiff);
  const comparisonEnd = new Date(dateRange.start);
  comparisonEnd.setDate(comparisonEnd.getDate() - 1);

  const comparisonProduction = allProduction.filter(item => {
    if (selectedSeller && item.seller_name !== selectedSeller) return false;
    if (sellerType !== 'all' && (item.seller_type || 'hotel_sales') !== sellerType) return false;
    const activityDate = item.activity_date;
    return activityDate >= comparisonStart.toISOString().split('T')[0] && 
           activityDate <= comparisonEnd.toISOString().split('T')[0];
  });

  // Calculate KPIs
  const calculateKPIs = (data) => {
    const totalRoomNights = data.reduce((sum, item) => sum + (item.room_nights || 0), 0);
    const totalRevenue = data.reduce((sum, item) => sum + (item.revenue || 0), 0);
    const adr = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;
    
    const byStatus = {
      solicitation: data.filter(i => i.status === 'solicitation').length,
      prospect: data.filter(i => i.status === 'prospect').length,
      tentative: data.filter(i => i.status === 'tentative').length,
      definite: data.filter(i => i.status === 'definite').length,
      actual: data.filter(i => i.status === 'actual_pickup').length,  // enum value is actual_pickup
      lost: data.filter(i => i.status === 'lost').length
    };

    // Two-stage funnel: Conversion = leads that became Definite,
    // Actualization = leads that actually showed up post-stay.
    const totalLeads = data.length;
    const conversionRate = totalLeads > 0
      ? ((byStatus.definite + byStatus.actual) / totalLeads * 100)
      : 0;
    const actualizationRate = totalLeads > 0
      ? (byStatus.actual / totalLeads * 100)
      : 0;

    return { totalRoomNights, totalRevenue, adr, byStatus, conversionRate, actualizationRate, totalLeads };
  };

  const currentKPIs = calculateKPIs(sellerProduction);
  const previousKPIs = calculateKPIs(comparisonProduction);

  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100);
  };

  // Monthly trend data
  const monthlyData = {};
  sellerProduction.forEach(item => {
    const month = format(new Date(item.activity_date), 'MMM yyyy');
    if (!monthlyData[month]) {
      monthlyData[month] = { roomNights: 0, revenue: 0, leads: 0 };
    }
    monthlyData[month].roomNights += item.room_nights || 0;
    monthlyData[month].revenue += item.revenue || 0;
    monthlyData[month].leads += 1;
  });

  const trendData = Object.keys(monthlyData).sort().map(month => ({
    month,
    roomNights: monthlyData[month].roomNights,
    revenue: monthlyData[month].revenue,
    leads: monthlyData[month].leads
  }));

  // Pipeline distribution
  const pipelineData = [
    { name: 'Solicitation', value: currentKPIs.byStatus.solicitation, color: COLORS[0] },
    { name: 'Prospect', value: currentKPIs.byStatus.prospect, color: COLORS[1] },
    { name: 'Tentative', value: currentKPIs.byStatus.tentative, color: COLORS[2] },
    { name: 'Definite', value: currentKPIs.byStatus.definite, color: COLORS[3] },
    { name: 'Actual', value: currentKPIs.byStatus.actual, color: COLORS[4] }
  ].filter(item => item.value > 0);

  // Hotel distribution
  const hotelData = {};
  sellerProduction.forEach(item => {
    const hotel = hotels.find(h => h.id === item.hotel_id);
    const hotelName = hotel?.name || 'Unknown';
    if (!hotelData[hotelName]) {
      hotelData[hotelName] = { roomNights: 0, revenue: 0 };
    }
    hotelData[hotelName].roomNights += item.room_nights || 0;
    hotelData[hotelName].revenue += item.revenue || 0;
  });

  const hotelChartData = Object.keys(hotelData).map(hotel => ({
    hotel,
    roomNights: hotelData[hotel].roomNights,
    revenue: hotelData[hotel].revenue
  }));

  const KPICard = ({ title, value, change, icon: Icon, format: formatFn = (v) => v }) => (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-3xl font-bold mt-2 text-white">{formatFn(value)}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              <span>{Math.abs(change).toFixed(1)}% vs previous period</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-blue-500/20 rounded-lg">
          <Icon className="w-6 h-6 text-blue-400" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Award className="w-8 h-8 text-blue-400" />
                {isAdmin ? 'Performance Dashboard' : 'My Performance'}
              </h1>
              <p className="text-slate-400 mt-1">{isAdmin ? 'View and compare performance across all sellers' : 'Track your sales performance and KPIs'}</p>
            </div>
            <Button
              onClick={handleExport}
              disabled={sellerProduction.length === 0}
              className="bg-green-600 hover:bg-green-500 text-white gap-2 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Seller</Label>
              <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white [&_svg]:text-white [&>span]:text-white">
                  <SelectValue placeholder={isAdmin ? "All Sellers" : "Select Seller"} />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value={null}>All Sellers</SelectItem>}
                  {sellers.map(seller => (
                    <SelectItem key={seller} value={seller}>{seller}</SelectItem>
                  ))}
                  {isAdmin && allUsers.filter(u => !sellers.includes(u.full_name) && !sellers.includes(u.email)).map(u => (
                    <SelectItem key={u.id} value={u.full_name || u.email}>{u.full_name || u.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white [&_svg]:text-white [&>span]:text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="tentative">Tentative</SelectItem>
                  <SelectItem value="definite">Definite</SelectItem>
                  <SelectItem value="actual_pickup">Actual Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Start Date</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="bg-slate-700 border-slate-600 text-white [color-scheme:dark]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">End Date</Label>
              <Input 
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="bg-slate-700 border-slate-600 text-white [color-scheme:dark]"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600 hover:text-white" onClick={() => {
              const start = startOfMonth(new Date());
              const end = endOfMonth(new Date());
              setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
            }}>This Month</Button>
            <Button variant="outline" size="sm" className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600 hover:text-white" onClick={() => {
              const start = startOfYear(new Date());
              const end = endOfYear(new Date());
              setDateRange({ start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
            }}>This Year</Button>
            <Button variant="outline" size="sm" className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600 hover:text-white" onClick={() => {
              const start = subMonths(new Date(), 3);
              setDateRange({ start: start.toISOString().split('T')[0], end: new Date().toISOString().split('T')[0] });
            }}>Last 3 Months</Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard title="Total Room Nights" value={currentKPIs.totalRoomNights} change={calculateChange(currentKPIs.totalRoomNights, previousKPIs.totalRoomNights)} icon={Bed} format={(v) => v.toLocaleString()} />
          <KPICard title="Total Revenue" value={currentKPIs.totalRevenue} change={calculateChange(currentKPIs.totalRevenue, previousKPIs.totalRevenue)} icon={DollarSign} format={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
          <KPICard title="Average ADR" value={currentKPIs.adr} change={calculateChange(currentKPIs.adr, previousKPIs.adr)} icon={TrendingUp} format={(v) => `$${v.toFixed(2)}`} />
          <KPICard title="Conversion (Definite)" value={currentKPIs.conversionRate} change={calculateChange(currentKPIs.conversionRate, previousKPIs.conversionRate)} icon={Target} format={(v) => `${v.toFixed(1)}%`} />
          <KPICard title="Actualization Rate" value={currentKPIs.actualizationRate} change={calculateChange(currentKPIs.actualizationRate, previousKPIs.actualizationRate)} icon={Target} format={(v) => `${v.toFixed(1)}%`} />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Monthly Performance Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" />
                <YAxis yAxisId="left" stroke="#94a3b8" />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#3b82f6" name="Revenue ($)" />
                <Line yAxisId="right" type="monotone" dataKey="roomNights" stroke="#10b981" name="Room Nights" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">Pipeline Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pipelineData} cx="50%" cy="50%" labelLine={false} label={({ name, value }) => `${name}: ${value}`} outerRadius={100} dataKey="value">
                  {pipelineData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hotel Performance */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Performance by Hotel</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={hotelChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hotel" stroke="#94a3b8" />
              <YAxis yAxisId="left" stroke="#94a3b8" />
              <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff' }} />
              <Legend />
              <Bar yAxisId="right" dataKey="roomNights" fill="#10b981" name="Room Nights" />
              <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue ($)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Stats */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4">Detailed Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Leads', value: currentKPIs.totalLeads, color: 'bg-slate-700' },
              { label: 'Solicitations', value: currentKPIs.byStatus.solicitation, color: 'bg-blue-500/20' },
              { label: 'Prospects', value: currentKPIs.byStatus.prospect, color: 'bg-green-500/20' },
              { label: 'Tentatives', value: currentKPIs.byStatus.tentative, color: 'bg-yellow-500/20' },
              { label: 'Definites', value: currentKPIs.byStatus.definite, color: 'bg-purple-500/20' },
              { label: 'Actual', value: currentKPIs.byStatus.actual, color: 'bg-cyan-500/20' },
            ].map(({ label, value, color }) => (
              <div key={label} className={`text-center p-4 ${color} rounded-lg`}>
                <p className="text-sm text-slate-400">{label}</p>
                <p className="text-2xl font-bold mt-1 text-white">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}