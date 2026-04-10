import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FileDown, FileText, Activity, TrendingUp, Phone, Send, Eye, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import jsPDF from 'jspdf';

const ACTIVITY_COLORS = {
  solicitation_call: { bg: 'bg-blue-100 text-blue-800', label: 'Solicitation Call', icon: Phone, color: '#3b82f6' },
  sent_proposal: { bg: 'bg-purple-100 text-purple-800', label: 'Sent Proposal', icon: Send, color: '#8b5cf6' },
  follow_up: { bg: 'bg-yellow-100 text-yellow-800', label: 'Follow Up', icon: TrendingUp, color: '#f59e0b' },
  site_visit: { bg: 'bg-green-100 text-green-800', label: 'Site Visit', icon: Eye, color: '#10b981' },
  tentative: { bg: 'bg-orange-100 text-orange-800', label: 'Tentative', icon: Activity, color: '#f97316' },
  definite: { bg: 'bg-emerald-100 text-emerald-800', label: 'Definite', icon: CheckCircle, color: '#059669' },
  lost: { bg: 'bg-red-100 text-red-800', label: 'Lost', icon: Activity, color: '#ef4444' },
};

export default function ClientActivityReport({ onLogReport }) {
   const [selectedClient, setSelectedClient] = useState('all');
   const [selectedHotel, setSelectedHotel] = useState('all');
   const [clientOpen, setClientOpen] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date'),
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ['activity_logs'],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date'),
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list(),
  });

  const { data: production = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list('-created_date'),
  });

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || 'Unknown';

  // Get unique client names from Client entity
   const clientNames = useMemo(() => {
     return clients.map(c => c.company_name).filter(Boolean).sort();
   }, [clients]);

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      if (selectedClient !== 'all' && log.client_name !== selectedClient) return false;
      if (selectedHotel !== 'all' && log.hotel_id !== selectedHotel) return false;
      return true;
    });
  }, [activityLogs, selectedClient, selectedHotel]);

  // KPI stats
  const stats = useMemo(() => {
    const byType = {};
    filteredLogs.forEach(log => {
      const type = log.status || 'other';
      byType[type] = (byType[type] || 0) + 1;
    });
    return byType;
  }, [filteredLogs]);

  const chartData = Object.entries(stats).map(([type, count]) => ({
    name: ACTIVITY_COLORS[type]?.label || type.replace(/_/g, ' '),
    count,
    color: ACTIVITY_COLORS[type]?.color || '#94a3b8',
  }));

  // Related production for selected client
  const clientProduction = useMemo(() => {
    if (selectedClient === 'all') return [];
    return production.filter(p => p.client_name === selectedClient);
  }, [production, selectedClient]);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 297, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Client Activity Report', 14, 16);
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, 220, 16);

    // Filter info
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Client: ${selectedClient === 'all' ? 'All Clients' : selectedClient}  |  Hotel: ${selectedHotel === 'all' ? 'All Hotels' : getHotelName(selectedHotel)}  |  Total Activities: ${filteredLogs.length}`, 14, 32);

    // Summary boxes
    const summaryItems = Object.entries(stats);
    doc.setFontSize(9);
    let xPos = 14;
    summaryItems.slice(0, 6).forEach(([type, count]) => {
      doc.setFillColor(241, 245, 249);
      doc.rect(xPos, 36, 40, 16, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFont(undefined, 'bold');
      doc.text(String(count), xPos + 20, 44, { align: 'center' });
      doc.setFont(undefined, 'normal');
      doc.setFontSize(7);
      doc.text((ACTIVITY_COLORS[type]?.label || type).substring(0, 14), xPos + 20, 50, { align: 'center' });
      doc.setFontSize(9);
      xPos += 44;
    });

    // Table
    const tableHeaders = ['Date', 'Client', 'Hotel', 'Activity Type', 'Seller', 'Notes'];
    const colWidths = [24, 50, 40, 36, 36, 90];
    let y = 62;

    doc.setFillColor(30, 41, 59);
    doc.rect(14, y - 5, 269, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(8);
    let x = 14;
    tableHeaders.forEach((h, i) => { doc.text(h, x + 1, y); x += colWidths[i]; });
    doc.setFont(undefined, 'normal');
    doc.setTextColor(15, 23, 42);
    y += 8;

    filteredLogs.forEach((log, idx) => {
      if (y > 195) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, y - 5, 269, 8, 'F');
      }
      const row = [
        log.activity_date || '',
        (log.client_name || '').substring(0, 22),
        getHotelName(log.hotel_id).substring(0, 18),
        (ACTIVITY_COLORS[log.status]?.label || log.status || '').substring(0, 18),
        (log.seller_name || '').substring(0, 18),
        (log.notes || '').substring(0, 44),
      ];
      x = 14;
      doc.setFontSize(7.5);
      row.forEach((cell, i) => { doc.text(String(cell), x + 1, y); x += colWidths[i]; });
      y += 8;
    });

    doc.save(`client-activity-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    onLogReport?.('pdf', filteredLogs.length);
  };

  const exportCSV = () => {
    const headers = ['Date', 'Client', 'Hotel', 'Activity Type', 'Seller', 'Notes'];
    const rows = filteredLogs.map(log => [
      log.activity_date || '',
      log.client_name || '',
      getHotelName(log.hotel_id),
      ACTIVITY_COLORS[log.status]?.label || log.status || '',
      log.seller_name || '',
      log.notes || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `client-activity-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    onLogReport?.('csv', filteredLogs.length);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" /> Client Activity Report
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Clients</label>
              <Popover open={clientOpen} onOpenChange={setClientOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-between bg-slate-700 border-slate-600 text-white hover:bg-slate-600 hover:text-white">
                    {selectedClient === 'all' ? 'All Clients' : selectedClient}
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 bg-slate-700 border-slate-600">
                  <Command className="bg-slate-700">
                    <CommandInput placeholder="Search clients..." className="border-slate-600 text-white placeholder:text-slate-500" />
                    <CommandList>
                      <CommandEmpty className="text-slate-400">No clients found.</CommandEmpty>
                      <CommandGroup className="text-white">
                        <CommandItem value="all" onSelect={() => { setSelectedClient('all'); setClientOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", selectedClient === 'all' ? 'opacity-100' : 'opacity-0')} />
                          All Clients
                        </CommandItem>
                        {clientNames.map(name => (
                          <CommandItem key={name} value={name} onSelect={() => { setSelectedClient(name); setClientOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedClient === name ? 'opacity-100' : 'opacity-0')} />
                            {name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Hotel</label>
              <Select value={selectedHotel} onValueChange={setSelectedHotel}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hotels</SelectItem>
                  {hotels.map(h => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(stats).slice(0, 4).map(([type, count]) => {
          const cfg = ACTIVITY_COLORS[type];
          const Icon = cfg?.icon || Activity;
          return (
            <Card key={type} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-slate-700 rounded-lg">
                  <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xl font-bold text-white">{count}</p>
                  <p className="text-xs text-slate-400">{cfg?.label || type.replace(/_/g, ' ')}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activity Distribution Chart */}
      {chartData.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm">Activity Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#fff' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Related Production (when a specific client is selected) */}
      {selectedClient !== 'all' && clientProduction.length > 0 && (
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" /> Bookings for {selectedClient}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Hotel</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400">Arrival</TableHead>
                    <TableHead className="text-slate-400">Departure</TableHead>
                    <TableHead className="text-right text-slate-400">Room Nights</TableHead>
                    <TableHead className="text-right text-slate-400">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientProduction.map(p => (
                    <TableRow key={p.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell className="text-white">{hotels.find(h => h.id === p.hotel_id)?.name || '-'}</TableCell>
                      <TableCell><Badge className="bg-blue-100 text-blue-800 text-xs">{p.status}</Badge></TableCell>
                      <TableCell className="text-slate-300 text-sm">{p.arrival_date || '-'}</TableCell>
                      <TableCell className="text-slate-300 text-sm">{p.departure_date || '-'}</TableCell>
                      <TableCell className="text-right text-slate-300">{p.room_nights || 0}</TableCell>
                      <TableCell className="text-right text-green-400 font-semibold">${(p.revenue || 0).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-slate-400">{filteredLogs.length} activities found</p>
          <div className="flex gap-3">
            <Button onClick={exportCSV} className="bg-slate-600 hover:bg-slate-500 text-white" size="sm">
              <FileDown className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={exportPDF} className="bg-red-800 hover:bg-red-700 text-white" size="sm">
              <FileText className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Activity Log Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Activity Log ({filteredLogs.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-900">
                <TableRow className="border-slate-700">
                  <TableHead className="text-slate-400">Date</TableHead>
                  <TableHead className="text-slate-400">Client</TableHead>
                  <TableHead className="text-slate-400">Hotel</TableHead>
                  <TableHead className="text-slate-400">Activity</TableHead>
                  <TableHead className="text-slate-400">Seller</TableHead>
                  <TableHead className="text-slate-400">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow className="border-slate-700">
                    <TableCell colSpan={6} className="text-center text-slate-500 py-8">No activity logs found.</TableCell>
                  </TableRow>
                ) : filteredLogs.map(log => (
                  <TableRow key={log.id} className="border-slate-700 hover:bg-slate-700/50">
                    <TableCell className="text-slate-300 text-sm whitespace-nowrap">{log.activity_date || '-'}</TableCell>
                    <TableCell className="text-white font-medium">{log.client_name || '-'}</TableCell>
                    <TableCell className="text-slate-300 text-sm">{getHotelName(log.hotel_id)}</TableCell>
                    <TableCell>
                      <Badge className={ACTIVITY_COLORS[log.status]?.bg || 'bg-gray-100 text-gray-800'}>
                        {ACTIVITY_COLORS[log.status]?.label || log.status?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-300 text-sm">{log.seller_name || '-'}</TableCell>
                    <TableCell className="text-slate-400 text-sm max-w-xs truncate">{log.notes || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}