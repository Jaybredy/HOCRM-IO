import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, TrendingUp, Award, Download, Activity } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfYear, endOfYear, format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import * as XLSX from 'xlsx';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function HotelPerformance() {
  const [exporting, setExporting] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState('all');
  const [dateRange, setDateRange] = useState({
    start: startOfYear(new Date()).toISOString().split('T')[0],
    end: endOfYear(new Date()).toISOString().split('T')[0]
  });

  const { data: allProduction = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list('-created_date')
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.list()
  });

  const { data: allActivities = [] } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date')
  });

  const filteredProduction = allProduction.filter(item => {
    const dateMatch = item.arrival_date >= dateRange.start && item.arrival_date <= dateRange.end;
    const hotelMatch = selectedHotelId === 'all' || item.hotel_id === selectedHotelId;
    return dateMatch && hotelMatch;
  });

  const stlyStart = new Date(dateRange.start);
  stlyStart.setFullYear(stlyStart.getFullYear() - 1);
  const stlyEnd = new Date(dateRange.end);
  stlyEnd.setFullYear(stlyEnd.getFullYear() - 1);

  const stlyProduction = allProduction.filter(item => {
    const itemDate = item.arrival_date;
    const dateMatch = itemDate >= stlyStart.toISOString().split('T')[0] && itemDate <= stlyEnd.toISOString().split('T')[0];
    const hotelMatch = selectedHotelId === 'all' || item.hotel_id === selectedHotelId;
    return dateMatch && hotelMatch;
  });

  const stlyRevenue = stlyProduction.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const stlyRoomNights = stlyProduction.reduce((sum, p) => sum + (p.room_nights || 0), 0);

  const filteredBudgets = budgets.filter(b => {
    const budgetDate = new Date(b.year, b.month - 1);
    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const dateMatch = budgetDate >= startDate && budgetDate <= endDate;
    const hotelMatch = selectedHotelId === 'all' || b.hotel_id === selectedHotelId;
    return dateMatch && hotelMatch;
  });

  const totalBudgetRevenue = filteredBudgets.reduce((sum, b) => sum + (b.budget_revenue || 0), 0);
  const totalBudgetRoomNights = filteredBudgets.reduce((sum, b) => sum + (b.budget_room_nights || 0), 0);

  const hotelsToDisplay = selectedHotelId === 'all' ? hotels : hotels.filter(h => h.id === selectedHotelId);
  const hotelMetrics = hotelsToDisplay.map(hotel => {
    const hotelProduction = filteredProduction.filter(p => p.hotel_id === hotel.id);
    const hotelBudgets = filteredBudgets.filter(b => b.hotel_id === hotel.id);

    const totalRoomNights = hotelProduction.reduce((sum, p) => sum + (p.room_nights || 0), 0);
    const totalRevenue = hotelProduction.reduce((sum, p) => sum + (p.revenue || 0), 0);
    const budgetRevenue = hotelBudgets.reduce((sum, b) => sum + (b.budget_revenue || 0), 0);
    const budgetRoomNights = hotelBudgets.reduce((sum, b) => sum + (b.budget_room_nights || 0), 0);
    const adr = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;

    const statusCounts = {
      solicitation: hotelProduction.filter(p => p.status === 'solicitation').length,
      prospect: hotelProduction.filter(p => p.status === 'prospect').length,
      tentative: hotelProduction.filter(p => p.status === 'tentative').length,
      definite: hotelProduction.filter(p => p.status === 'definite').length,
      actual: hotelProduction.filter(p => p.status === 'actual').length,
      lost: hotelProduction.filter(p => p.status === 'lost').length
    };

    const totalLeads = hotelProduction.length;
    const conversionRate = statusCounts.solicitation > 0
      ? ((statusCounts.definite + statusCounts.actual) / statusCounts.solicitation * 100)
      : 0;

    const pipelineValue = hotelProduction
      .filter(p => ['prospect', 'tentative', 'definite'].includes(p.status))
      .reduce((sum, p) => sum + (p.revenue || 0), 0);

    return {
      id: hotel.id,
      name: hotel.name,
      totalRoomNights,
      totalRevenue,
      budgetRevenue,
      budgetRoomNights,
      adr,
      totalLeads,
      conversionRate,
      pipelineValue,
      hotelProduction,
      ...statusCounts
    };
  });

  const sortedHotels = [...hotelMetrics].sort((a, b) => b.totalRevenue - a.totalRevenue);

  const comparisonData = hotelMetrics.map(hotel => ({
    hotel: hotel.name,
    actual: hotel.totalRevenue,
    budget: hotel.budgetRevenue,
    roomNights: hotel.totalRoomNights,
    budgetRoomNights: hotel.budgetRoomNights
  }));

  // Stacked bar for pipeline status (replaces radar)
  const scorecardData = hotelMetrics.map(h => ({
    name: h.name,
    'Definite': h.definite,
    'Tentative': h.tentative,
    'Prospect': h.prospect,
  }));

  const currentRevenue = filteredProduction.reduce((sum, p) => sum + (p.revenue || 0), 0);
  const currentRoomNights = filteredProduction.reduce((sum, p) => sum + (p.room_nights || 0), 0);

  const totalSolicitations = filteredProduction.filter(p => p.status === 'solicitation').length;
  const totalDefinite = filteredProduction.filter(p => ['definite', 'actual'].includes(p.status)).length;
  const overallConversionRate = totalSolicitations > 0 ? (totalDefinite / totalSolicitations * 100) : 0;
  const paceData = [
    { metric: 'Revenue', Current: currentRevenue, STLY: stlyRevenue, Budget: totalBudgetRevenue },
    { metric: 'Room Nights', Current: currentRoomNights, STLY: stlyRoomNights, Budget: totalBudgetRoomNights }
  ];

  const monthlyByHotel = {};
  filteredProduction.forEach(item => {
    const month = format(new Date(item.arrival_date), 'MMM yyyy');
    if (!monthlyByHotel[month]) monthlyByHotel[month] = {};
    const hotel = hotels.find(h => h.id === item.hotel_id);
    const hotelName = hotel?.name || 'Unknown';
    if (!monthlyByHotel[month][hotelName]) monthlyByHotel[month][hotelName] = 0;
    monthlyByHotel[month][hotelName] += item.revenue || 0;
  });

  const trendData = Object.keys(monthlyByHotel).sort().map(month => {
    const data = { month };
    hotelsToDisplay.forEach(hotel => {
      data[hotel.name] = monthlyByHotel[month][hotel.name] || 0;
    });
    return data;
  });

  // Sales activities filtered
  const filteredActivities = allActivities.filter(a => {
    const dateMatch = a.activity_date >= dateRange.start && a.activity_date <= dateRange.end;
    const hotelMatch = selectedHotelId === 'all' || a.hotel_id === selectedHotelId;
    return dateMatch && hotelMatch;
  });

  const activityTypeCounts = filteredActivities.reduce((acc, a) => {
    const type = a.activity_type || 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const activityRows = Object.entries(activityTypeCounts)
    .map(([type, count]) => ({ type: type.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count);

  const exportToExcel = () => {
    setExporting(true);
    try {
      const hotelLabel = selectedHotelId === 'all' ? 'All Hotels' : hotels.find(h => h.id === selectedHotelId)?.name || 'Hotel';
      const wb = XLSX.utils.book_new();

      // ── Sheet 1: Summary ──
      const summaryData = [
        ['GBSales-CRM — Hotel Performance Report'],
        [`Property: ${hotelLabel}   |   Period: ${dateRange.start} to ${dateRange.end}   |   Generated: ${format(new Date(), 'MMM d, yyyy')}`],
        [],
        ['TOTALS'],
        ['Total Room Nights', currentRoomNights],
        ['Total Revenue', currentRevenue],
        ['Budget Room Nights', totalBudgetRoomNights],
        ['Budget Revenue', totalBudgetRevenue],
        ['STLY Room Nights', stlyRoomNights],
        ['STLY Revenue', stlyRevenue],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // ── Sheet 2: Hotel Metrics ──
      const metricsHeaders = ['Hotel', 'Room Nights', 'Budget RN', 'RN Var %', 'Revenue', 'Budget Revenue', 'Rev Var %', 'ADR', 'Conversion %', 'Pipeline Value', 'Definite', 'Tentative', 'Prospect', 'Lost'];
      const metricsRows = sortedHotels.map(hotel => {
        const rnVar = hotel.budgetRoomNights > 0 ? ((hotel.totalRoomNights - hotel.budgetRoomNights) / hotel.budgetRoomNights * 100) : 0;
        const revVar = hotel.budgetRevenue > 0 ? ((hotel.totalRevenue - hotel.budgetRevenue) / hotel.budgetRevenue * 100) : 0;
        return [
          hotel.name,
          hotel.totalRoomNights,
          hotel.budgetRoomNights,
          +rnVar.toFixed(1),
          hotel.totalRevenue,
          hotel.budgetRevenue,
          +revVar.toFixed(1),
          +hotel.adr.toFixed(2),
          +hotel.conversionRate.toFixed(1),
          hotel.pipelineValue,
          hotel.definite,
          hotel.tentative,
          hotel.prospect,
          hotel.lost,
        ];
      });
      const wsMetrics = XLSX.utils.aoa_to_sheet([metricsHeaders, ...metricsRows]);
      XLSX.utils.book_append_sheet(wb, wsMetrics, 'Hotel Metrics');

      // ── Sheet 3: All Bookings ──
      const bookingHeaders = ['Hotel', 'Booking / Client', 'Status', 'Arrival', 'Departure', 'Room Nights', 'Revenue', 'ADR', 'Seller', 'Event Type'];
      const bookingRows = sortedHotels.flatMap(hotel =>
        (hotel.hotelProduction || []).map(item => {
          const rn = item.room_nights || 0;
          const rev = item.revenue || 0;
          return [
            hotel.name,
            item.booking_name || item.client_name || '',
            item.status || '',
            item.arrival_date || '',
            item.departure_date || '',
            rn,
            rev,
            rn > 0 ? +(rev / rn).toFixed(2) : 0,
            item.seller_name || '',
            item.event_type || '',
          ];
        })
      );
      const wsBookings = XLSX.utils.aoa_to_sheet([bookingHeaders, ...bookingRows]);
      XLSX.utils.book_append_sheet(wb, wsBookings, 'All Bookings');

      // ── Sheet 4: Sales Activities ──
      const actHeaders = ['Activity Type', 'Count'];
      const actData = activityRows.map(r => [r.type, r.count]);
      actData.push([], ['Total Activities', filteredActivities.length]);
      const wsActs = XLSX.utils.aoa_to_sheet([actHeaders, ...actData]);
      XLSX.utils.book_append_sheet(wb, wsActs, 'Sales Activities');

      XLSX.writeFile(wb, `hotel-performance-${hotelLabel.replace(/ /g, '-')}-${dateRange.start}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Building2 className="w-8 h-8 text-blue-400" />
            Hotel Performance
          </h1>
          <p className="text-slate-400 mt-1">Compare metrics across all properties</p>
        </div>

        <div className="space-y-6">

          {/* Filters */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div>
                  <Label className="mb-2 block text-slate-300">Hotel</Label>
                  <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select hotel" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700">
                      <SelectItem value="all" className="text-white">All Hotels</SelectItem>
                      {hotels.map(hotel => (
                        <SelectItem key={hotel.id} value={hotel.id} className="text-white">{hotel.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-2 block text-slate-300">Quick Filters</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Next 30 Days', days: 30 },
                      { label: 'Next 60 Days', days: 60 },
                      { label: 'Next 90 Days', days: 90 },
                    ].map(({ label, days }) => (
                      <Button key={label} variant="outline" size="sm"
                        className="bg-slate-800 border-slate-700 text-white hover:bg-blue-600 hover:text-white"
                        onClick={() => {
                          const today = new Date();
                          const end = new Date(today);
                          end.setDate(today.getDate() + days);
                          setDateRange({ start: today.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
                        }}>{label}</Button>
                    ))}
                    <Button variant="outline" size="sm"
                      className="bg-slate-800 border-slate-700 text-white hover:bg-blue-600 hover:text-white"
                      onClick={() => {
                        const y = new Date().getFullYear();
                        setDateRange({ start: `${y}-01-01`, end: `${y}-12-31` });
                      }}>This Year</Button>
                    <Button variant="outline" size="sm"
                      className="bg-slate-800 border-slate-700 text-white hover:bg-blue-600 hover:text-white"
                      onClick={() => {
                        const y = new Date().getFullYear() + 1;
                        setDateRange({ start: `${y}-01-01`, end: `${y}-12-31` });
                      }}>Next Year</Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="mb-2 block text-slate-300">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white">
                          <CalendarIcon className="mr-2 h-4 w-4" />{dateRange.start}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                        <Calendar mode="single" selected={new Date(dateRange.start)}
                          onSelect={(date) => date && setDateRange({ ...dateRange, start: date.toISOString().split('T')[0] })}
                          className="text-white" />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="mb-2 block text-slate-300">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white">
                          <CalendarIcon className="mr-2 h-4 w-4" />{dateRange.end}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                        <Calendar mode="single" selected={new Date(dateRange.end)}
                          onSelect={(date) => date && setDateRange({ ...dateRange, end: date.toISOString().split('T')[0] })}
                          className="text-white" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={exportToExcel} disabled={exporting}>
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? 'Generating Excel...' : 'Export Full Report (Excel)'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Top Stats */}
          {selectedHotelId === 'all' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-sm text-slate-400">Total Revenue (All Hotels)</p>
                      <p className="text-xl font-bold text-white">${currentRevenue.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-green-400" />
                    <div>
                      <p className="text-sm text-slate-400">Total Room Nights (All Hotels)</p>
                      <p className="text-xl font-bold text-white">{currentRoomNights.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-sm text-slate-400">Overall Conversion Rate</p>
                      <p className="text-xl font-bold text-white">{overallConversionRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-8 h-8 text-blue-400" />
                    <div>
                      <p className="text-sm text-slate-400">Total Revenue</p>
                      <p className="text-xl font-bold text-white">${hotelMetrics[0]?.totalRevenue.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-8 h-8 text-green-400" />
                    <div>
                      <p className="text-sm text-slate-400">Total Room Nights</p>
                      <p className="text-xl font-bold text-white">{hotelMetrics[0]?.totalRoomNights.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 text-purple-400" />
                    <div>
                      <p className="text-sm text-slate-400">Conversion Rate</p>
                      <p className="text-xl font-bold text-white">{hotelMetrics[0]?.conversionRate.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Pace vs STLY vs Budget */}
          <Card data-chart-section className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Pace Analysis: Current vs STLY vs Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={paceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                  <XAxis dataKey="metric" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                  <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                  <Bar dataKey="Current" fill="#3b82f6" name="Current Period" />
                  <Bar dataKey="STLY" fill="#f59e0b" name="Same Time Last Year" />
                  <Bar dataKey="Budget" fill="#10b981" name="Budget" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparison Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-chart-section className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Actual vs Budget by Hotel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                    <XAxis dataKey="hotel" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                    <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                    <Bar dataKey="actual" fill="#3b82f6" name="Actual Revenue ($)" />
                    <Bar dataKey="budget" fill="#10b981" name="Budget Revenue ($)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Pipeline Status by Hotel — replaces unreadable Radar */}
            <Card data-chart-section className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white">Pipeline Status by Hotel</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={scorecardData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                    <XAxis type="number" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" stroke="#94a3b8" tick={{ fill: '#e2e8f0', fontSize: 11 }} width={90} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                    <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                    <Bar dataKey="Definite" stackId="a" fill="#10b981" />
                    <Bar dataKey="Tentative" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Prospect" stackId="a" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Revenue Trend */}
          <Card data-chart-section className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Monthly Revenue Trend by Hotel</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                  <Legend wrapperStyle={{ color: '#e2e8f0' }} />
                  {hotelsToDisplay.map((hotel, index) => (
                    <Line key={hotel.id} type="monotone" dataKey={hotel.name}
                      stroke={COLORS[index % COLORS.length]} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sales Activities Table */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2"><Activity className="w-5 h-5 text-blue-400" /> Sales Activities</CardTitle>
            </CardHeader>
            <CardContent>
              {activityRows.length === 0 ? (
                <p className="text-slate-400 text-sm">No sales activities found for this period.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-300">Activity Type</TableHead>
                      <TableHead className="text-right text-slate-300">Count</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activityRows.map(row => (
                      <TableRow key={row.type} className="border-slate-700 hover:bg-slate-800/50">
                        <TableCell className="text-white capitalize">{row.type}</TableCell>
                        <TableCell className="text-right text-slate-300">{row.count}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-slate-700 bg-slate-800/50">
                      <TableCell className="text-white font-bold">Total</TableCell>
                      <TableCell className="text-right text-white font-bold">{filteredActivities.length}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Detailed Table */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white">Detailed Metrics Table</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-slate-300">Hotel</TableHead>
                    <TableHead className="text-right text-slate-300">Room Nights</TableHead>
                    <TableHead className="text-right text-slate-300">Budget RN</TableHead>
                    <TableHead className="text-right text-slate-300">RN Var %</TableHead>
                    <TableHead className="text-right text-slate-300">Revenue</TableHead>
                    <TableHead className="text-right text-slate-300">Budget Rev</TableHead>
                    <TableHead className="text-right text-slate-300">Rev Var %</TableHead>
                    <TableHead className="text-right text-slate-300">ADR</TableHead>
                    <TableHead className="text-right text-slate-300">Conversion %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedHotels.map((hotel) => {
                    const rnVariance = hotel.budgetRoomNights > 0
                      ? ((hotel.totalRoomNights - hotel.budgetRoomNights) / hotel.budgetRoomNights * 100) : 0;
                    const revVariance = hotel.budgetRevenue > 0
                      ? ((hotel.totalRevenue - hotel.budgetRevenue) / hotel.budgetRevenue * 100) : 0;
                    return (
                      <TableRow key={hotel.id} className="border-slate-700 hover:bg-slate-800/50">
                        <TableCell className="font-medium text-white">{hotel.name}</TableCell>
                        <TableCell className="text-right text-slate-300">{hotel.totalRoomNights.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-slate-300">{hotel.budgetRoomNights.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${rnVariance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {rnVariance >= 0 ? '+' : ''}{rnVariance.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-slate-300">${hotel.totalRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-slate-300">${hotel.budgetRevenue.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${revVariance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {revVariance >= 0 ? '+' : ''}{revVariance.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-slate-300">${hotel.adr.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-slate-300">{hotel.conversionRate.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}