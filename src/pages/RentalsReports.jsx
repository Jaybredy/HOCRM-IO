import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FileDown, FileSpreadsheet, FileText, BarChart3, ChevronDown, Building2, Users, DollarSign, TrendingUp } from "lucide-react";
import jsPDF from 'jspdf';
import { format } from "date-fns";

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function RentalsReports() {
  const [user, setUser] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedHotels, setSelectedHotels] = useState([]);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    const today = new Date();
    const oneYearAgo = new Date(today.getTime() - 365 * 24 * 60 * 60 * 1000);
    setDateFrom(oneYearAgo.toISOString().split('T')[0]);
    setDateTo(today.toISOString().split('T')[0]);
  }, []);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels-rentals'],
    queryFn: async () => {
      const allHotels = await base44.entities.Hotel.list();
      return user ? allHotels.filter(h => h.created_by === user.email && (h.hotel_type === 'apartment' || !h.hotel_type)) : [];
    },
    enabled: !!user
  });

  const { data: units = [] } = useQuery({
    queryKey: ['units-rentals', hotels],
    queryFn: async () => {
      const allUnits = await base44.entities.Unit.list();
      const hotelIds = hotels.map(h => h.id);
      return allUnits.filter(u => hotelIds.includes(u.hotel_id));
    },
    enabled: hotels.length > 0
  });

  const { data: leaseRenewals = [] } = useQuery({
    queryKey: ['lease-renewals'],
    queryFn: () => base44.entities.LeaseRenewal.list()
  });

  const filteredHotels = selectedHotels.length === 0 ? hotels : hotels.filter(h => selectedHotels.includes(h.id));
  const filteredHotelIds = filteredHotels.map(h => h.id);
  const filteredUnits = units.filter(u => filteredHotelIds.includes(u.hotel_id));

  // Calculate metrics
  const totalUnits = filteredUnits.length;
  const occupiedUnits = filteredUnits.filter(u => u.status === 'rented').length;
  const occupancyRate = totalUnits > 0 ? ((occupiedUnits / totalUnits) * 100).toFixed(1) : 0;
  const totalMonthlyRevenue = filteredUnits.reduce((sum, u) => sum + (u.monthly_rent || 0) * (u.status === 'rented' ? 1 : 0), 0).toFixed(2);
  const averageRent = filteredUnits.length > 0 ? (filteredUnits.reduce((sum, u) => sum + (u.monthly_rent || 0), 0) / filteredUnits.length).toFixed(2) : 0;

  // Occupancy by Property
  const occupancyByProperty = filteredHotels.map(hotel => {
    const hotelUnits = filteredUnits.filter(u => u.hotel_id === hotel.id);
    const occupied = hotelUnits.filter(u => u.status === 'rented').length;
    return {
      name: hotel.name,
      occupied,
      available: hotelUnits.length - occupied,
      maintenance: hotelUnits.filter(u => u.status === 'maintenance').length,
      total: hotelUnits.length
    };
  });

  // Revenue by Property
  const revenueByProperty = filteredHotels.map(hotel => {
    const hotelUnits = filteredUnits.filter(u => u.hotel_id === hotel.id);
    const revenue = hotelUnits.reduce((sum, u) => sum + (u.monthly_rent || 0) * (u.status === 'rented' ? 1 : 0), 0);
    return {
      name: hotel.name,
      revenue: parseFloat(revenue.toFixed(2))
    };
  });

  // Unit Status Distribution
  const statusData = [
    { name: 'Rented', value: filteredUnits.filter(u => u.status === 'rented').length, fill: '#3b82f6' },
    { name: 'Available', value: filteredUnits.filter(u => u.status === 'available').length, fill: '#10b981' },
    { name: 'Maintenance', value: filteredUnits.filter(u => u.status === 'maintenance').length, fill: '#f59e0b' }
  ];

  // Unit Type Distribution
  const typeCounts = {};
  filteredUnits.forEach(u => {
    typeCounts[u.unit_type] = (typeCounts[u.unit_type] || 0) + 1;
  });

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPDF = (headers, rows, title) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    let yPos = 25;
    const pageWidth = doc.internal.pageSize.getWidth();
    const colWidth = Math.min((pageWidth - 20) / headers.length, 25);
    doc.setFont(undefined, 'bold');
    headers.forEach((h, i) => doc.text(String(h), 10 + (i * colWidth), yPos));
    doc.setFont(undefined, 'normal');
    yPos += 7;
    rows.slice(0, 30).forEach((row) => {
      if (yPos > 180) {
        doc.addPage();
        yPos = 15;
      }
      row.forEach((cell, i) => doc.text(String(cell || '').substring(0, 15), 10 + (i * colWidth), yPos));
      yPos += 7;
    });
    if (rows.length > 30) doc.text(`... and ${rows.length - 30} more rows`, 10, yPos + 10);
    doc.save(`${title}.pdf`);
  };

  const generatePropertyReport = (exportFormat = 'csv') => {
    const headers = ['Property', 'Total Units', 'Rented', 'Available', 'Maintenance', 'Occupancy Rate', 'Monthly Revenue'];
    const rows = occupancyByProperty.map(prop => [
      prop.name,
      prop.total,
      prop.occupied,
      prop.available,
      prop.maintenance,
      `${((prop.occupied / prop.total) * 100).toFixed(1)}%`,
      revenueByProperty.find(r => r.name === prop.name)?.revenue || 0
    ]);

    if (exportFormat === 'csv') {
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadCSV(csv, `rentals-property-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } else if (exportFormat === 'pdf') {
      downloadPDF(headers, rows, `Property Report - ${format(new Date(), 'yyyy-MM-dd')}`);
    }
  };

  const generateUnitsReport = (exportFormat = 'csv') => {
    const headers = ['Unit Number', 'Property', 'Type', 'Status', 'Monthly Rent', 'Lease Start', 'Lease End'];
    const rows = filteredUnits.map(unit => {
      const hotel = hotels.find(h => h.id === unit.hotel_id);
      return [
        unit.unit_number,
        hotel?.name || '',
        unit.unit_type,
        unit.status,
        unit.monthly_rent,
        unit.lease_start_date || '',
        unit.lease_end_date || ''
      ];
    });

    if (exportFormat === 'csv') {
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadCSV(csv, `rentals-units-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } else if (exportFormat === 'pdf') {
      downloadPDF(headers, rows, `Units Report - ${format(new Date(), 'yyyy-MM-dd')}`);
    }
  };

  const generateLeaseReport = (exportFormat = 'csv') => {
    const headers = ['Unit', 'Tenant', 'Current Lease End', 'Renewal Status', 'Proposal Sent', 'Current Rent', 'Proposed Rent'];
    const rows = leaseRenewals.map(renewal => [
      renewal.unit_id,
      renewal.tenant_name,
      renewal.current_lease_end_date,
      renewal.renewal_status,
      renewal.proposal_sent_date || '',
      renewal.current_monthly_rent || 0,
      renewal.proposed_monthly_rent || 0
    ]);

    if (exportFormat === 'csv') {
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadCSV(csv, `lease-renewals-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } else if (exportFormat === 'pdf') {
      downloadPDF(headers, rows, `Lease Renewals Report - ${format(new Date(), 'yyyy-MM-dd')}`);
    }
  };

  const firstName = (user?.display_name) || user?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'there';
  const metrics = [
    { label: 'Total Units', value: totalUnits, icon: Building2, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Occupancy Rate', value: `${occupancyRate}%`, icon: Users, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Avg Monthly Rent', value: `$${averageRent}`, icon: DollarSign, color: 'text-amber-400', bg: 'bg-amber-400/10' },
    { label: 'Monthly Revenue', value: `$${totalMonthlyRevenue}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-emerald-400" />
              Rentals Reports
            </h1>
            <p className="text-slate-300 mt-1">Property and unit performance analytics</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white">
                <FileDown className="w-4 h-4 mr-2" />
                Export
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-slate-800 border-slate-700">
              <DropdownMenuItem onClick={() => generatePropertyReport('csv')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileDown className="w-4 h-4 mr-2 text-emerald-400" /> Property Report (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generatePropertyReport('pdf')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileText className="w-4 h-4 mr-2 text-red-400" /> Property Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateUnitsReport('csv')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileDown className="w-4 h-4 mr-2 text-blue-400" /> Units Report (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateUnitsReport('pdf')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileText className="w-4 h-4 mr-2 text-red-400" /> Units Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateLeaseReport('csv')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileDown className="w-4 h-4 mr-2 text-purple-400" /> Lease Renewals (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateLeaseReport('pdf')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileText className="w-4 h-4 mr-2 text-red-400" /> Lease Renewals (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Filters */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Properties</Label>
                <Select value={selectedHotels.join(',')} onValueChange={(val) => setSelectedHotels(val ? val.split(',') : [])}>
                  <SelectTrigger className="bg-slate-700/50 border-slate-600 text-white">
                    <SelectValue placeholder="All Properties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Properties</SelectItem>
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occupancy by Property */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Occupancy by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={occupancyByProperty}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                  <Legend />
                  <Bar dataKey="occupied" stackId="a" fill="#3b82f6" name="Rented" />
                  <Bar dataKey="available" stackId="a" fill="#10b981" name="Available" />
                  <Bar dataKey="maintenance" stackId="a" fill="#f59e0b" name="Maintenance" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by Property */}
          <Card className="bg-slate-800/60 border-slate-700">
            <CardHeader>
              <CardTitle className="text-white text-lg">Monthly Revenue by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={revenueByProperty}>
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

          {/* Unit Type Distribution */}
          {Object.keys(typeCounts).length > 0 && (
            <Card className="bg-slate-800/60 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Unit Type Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(typeCounts).map(([type, count], idx) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                        <span className="text-slate-300 capitalize text-sm">{type}</span>
                      </div>
                      <span className="text-white font-semibold text-sm">{count}</span>
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