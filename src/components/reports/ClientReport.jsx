import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileDown, FileText, FileSpreadsheet, Users, Filter, Search, ArrowUpDown } from "lucide-react";
import { format, parseISO, isWithinInterval } from "date-fns";
import jsPDF from 'jspdf';

const STATUS_OPTIONS = [
  'new_lead', 'reached_out', 'solicitation_call', 'sent_proposal',
  'follow_up', 'prospect', 'tentative', 'definite', 'active', 'inactive', 'vip', 'lost'
];

const STATUS_COLORS = {
  new_lead: 'bg-blue-100 text-blue-800',
  reached_out: 'bg-cyan-100 text-cyan-800',
  solicitation_call: 'bg-indigo-100 text-indigo-800',
  sent_proposal: 'bg-purple-100 text-purple-800',
  follow_up: 'bg-pink-100 text-pink-800',
  prospect: 'bg-yellow-100 text-yellow-800',
  tentative: 'bg-orange-100 text-orange-800',
  definite: 'bg-green-100 text-green-800',
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-gray-100 text-gray-800',
  vip: 'bg-purple-100 text-purple-800',
  lost: 'bg-red-100 text-red-800',
};

const SOURCE_LABELS = {
  website: 'Website',
  direct: 'Direct',
  via_solicitation: 'Via Solicitation',
  cvb: 'CVB',
  other: 'Other'
};

export default function ClientReport({ onLogReport }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [otherSourceDetails, setOtherSourceDetails] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedHotels, setSelectedHotels] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [sortColumn, setSortColumn] = useState('company_name');
  const [sortDirection, setSortDirection] = useState('asc');

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list('-created_date'),
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const sources = useMemo(() => {
    const set = new Set(clients.map(c => c.source).filter(Boolean));
    return [...set].sort();
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      if (statusFilter !== 'all' && client.status !== statusFilter) return false;
      if (sourceFilter !== 'all' && client.source !== sourceFilter) return false;
      if (selectedHotels.length > 0 && !selectedHotels.includes(client.id)) return false;
      if (dateFrom || dateTo) {
        const created = client.created_date ? parseISO(client.created_date) : null;
        if (created) {
          if (dateFrom && created < parseISO(dateFrom)) return false;
          if (dateTo && created > parseISO(dateTo)) return false;
        }
      }
      return true;
    });
  }, [clients, statusFilter, sourceFilter, dateFrom, dateTo, selectedHotels]);

  const totalRooms = filteredClients.reduce((s, c) => {
    return s + Object.values(c.daily_rooms || {}).reduce((a, v) => a + (Number(v) || 0), 0);
  }, 0);

  const totalRevenue = filteredClients.reduce((s, c) => {
    const rooms = Object.values(c.daily_rooms || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    return s + rooms * (Number(c.rate_offered) || 0);
  }, 0);

  const toRows = (clientList) => clientList.map(c => {
    const rooms = Object.values(c.daily_rooms || {}).reduce((a, v) => a + (Number(v) || 0), 0);
    const rev = rooms * (Number(c.rate_offered) || 0);
    return [
      c.company_name || '',
      c.contact_person || '',
      c.email || '',
      c.phone || '',
      c.source ? SOURCE_LABELS[c.source] || c.source : '',
      c.status?.replace(/_/g, ' ') || '',
      c.activity_type?.replace(/_/g, ' ') || '',
      c.arrival_date || '',
      c.departure_date || '',
      rooms,
      c.rate_offered || 0,
      rev,
      c.address || '',
      c.notes || '',
      c.created_date ? format(parseISO(c.created_date), 'yyyy-MM-dd') : '',
    ];
  });

  const headers = [
    'Company', 'Contact', 'Email', 'Phone', 'Source', 'Status', 'Activity Type',
    'Arrival', 'Departure', 'Total Rooms', 'Rate Offered', 'Potential Revenue', 'Address', 'Notes', 'Created'
  ];

  const downloadCSV = () => {
    const rows = toRows(filteredClients);
    const csv = [headers, ...rows].map(r =>
      r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `client-report-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click();
    onLogReport?.('csv', filteredClients.length);
  };

  const downloadExcel = () => {
    // Fall back to CSV download since xlsx package is unavailable
    downloadCSV();
    onLogReport?.('excel', filteredClients.length);
  };

  const downloadPDF = () => {
    const rows = toRows(filteredClients);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text(`Client Report — ${format(new Date(), 'MMM d, yyyy')}`, 14, 15);
    doc.setFontSize(9);
    const shortHeaders = ['Company', 'Contact', 'Email', 'Source', 'Status', 'Rooms', 'Rate', 'Revenue', 'Arrival', 'Departure'];
    const shortCols = [0, 1, 2, 4, 5, 9, 10, 11, 7, 8];
    const colW = 28;
    let y = 25;
    doc.setFont(undefined, 'bold');
    shortHeaders.forEach((h, i) => doc.text(h, 10 + i * colW, y));
    doc.setFont(undefined, 'normal');
    y += 7;
    rows.slice(0, 35).forEach(row => {
      if (y > 190) { doc.addPage(); y = 15; }
      shortCols.forEach((ci, i) => doc.text(String(row[ci] || '').substring(0, 16), 10 + i * colW, y));
      y += 7;
    });
    if (rows.length > 35) doc.text(`... and ${rows.length - 35} more rows`, 10, y + 5);
    doc.save(`client-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    onLogReport?.('pdf', filteredClients.length);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
       <Card className="bg-slate-800 border-slate-700">
         <CardHeader>
           <CardTitle className="text-white flex items-center gap-2">
             <Filter className="w-5 h-5 text-cyan-400" /> Filter Clients
           </CardTitle>
         </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input type="text" placeholder="Search by company, contact, or email..." value={searchText} onChange={e => setSearchText(e.target.value)}
                className="pl-10 bg-slate-700 border-slate-600 text-white placeholder-slate-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-white">Hotels</label>
                <Select value={selectedHotels.join(',')} onValueChange={(val) => setSelectedHotels(val === 'all' ? [] : val ? val.split(',') : [])}>
                   <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100 [&_svg]:text-cyan-300">
                        <SelectValue placeholder="Select hotels" className="text-slate-200" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="all" className="text-slate-100">All Hotels</SelectItem>
                    {hotels.map(h => (
                      <SelectItem key={h.id} value={h.id} className="text-slate-100">{h.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-white">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                   <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100 [&_svg]:text-cyan-300">
                      <SelectValue className="text-slate-200" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                     <SelectItem value="all" className="text-slate-100">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map(s => (
                      <SelectItem key={s} value={s} className="text-slate-100">{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-white">Source</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                   <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-100 [&_svg]:text-cyan-300">
                      <SelectValue className="text-slate-200" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                     <SelectItem value="all" className="text-slate-100">All Sources</SelectItem>
                    <SelectItem value="website" className="text-slate-100">Website</SelectItem>
                    <SelectItem value="direct" className="text-slate-100">Direct</SelectItem>
                    <SelectItem value="via_solicitation" className="text-slate-100">Via Solicitation</SelectItem>
                    <SelectItem value="cvb" className="text-slate-100">CVB</SelectItem>
                    <SelectItem value="other" className="text-slate-100">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {sourceFilter === 'other' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-white">Other Source Details</label>
                  <Input
                    type="text"
                    placeholder="Specify the source..."
                    value={otherSourceDetails}
                    onChange={e => setOtherSourceDetails(e.target.value)}
                    className="bg-slate-700 border-slate-600 text-slate-100 placeholder-slate-200"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-white">Created From</label>
                <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-slate-700 border-slate-600 text-white accent-cyan-400" style={{colorScheme: 'dark'}} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-white">Created To</label>
                <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-white accent-cyan-400" style={{colorScheme: 'dark'}} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary + Export */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-slate-700 rounded-lg">
              <Users className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{filteredClients.length}</p>
              <p className="text-sm text-slate-400">Clients matched</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-slate-700 rounded-lg">
              <FileSpreadsheet className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{totalRooms.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Total room nights</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 bg-slate-700 rounded-lg">
              <FileText className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
              <p className="text-sm text-slate-400">Potential revenue</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Export Buttons */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Export Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={downloadCSV} className="bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600" variant="outline">
              <FileDown className="w-4 h-4 mr-2" /> Export CSV
            </Button>
            <Button onClick={downloadExcel} className="bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600" variant="outline">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Export Excel
            </Button>
            <Button onClick={downloadPDF} className="bg-cyan-600 hover:bg-cyan-700 text-white border-cyan-600" variant="outline">
              <FileText className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">Exporting {filteredClients.length} client(s) with applied filters.</p>
        </CardContent>
      </Card>

      {/* Preview Table */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Preview ({filteredClients.length} clients)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-700">
                <TableRow className="border-slate-600">
                  <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => { setSortColumn('company_name'); setSortDirection(sortColumn === 'company_name' && sortDirection === 'asc' ? 'desc' : 'asc'); }}><div className="flex items-center gap-1">Company <ArrowUpDown className="w-3 h-3" /></div></TableHead>
                  <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => { setSortColumn('contact_person'); setSortDirection(sortColumn === 'contact_person' && sortDirection === 'asc' ? 'desc' : 'asc'); }}><div className="flex items-center gap-1">Contact <ArrowUpDown className="w-3 h-3" /></div></TableHead>
                  <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => { setSortColumn('source'); setSortDirection(sortColumn === 'source' && sortDirection === 'asc' ? 'desc' : 'asc'); }}><div className="flex items-center gap-1">Source <ArrowUpDown className="w-3 h-3" /></div></TableHead>
                  <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => { setSortColumn('status'); setSortDirection(sortColumn === 'status' && sortDirection === 'asc' ? 'desc' : 'asc'); }}><div className="flex items-center gap-1">Status <ArrowUpDown className="w-3 h-3" /></div></TableHead>
                  <TableHead className="text-slate-300 cursor-pointer hover:text-white" onClick={() => { setSortColumn('arrival_date'); setSortDirection(sortColumn === 'arrival_date' && sortDirection === 'asc' ? 'desc' : 'asc'); }}><div className="flex items-center gap-1">Arrival <ArrowUpDown className="w-3 h-3" /></div></TableHead>
                  <TableHead className="text-right text-slate-300">Rooms</TableHead>
                  <TableHead className="text-right text-slate-300">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.length === 0 ? (
                  <TableRow className="border-slate-600">
                    <TableCell colSpan={7} className="text-center text-slate-400 py-8">No clients match the selected filters.</TableCell>
                  </TableRow>
                ) : filteredClients.map(client => {
                  const rooms = Object.values(client.daily_rooms || {}).reduce((a, v) => a + (Number(v) || 0), 0);
                  const rev = rooms * (Number(client.rate_offered) || 0);
                  return (
                    <TableRow key={client.id} className="border-slate-700 hover:bg-slate-700/50">
                      <TableCell className="text-white font-medium">
                        <Link to={`${createPageUrl('ClientProfile')}?id=${client.id}`} className="text-cyan-400 hover:text-cyan-300 hover:underline">{client.company_name}</Link>
                      </TableCell>
                      <TableCell className="text-slate-400">{client.contact_person || '-'}</TableCell>
                      <TableCell className="text-slate-400">{SOURCE_LABELS[client.source] || client.source || '-'}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[client.status] || 'bg-slate-700 text-slate-300'}>
                          {client.status?.split('_').join(' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-400">{client.arrival_date || '-'}</TableCell>
                      <TableCell className="text-right text-slate-400">{rooms}</TableCell>
                      <TableCell className="text-right text-cyan-400 font-semibold">${rev.toLocaleString()}</TableCell>
                    </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}