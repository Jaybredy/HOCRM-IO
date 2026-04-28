import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown, FileSpreadsheet, BarChart3, FileText, CalendarDays, History, Users, Activity, ChevronDown, TrendingUp } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import WeeklyReportEmbed from "@/components/reports/WeeklyReportEmbed";
import ReportHistory from "@/components/reports/ReportHistory";
import DateFilters from "../components/common/DateFilters";
import ConversionFunnel from "../components/reports/ConversionFunnel";
import PipelineValueChart from "../components/reports/PipelineValueChart";
import DealSizeMetrics from "../components/reports/DealSizeMetrics";
import SellerPerformanceTable from "../components/reports/SellerPerformanceTable";
import ClientReport from "../components/reports/ClientReport";
import ClientActivityReport from "../components/reports/ClientActivityReport";
import ActivityVsArrivalsOverview from "../components/reports/ActivityVsArrivalsOverview";
import { startOfYear, endOfYear, startOfWeek, endOfWeek, isWithinInterval, parseISO, format } from "date-fns";

import jsPDF from 'jspdf';

export default function Reports() {
  const [dateRange, setDateRange] = useState({
    start: startOfYear(new Date()).toISOString().split('T')[0],
    end: endOfYear(new Date()).toISOString().split('T')[0]
  });
  const [reportType, setReportType] = useState('all');
  const [sellerType, setSellerType] = useState('all');
  const [selectedHotels, setSelectedHotels] = useState([]);
  const [dashboardHotel, setDashboardHotel] = useState('all');
  const [groupBy, setGroupBy] = useState('none');
  const [periodTypeFilter, setPeriodTypeFilter] = useState('all');
  const [weeklyDateFrom, setWeeklyDateFrom] = useState('');
  const [weeklyDateTo, setWeeklyDateTo] = useState('');
  const [productionDateField, setProductionDateField] = useState('activity_date');
  // Default to 'definite' so Reports totals match the Dashboard out of the box.
  // Users can change to 'all' (or any status) to see broader pipeline numbers.
  const [selectedStatus, setSelectedStatus] = useState('definite');

  const { data: production = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list('-created_date')
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list()
  });

  const { data: allActivityLogs = [] } = useQuery({
    queryKey: ['activity_logs'],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date')
  });

  const { data: allRFPs = [] } = useQuery({
    queryKey: ['rfps'],
    queryFn: () => base44.entities.RFP.list('-created_date')
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date')
  });

  const queryClient = useQueryClient();

  const logReport = async ({ report_type, label, date_from, date_to, export_format, row_count }) => {
    try {
      const user = await base44.auth.me();
      await base44.entities.ReportRecord.create({
        report_type,
        label,
        date_from: date_from || '',
        date_to: date_to || '',
        export_format,
        row_count: row_count || 0,
        generated_by: user?.full_name || user?.email || '',
      });
    } catch (e) { /* silent */ }
  };

  const filteredProduction = production.filter(item => {
    const dateVal = productionDateField === 'created_date' ? item.created_date?.split('T')[0] : item[productionDateField];
    if (!dateVal || dateVal < dateRange.start || dateVal > dateRange.end) return false;
    if (sellerType !== 'all' && item.seller_type !== sellerType) return false;
    if (selectedHotels.length > 0 && !selectedHotels.includes(item.hotel_id)) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    return true;
  });

  const dashboardProduction = filteredProduction.filter(item => {
    if (dashboardHotel !== 'all' && item.hotel_id !== dashboardHotel) return false;
    return true;
  });

  const filteredGoals = goals.filter(goal => {
    if (sellerType !== 'all' && goal.seller_type !== sellerType) return false;
    if (periodTypeFilter !== 'all' && goal.period_type !== periodTypeFilter) return false;
    return true;
  });

  // Weekly activity export helpers
  const today = new Date();
  const weeklyWeekStart = weeklyDateFrom ? parseISO(weeklyDateFrom) : startOfWeek(today, { weekStartsOn: 1 });
  const weeklyWeekEnd = weeklyDateTo ? parseISO(weeklyDateTo) : endOfWeek(today, { weekStartsOn: 1 });
  const weeklyLabel = `${format(weeklyWeekStart, 'MMM d')} – ${format(weeklyWeekEnd, 'MMM d, yyyy')}`;

  const inWeek = (dateStr) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), { start: weeklyWeekStart, end: weeklyWeekEnd }); }
    catch { return false; }
  };

  const weekProduction = production.filter(p => inWeek(p.activity_date));
  const weekActivityLogs = allActivityLogs.filter(a => inWeek(a.activity_date));
  const weekRFPs = allRFPs.filter(r => inWeek(r.created_date) || inWeek(r.submission_date));
  const weekTasks = allTasks.filter(t => inWeek(t.due_date));

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || 'Unknown';

  const generateWeeklyActivityReport = (exportFormat = 'csv', overrideDateFrom, overrideDateTo) => {
    const effectiveDateFrom = overrideDateFrom || weeklyDateFrom;
    const effectiveDateTo = overrideDateTo || weeklyDateTo;

    const effectiveWeekStart = effectiveDateFrom ? parseISO(effectiveDateFrom) : weeklyWeekStart;
    const effectiveWeekEnd = effectiveDateTo ? parseISO(effectiveDateTo) : weeklyWeekEnd;
    const inEffectiveWeek = (dateStr) => {
      if (!dateStr) return false;
      try { return isWithinInterval(parseISO(dateStr), { start: effectiveWeekStart, end: effectiveWeekEnd }); }
      catch { return false; }
    };
    const effProduction = production.filter(p => inEffectiveWeek(p.activity_date));
    const effActivityLogs = allActivityLogs.filter(a => inEffectiveWeek(a.activity_date));
    const effRFPs = allRFPs.filter(r => inEffectiveWeek(r.created_date) || inEffectiveWeek(r.submission_date));
    const effTasks = allTasks.filter(t => inEffectiveWeek(t.due_date));
    const effLabel = `${format(effectiveWeekStart, 'MMM d')} – ${format(effectiveWeekEnd, 'MMM d, yyyy')}`;

    const sections = [];

    // Group Bookings
    const gbHeaders = ['Section', 'Date', 'Hotel', 'Client', 'Status', 'Room Nights', 'Revenue', 'Seller', 'Event Type', 'Notes'];
    const gbRows = effProduction.map(p => [
      'Group Booking',
      p.activity_date,
      getHotelName(p.hotel_id),
      p.client_name,
      p.status,
      p.room_nights || 0,
      p.revenue || 0,
      p.seller_name || '',
      p.event_type || '',
      p.notes || ''
    ]);

    // Activity Logs
    const alRows = effActivityLogs.map(a => [
      'Activity Log',
      a.activity_date,
      getHotelName(a.hotel_id),
      a.client_name,
      a.status?.replace(/_/g, ' ') || '',
      '', '', // no room nights / revenue
      a.seller_name || '',
      '',
      a.notes || ''
    ]);

    // RFPs
    const rfpRows = effRFPs.map(r => [
      'RFP',
      r.submission_date || r.created_date || '',
      getHotelName(r.hotel_id),
      r.company_name,
      r.status?.replace(/_/g, ' ') || '',
      r.potential_room_nights || 0,
      '',
      r.seller_name || '',
      '',
      r.notes || ''
    ]);

    // Tasks
    const taskRows = effTasks.map(t => [
      'Task',
      t.due_date,
      '',
      t.title,
      t.status?.replace(/_/g, ' ') || '',
      '', '',
      t.assigned_to || '',
      t.priority || '',
      t.description || ''
    ]);

    const allRows = [...gbRows, ...alRows, ...rfpRows, ...taskRows];

    const summaryRows = [
      ['WEEKLY ACTIVITY SUMMARY', effLabel],
      ['Group Bookings', effProduction.length],
      ['Total Room Nights', effProduction.reduce((s, p) => s + (p.room_nights || 0), 0)],
      ['Total Revenue', effProduction.reduce((s, p) => s + (p.revenue || 0), 0)],
      ['Activity Logs', effActivityLogs.length],
      ['RFPs', effRFPs.length],
      ['Tasks Due', effTasks.length],
      [],
    ];

    const label = `Weekly Activity ${effLabel}`;
    if (exportFormat === 'csv') {
      const summaryCSV = summaryRows.map(r => r.join(',')).join('\n');
      const dataCSV = [gbHeaders, ...allRows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const csv = summaryCSV + '\n\n' + dataCSV;
      downloadCSV(csv, `weekly-activity-${format(effectiveWeekStart, 'yyyy-MM-dd')}.csv`);
    } else if (exportFormat === 'excel') {
      const allData = [...summaryRows, [], [gbHeaders], ...allRows];
      const csv = allData.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadCSV(csv, `weekly-activity-${format(effectiveWeekStart, 'yyyy-MM-dd')}.csv`);
    }
    logReport({ report_type: 'weekly_activity', label, date_from: effectiveDateFrom, date_to: effectiveDateTo, export_format: exportFormat, row_count: allRows.length });
  };

  const generateProductionReport = (exportFormat = 'csv') => {
    let headers = ['Date', 'Hotel', 'Client', 'Seller', 'Seller Type', 'Status', 'Arrival', 'Departure', 'Room Nights', 'Revenue', 'ADR', 'Event Type'];
    let rows = filteredProduction.map(item => {
      const hotel = hotels.find(h => h.id === item.hotel_id);
      const adr = item.room_nights > 0 ? (item.revenue / item.room_nights).toFixed(2) : '0';
      return [item.activity_date, hotel?.name || '', item.client_name, item.seller_name || '', item.seller_type === 'business_development' ? 'BD - EPIC' : 'Hotel Sales', item.status, item.arrival_date, item.departure_date, item.room_nights, item.revenue, adr, item.event_type || ''];
    });

    if (groupBy === 'seller') {
      const grouped = {};
      filteredProduction.forEach(item => {
        const seller = item.seller_name || 'Unknown';
        if (!grouped[seller]) grouped[seller] = [];
        const hotel = hotels.find(h => h.id === item.hotel_id);
        const adr = item.room_nights > 0 ? (item.revenue / item.room_nights).toFixed(2) : '0';
        grouped[seller].push([item.activity_date, hotel?.name || '', item.client_name, item.seller_name || '', item.seller_type === 'business_development' ? 'BD - EPIC' : 'Hotel Sales', item.status, item.arrival_date, item.departure_date, item.room_nights, item.revenue, adr, item.event_type || '']);
      });
      rows = [];
      Object.entries(grouped).forEach(([seller, items]) => { rows.push([`SELLER: ${seller}`, '', '', '', '', '', '', '', '', '', '', '']); rows.push(...items); rows.push([]); });
    } else if (groupBy === 'hotel') {
      const grouped = {};
      filteredProduction.forEach(item => {
        const hotel = hotels.find(h => h.id === item.hotel_id);
        const hotelName = hotel?.name || 'Unknown';
        if (!grouped[hotelName]) grouped[hotelName] = [];
        const adr = item.room_nights > 0 ? (item.revenue / item.room_nights).toFixed(2) : '0';
        grouped[hotelName].push([item.activity_date, hotelName, item.client_name, item.seller_name || '', item.seller_type === 'business_development' ? 'BD - EPIC' : 'Hotel Sales', item.status, item.arrival_date, item.departure_date, item.room_nights, item.revenue, adr, item.event_type || '']);
      });
      rows = [];
      Object.entries(grouped).forEach(([hotelName, items]) => { rows.push([`HOTEL: ${hotelName}`, '', '', '', '', '', '', '', '', '', '', '']); rows.push(...items); rows.push([]); });
    }

    if (exportFormat === 'csv') downloadCSV([headers, ...rows].map(r => r.join(',')).join('\n'), `production-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    else if (exportFormat === 'excel') downloadExcel([headers, ...rows], `production-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    else if (exportFormat === 'pdf') downloadPDF(headers, rows, `Production Report - ${format(new Date(), 'yyyy-MM-dd')}`);
    logReport({ report_type: 'production', label: `Production Report ${dateRange.start} → ${dateRange.end}`, date_from: dateRange.start, date_to: dateRange.end, export_format: exportFormat, row_count: rows.length });
  };

  const generateSellerPerformanceReport = (exportFormat = 'csv') => {
    const sellerStats = {};
    filteredProduction.forEach(item => {
      const seller = item.seller_name || 'Unknown';
      if (!sellerStats[seller]) sellerStats[seller] = { seller_type: item.seller_type || 'hotel_sales', room_nights: 0, revenue: 0, leads: 0, solicitations: 0, definites: 0, actuals: 0 };
      sellerStats[seller].room_nights += item.room_nights || 0;
      sellerStats[seller].revenue += item.revenue || 0;
      sellerStats[seller].leads += 1;
      if (item.status === 'solicitation') sellerStats[seller].solicitations += 1;
      if (item.status === 'definite') sellerStats[seller].definites += 1;
      if (item.status === 'actual') sellerStats[seller].actuals += 1;
    });
    const headers = ['Seller', 'Seller Type', 'Total Leads', 'Room Nights', 'Revenue', 'ADR', 'Solicitations', 'Definites', 'Actuals', 'Conversion Rate'];
    const rows = Object.entries(sellerStats).map(([seller, stats]) => {
      const adr = stats.room_nights > 0 ? (stats.revenue / stats.room_nights).toFixed(2) : '0';
      const conversionRate = stats.solicitations > 0 ? ((stats.definites + stats.actuals) / stats.solicitations * 100).toFixed(1) : '0';
      return [seller, stats.seller_type === 'business_development' ? 'BD - EPIC' : 'Hotel Sales', stats.leads, stats.room_nights, stats.revenue, adr, stats.solicitations, stats.definites, stats.actuals, conversionRate + '%'];
    });
    if (exportFormat === 'csv') downloadCSV([headers, ...rows].map(r => r.join(',')).join('\n'), `seller-performance-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    else if (exportFormat === 'excel') downloadExcel([headers, ...rows], `seller-performance-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    else if (exportFormat === 'pdf') downloadPDF(headers, rows, `Seller Performance - ${format(new Date(), 'yyyy-MM-dd')}`);
    logReport({ report_type: 'seller_performance', label: `Seller Performance ${dateRange.start} → ${dateRange.end}`, date_from: dateRange.start, date_to: dateRange.end, export_format: exportFormat, row_count: rows.length });
  };

  const generateGoalsReport = (exportFormat = 'csv') => {
    const headers = ['Seller', 'Seller Type', 'Period Type', 'Start Date', 'End Date', 'Target RN', 'Target Revenue', 'Target Leads', 'Actual RN', 'Actual Revenue', 'Actual Leads', 'RN %', 'Revenue %', 'Leads %'];
    const rows = filteredGoals.map(goal => {
      const sp = production.filter(p => p.seller_name === goal.seller_name && p.seller_type === goal.seller_type && p.activity_date >= goal.period_start && p.activity_date <= goal.period_end);
      const actualRN = sp.reduce((s, p) => s + (p.room_nights || 0), 0);
      const actualRev = sp.reduce((s, p) => s + (p.revenue || 0), 0);
      const actualLeads = sp.length;
      return [goal.seller_name, goal.seller_type === 'business_development' ? 'BD - EPIC' : 'Hotel Sales', goal.period_type, goal.period_start, goal.period_end, goal.target_room_nights || 0, goal.target_revenue || 0, goal.target_leads || 0, actualRN, actualRev, actualLeads, (goal.target_room_nights > 0 ? (actualRN / goal.target_room_nights * 100).toFixed(1) : '0') + '%', (goal.target_revenue > 0 ? (actualRev / goal.target_revenue * 100).toFixed(1) : '0') + '%', (goal.target_leads > 0 ? (actualLeads / goal.target_leads * 100).toFixed(1) : '0') + '%'];
    });
    if (exportFormat === 'csv') downloadCSV([headers, ...rows].map(r => r.join(',')).join('\n'), `goals-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    else if (exportFormat === 'excel') downloadExcel([headers, ...rows], `goals-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    else if (exportFormat === 'pdf') downloadPDF(headers, rows, `Goals Report - ${format(new Date(), 'yyyy-MM-dd')}`);
    logReport({ report_type: 'goals', label: `Goals Report ${format(new Date(), 'yyyy-MM-dd')}`, date_from: dateRange.start, date_to: dateRange.end, export_format: exportFormat, row_count: rows.length });
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
  };

  const downloadExcel = (data, filename) => {
    // Fall back to CSV for Excel export since xlsx package is unavailable
    const csv = data.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const csvFilename = filename.replace('.xlsx', '.csv');
    downloadCSV(csv, csvFilename);
  };

  const downloadPDF = (headers, rows, title) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.text(title, 14, 15);
    doc.setFontSize(10);
    let yPos = 25;
    const pageWidth = doc.internal.pageSize.getWidth();
    const colWidth = Math.min((pageWidth - 20) / headers.length, 25);
    doc.setFont(undefined, 'bold');
    headers.forEach((h, i) => doc.text(String(h), 10 + (i * colWidth), yPos));
    doc.setFont(undefined, 'normal'); yPos += 7;
    rows.slice(0, 30).forEach((row) => {
      if (yPos > 180) { doc.addPage(); yPos = 15; }
      row.forEach((cell, i) => doc.text(String(cell || '').substring(0, 15), 10 + (i * colWidth), yPos));
      yPos += 7;
    });
    if (rows.length > 30) doc.text(`... and ${rows.length - 30} more rows`, 10, yPos + 10);
    doc.save(`${title}.pdf`);
  };

  const handleReDownload = (record) => {
    if (record.report_type === 'production') {
      generateProductionReport(record.export_format);
    } else if (record.report_type === 'seller_performance') {
      generateSellerPerformanceReport(record.export_format);
    } else if (record.report_type === 'goals') {
      generateGoalsReport(record.export_format);
    } else if (record.report_type === 'weekly_activity') {
      generateWeeklyActivityReport(record.export_format, record.date_from, record.date_to);
    }
  };

  const ExportButtons = ({ onCSV, onExcel }) => (
    <div className="mt-4 space-y-2">
      <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={onCSV}>
        <FileDown className="w-4 h-4 mr-2" /> Export CSV
      </Button>
      <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={onExcel}>
        <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-blue-400" />
              Reports & Analytics
            </h1>
            <p className="text-slate-300 mt-1">Comprehensive insights and data exports</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-500 text-white">
                <FileDown className="w-4 h-4 mr-2" />
                Export Report
                <ChevronDown className="w-4 h-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-slate-800 border-slate-700">
              <DropdownMenuItem onClick={() => generateProductionReport('csv')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileDown className="w-4 h-4 mr-2 text-blue-400" /> Production Report (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateProductionReport('excel')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-400" /> Production Report (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateProductionReport('pdf')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileText className="w-4 h-4 mr-2 text-red-400" /> Production Report (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateSellerPerformanceReport('csv')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileDown className="w-4 h-4 mr-2 text-green-400" /> Seller Performance (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateSellerPerformanceReport('excel')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-400" /> Seller Performance (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateSellerPerformanceReport('pdf')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileText className="w-4 h-4 mr-2 text-red-400" /> Seller Performance (PDF)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateGoalsReport('csv')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileDown className="w-4 h-4 mr-2 text-purple-400" /> Goals Report (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateGoalsReport('excel')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2 text-green-400" /> Goals Report (Excel)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => generateGoalsReport('pdf')} className="text-slate-200 hover:bg-slate-700 cursor-pointer">
                <FileText className="w-4 h-4 mr-2 text-red-400" /> Goals Report (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-300 whitespace-nowrap">Filter by Hotel:</label>
          <Select value={dashboardHotel} onValueChange={setDashboardHotel}>
            <SelectTrigger className="w-64 bg-slate-800 border-slate-600 text-white">
              <SelectValue placeholder="All Hotels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hotels</SelectItem>
              {hotels.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <DateFilters dateRange={dateRange} setDateRange={setDateRange} />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-300 whitespace-nowrap">Filter Date By:</label>
            <Select value={productionDateField} onValueChange={setProductionDateField}>
              <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="activity_date">Activity Date</SelectItem>
                <SelectItem value="arrival_date">Arrival Date</SelectItem>
                <SelectItem value="created_date">Created Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-300 whitespace-nowrap">Status:</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-40 bg-slate-800 border-slate-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="definite">Definite</SelectItem>
                <SelectItem value="tentative">Tentative</SelectItem>
                <SelectItem value="prospect">Prospect</SelectItem>
                <SelectItem value="actual_pickup">Actual Pickup</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid w-full grid-cols-7 bg-slate-700 border border-slate-600">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-100 font-medium">Analytics Dashboard</TabsTrigger>
            <TabsTrigger value="exports" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-100 font-medium">Custom Exports</TabsTrigger>
            <TabsTrigger value="weekly" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-100 font-medium">
              <CalendarDays className="w-4 h-4 mr-1.5" />Weekly Report
            </TabsTrigger>
            <TabsTrigger value="clients" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-100 font-medium">
              <Users className="w-4 h-4 mr-1.5" />Client Report
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-100 font-medium">
              <Activity className="w-4 h-4 mr-1.5" />Activity Log
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-100 font-medium">
              <History className="w-4 h-4 mr-1.5" />Report History
            </TabsTrigger>
            <TabsTrigger value="perf-overview" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-100 font-medium">
              <TrendingUp className="w-4 h-4 mr-1.5" />Activity vs Arrivals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 bg-cyan-50 p-6 rounded-lg border border-cyan-200">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ConversionFunnel production={dashboardProduction} />
              <PipelineValueChart production={dashboardProduction} />
            </div>
            <DealSizeMetrics production={dashboardProduction} />
            <SellerPerformanceTable production={dashboardProduction} />
          </TabsContent>

          <TabsContent value="exports" className="space-y-6 bg-cyan-50 p-6 rounded-lg border border-cyan-200">
           <Card className="bg-slate-900/80 border-slate-800">
             <CardHeader>
               <CardTitle className="text-white">Filter & Grouping Options</CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200">Hotels</label>
                  <Select value={selectedHotels.length === 0 ? 'all' : selectedHotels.join(',')} onValueChange={(val) => setSelectedHotels(val === 'all' ? [] : val ? val.split(',') : [])}>
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue placeholder="Select hotels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Hotels</SelectItem>
                      {hotels.map(h => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-200">Seller Type</label>
                    <Select value={sellerType} onValueChange={setSellerType}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Seller Types</SelectItem>
                        <SelectItem value="hotel_sales">Hotel Sales</SelectItem>
                        <SelectItem value="business_development">Business Development (EPIC)</SelectItem>
                      </SelectContent>
                      </Select>
                      </div>
                      <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">Group Production By</label>
                      <Select value={groupBy} onValueChange={setGroupBy}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Grouping</SelectItem>
                        <SelectItem value="seller">Group by Seller</SelectItem>
                        <SelectItem value="hotel">Group by Hotel</SelectItem>
                      </SelectContent>
                      </Select>
                      </div>
                      <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-200">Goal Period Type</label>
                      <Select value={periodTypeFilter} onValueChange={setPeriodTypeFilter}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Production Report */}
              <Card className="bg-slate-900/80 border-slate-800 hover:bg-slate-900 transition-all">
                <CardContent className="p-6">
                  <div className="p-3 bg-blue-600/20 border border-blue-500/30 rounded-lg w-fit mb-3">
                    <FileSpreadsheet className="w-6 h-6 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-lg text-white">Production Report</h3>
                  <p className="text-sm text-slate-300 mt-1">Complete list of all production activities</p>
                  <div className="mt-4 space-y-2">
                    <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateProductionReport('csv')}>
                      <FileDown className="w-4 h-4 mr-2 text-cyan-400" />Export CSV
                    </Button>
                    <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateProductionReport('excel')}>
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-cyan-400" />Export Excel
                    </Button>
                    <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateProductionReport('pdf')}>
                      <FileText className="w-4 h-4 mr-2 text-cyan-400" />Export PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Seller Performance */}
              <Card className="bg-slate-900/80 border-slate-800 hover:bg-slate-900 transition-all">
                <CardContent className="p-6">
                  <div className="p-3 bg-green-600/20 border border-green-500/30 rounded-lg w-fit mb-3">
                    <FileSpreadsheet className="w-6 h-6 text-green-400" />
                  </div>
                  <h3 className="font-semibold text-lg text-white">Seller Performance</h3>
                  <p className="text-sm text-slate-300 mt-1">Performance metrics by seller</p>
                  <div className="mt-4 space-y-2">
                    <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateSellerPerformanceReport('csv')}>
                       <FileDown className="w-4 h-4 mr-2 text-cyan-400" />Export CSV
                     </Button>
                     <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateSellerPerformanceReport('excel')}>
                       <FileSpreadsheet className="w-4 h-4 mr-2 text-cyan-400" />Export Excel
                     </Button>
                     <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateSellerPerformanceReport('pdf')}>
                       <FileText className="w-4 h-4 mr-2 text-cyan-400" />Export PDF
                     </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Goals Report */}
              <Card className="bg-slate-900/80 border-slate-800 hover:bg-slate-900 transition-all">
                <CardContent className="p-6">
                  <div className="p-3 bg-purple-600/20 border border-purple-500/30 rounded-lg w-fit mb-3">
                    <FileSpreadsheet className="w-6 h-6 text-purple-400" />
                  </div>
                  <h3 className="font-semibold text-lg text-white">Goals Report</h3>
                  <p className="text-sm text-slate-300 mt-1">Goal tracking and achievement</p>
                  <div className="mt-4 space-y-2">
                    <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateGoalsReport('csv')}>
                       <FileDown className="w-4 h-4 mr-2 text-cyan-400" />Export CSV
                     </Button>
                     <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateGoalsReport('excel')}>
                       <FileSpreadsheet className="w-4 h-4 mr-2 text-cyan-400" />Export Excel
                     </Button>
                     <Button className="w-full bg-slate-600 text-white hover:bg-slate-500 border-slate-500 font-medium" variant="outline" size="sm" onClick={() => generateGoalsReport('pdf')}>
                       <FileText className="w-4 h-4 mr-2 text-cyan-400" />Export PDF
                     </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-slate-900/80 border-slate-800">
              <CardContent className="p-6 text-center">
                <p className="text-sm text-slate-300">Reports are generated based on your selected date range and filters.</p>
                <p className="text-xs text-slate-400 mt-2">Data includes: {filteredProduction.length} production items</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="weekly" className="bg-cyan-50 p-6 rounded-lg border border-cyan-200">
            <WeeklyReportEmbed onExport={generateWeeklyActivityReport} />
          </TabsContent>

          <TabsContent value="clients" className="space-y-6 bg-cyan-50 p-6 rounded-lg border border-cyan-200">
            <ClientReport onLogReport={(fmt, count) => logReport({ report_type: 'production', label: `Client Report ${format(new Date(), 'yyyy-MM-dd')}`, date_from: '', date_to: '', export_format: fmt, row_count: count })} />
          </TabsContent>

          <TabsContent value="activity" className="space-y-6 bg-cyan-50 p-6 rounded-lg border border-cyan-200">
            <ClientActivityReport onLogReport={(fmt, count) => logReport({ report_type: 'weekly_activity', label: `Activity Log Report ${format(new Date(), 'yyyy-MM-dd')}`, date_from: '', date_to: '', export_format: fmt, row_count: count })} />
          </TabsContent>

          <TabsContent value="history" className="space-y-4 bg-cyan-50 p-6 rounded-lg border border-cyan-200">
            <ReportHistory onReDownload={handleReDownload} />
          </TabsContent>

          <TabsContent value="perf-overview" className="space-y-6 bg-cyan-50 p-6 rounded-lg border border-cyan-200">
            <ActivityVsArrivalsOverview production={dashboardProduction} activityLogs={allActivityLogs} dateRange={dateRange} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}