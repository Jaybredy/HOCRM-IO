import React, { useState, useMemo } from 'react';

import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CalendarDays, ArrowUpDown, ExternalLink, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { format, parseISO } from 'date-fns';

const ALL_COLUMNS = [
  { key: 'booking_name', label: 'Booking Name' },
  { key: 'client_name', label: 'Client Name' },
  { key: 'property', label: 'Property' },
  { key: 'arrival_date', label: 'Arrival Date' },
  { key: 'departure_date', label: 'Departure Date' },
  { key: 'room_nights', label: 'Room Nights' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'status', label: 'Status' },
  { key: 'seller_name', label: 'Seller' },
  { key: 'event_type', label: 'Event Type' },
  { key: 'contact_person', label: 'Contact Person' },
  { key: 'notes', label: 'Notes' },
];

const STATUS_COLORS = {
  solicitation: 'bg-slate-700 text-slate-200',
  prospect: 'bg-yellow-900/60 text-yellow-300',
  tentative: 'bg-orange-900/60 text-orange-300',
  definite: 'bg-green-900/60 text-green-300',
  actual: 'bg-blue-900/60 text-blue-300',
  lost: 'bg-red-900/60 text-red-300',
};

export default function Bookings() {
  const [searchText, setSearchText] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('search') || '';
  });
  const [filterStatus, setFilterStatus] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('status') || 'all';
  });
  const [filterProperty, setFilterProperty] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('property') || 'all';
  });
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [pendingDateStart, setPendingDateStart] = useState('');
  const [pendingDateEnd, setPendingDateEnd] = useState('');
  const [dateField, setDateField] = useState('arrival_date');
  const [sortColumn, setSortColumn] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [showExportModal, setShowExportModal] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState(ALL_COLUMNS.map(c => c.key));

  const { data: productionItems = [], isLoading } = useQuery({
    queryKey: ['productionItems-all'],
    queryFn: () => base44.entities.ProductionItem.list('-arrival_date', 1000)
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: rentalProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list()
  });

  // Merge hotels + rental properties for the filter dropdown.
  // properties.hotel_id can mirror an existing hotel (created by invite-user
  // for user_property_access); dedupe by name so the dropdown doesn't show
  // the same hotel twice.
  const allProperties = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const h of hotels) {
      if (seen.has(h.name)) continue;
      seen.add(h.name);
      out.push({ id: h.id, name: h.name });
    }
    for (const p of rentalProperties) {
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      out.push({ id: p.id, name: p.name });
    }
    return out;
  }, [hotels, rentalProperties]);

  const getPropertyName = (item) => {
    const propId = item.hotel_id || item.property_id;
    return allProperties.find(p => p.id === propId)?.name || '—';
  };

  const handleSort = (col) => {
    if (sortColumn === col) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortColumn(col); setSortDirection('asc'); }
  };

  const toggleColumn = (key) => {
    setSelectedColumns(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleExport = () => {
    const colDefs = ALL_COLUMNS.filter(c => selectedColumns.includes(c.key));
    const rows = bookings.map(item => {
      const row = {};
      colDefs.forEach(col => {
        if (col.key === 'property') row[col.label] = getPropertyName(item);
        else if (col.key === 'arrival_date' || col.key === 'departure_date') {
          row[col.label] = item[col.key] ? format(parseISO(item[col.key]), 'MMM d, yyyy') : '';
        } else {
          row[col.label] = item[col.key] ?? '';
        }
      });
      return row;
    });
    const colDefs2 = ALL_COLUMNS.filter(c => selectedColumns.includes(c.key));
    const csv = [colDefs2.map(c => c.label), ...rows.map(row => colDefs2.map(c => `"${String(row[c.label] ?? '').replace(/"/g, '""')}"`))].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    setShowExportModal(false);
  };

  const SortIcon = ({ col }) => (
    <ArrowUpDown className={`ml-1 h-3 w-3 inline ${sortColumn === col ? 'text-blue-400' : 'text-slate-500'}`} />
  );

  const bookings = useMemo(() => {
    let items = productionItems.filter(i => !i.is_deleted);
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(i =>
        i.client_name?.toLowerCase().includes(q) ||
        i.booking_name?.toLowerCase().includes(q) ||
        i.contact_person?.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') items = items.filter(i => i.status === filterStatus);
    if (filterProperty !== 'all') items = items.filter(i => i.hotel_id === filterProperty || i.property_id === filterProperty);
    if (filterDateStart) items = items.filter(i => { const val = dateField === 'created_date' ? i.created_date?.split('T')[0] : i[dateField]; return val && val >= filterDateStart; });
    if (filterDateEnd) items = items.filter(i => { const val = dateField === 'created_date' ? i.created_date?.split('T')[0] : i[dateField]; return val && val <= filterDateEnd; });

    items.sort((a, b) => {
      let va = a[sortColumn] || '';
      let vb = b[sortColumn] || '';
      if (sortColumn === 'revenue') { va = a.revenue || 0; vb = b.revenue || 0; }
      if (va < vb) return sortDirection === 'asc' ? -1 : 1;
      if (va > vb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return items;
  }, [productionItems, searchText, filterStatus, filterProperty, filterDateStart, filterDateEnd, sortColumn, sortDirection]);

  const totalRevenue = bookings.reduce((s, b) => s + (b.revenue || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-6 h-6 text-blue-400" /> All Bookings
            </h1>
            <p className="text-slate-400 text-sm mt-1">Complete record of all booking entries across all properties</p>
          </div>
          <Button onClick={() => setShowExportModal(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shrink-0">
            <Download className="w-4 h-4" /> Export Excel
          </Button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Bookings', value: bookings.length, color: 'text-blue-400' },
            { label: 'Definite', value: bookings.filter(b => b.status === 'definite').length, color: 'text-green-400' },
            { label: 'Tentative', value: bookings.filter(b => b.status === 'tentative').length, color: 'text-orange-400' },
            { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, color: 'text-emerald-400' },
          ].map(s => (
            <Card key={s.label} className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-4">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Table Card */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardContent className="p-0">

            {/* Filters */}
            <div className="flex flex-col gap-2 p-3 border-b border-slate-700 sm:flex-row sm:flex-wrap">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search client, booking or contact..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="pl-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[160px] bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {['solicitation','prospect','tentative','definite','actual','lost'].map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterProperty} onValueChange={setFilterProperty}>
                <SelectTrigger className="w-full sm:w-[180px] bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue placeholder="All Properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {allProperties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={pendingDateStart} onChange={e => setPendingDateStart(e.target.value)}
                className="w-full sm:w-[150px] bg-slate-700/50 border-slate-600 text-white [&::-webkit-calendar-picker-indicator]:invert"
                placeholder="Created from" />
              <Input type="date" value={pendingDateEnd} onChange={e => setPendingDateEnd(e.target.value)}
                className="w-full sm:w-[150px] bg-slate-700/50 border-slate-600 text-white [&::-webkit-calendar-picker-indicator]:invert"
                placeholder="Created to" />
              <Select value={dateField} onValueChange={setDateField}>
                <SelectTrigger className="w-full sm:w-[170px] bg-slate-700/50 border-slate-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arrival_date">By Arrival Date</SelectItem>
                  <SelectItem value="created_date">By Created Date</SelectItem>
                  <SelectItem value="departure_date">By Departure Date</SelectItem>
                  <SelectItem value="activity_date">By Activity Date</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={() => { setFilterDateStart(pendingDateStart); setFilterDateEnd(pendingDateEnd); }}
                className="bg-blue-600 hover:bg-blue-500 text-white shrink-0"
              >
                <Search className="w-4 h-4 mr-1" /> Search
              </Button>
              {(filterDateStart || filterDateEnd) && (
                <button onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setPendingDateStart(''); setPendingDateEnd(''); }}
                  className="text-xs text-slate-400 hover:text-white underline whitespace-nowrap">
                  Clear dates
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="py-16 text-center text-slate-400">Loading bookings...</div>
            ) : bookings.length === 0 ? (
              <div className="py-16 text-center text-slate-400">No bookings match your criteria.</div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400 font-semibold cursor-pointer" onClick={() => handleSort('client_name')}>
                          Client <SortIcon col="client_name" />
                        </TableHead>
                        <TableHead className="text-slate-400 font-semibold cursor-pointer" onClick={() => handleSort('booking_name')}>
                          Booking Name <SortIcon col="booking_name" />
                        </TableHead>
                        <TableHead className="text-slate-400 font-semibold">Property</TableHead>
                        <TableHead className="text-slate-400 font-semibold cursor-pointer" onClick={() => handleSort('arrival_date')}>
                          Arrival <SortIcon col="arrival_date" />
                        </TableHead>
                        <TableHead className="text-slate-400 font-semibold cursor-pointer" onClick={() => handleSort('departure_date')}>
                          Departure <SortIcon col="departure_date" />
                        </TableHead>
                        <TableHead className="text-slate-400 font-semibold text-right cursor-pointer" onClick={() => handleSort('revenue')}>
                          Revenue <SortIcon col="revenue" />
                        </TableHead>
                        <TableHead className="text-slate-400 font-semibold cursor-pointer" onClick={() => handleSort('status')}>
                          Status <SortIcon col="status" />
                        </TableHead>
                        <TableHead className="text-slate-400 font-semibold">Seller</TableHead>
                        <TableHead className="w-8"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map(item => (
                        <TableRow key={item.id} className="border-slate-800 hover:bg-slate-700/40 transition-colors">
                          <TableCell className="text-white font-medium">
                            {item.client_id ? (
                              <Link to={createPageUrl('ClientProfile') + `?client_id=${item.client_id}`} className="hover:text-blue-400 transition-colors underline underline-offset-2">
                                {item.client_name || '—'}
                              </Link>
                            ) : ((!item.client_id && item.event_type === 'group') ? '—' : (item.client_name || '—'))}
                          </TableCell>
                          <TableCell className="text-white font-medium">
                            <Link to={createPageUrl('CRM') + `?edit=${item.id}`} className="hover:text-blue-400 transition-colors underline underline-offset-2">
                              {(!item.client_id && item.event_type === 'group') ? (item.booking_name || item.client_name || '—') : (item.booking_name || '—')}
                            </Link>
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">{getPropertyName(item)}</TableCell>
                          <TableCell className="text-slate-300 text-sm whitespace-nowrap">
                            {item.arrival_date ? format(parseISO(item.arrival_date), 'MMM d, yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm whitespace-nowrap">
                            {item.departure_date ? format(parseISO(item.departure_date), 'MMM d, yyyy') : '—'}
                          </TableCell>
                          <TableCell className="text-right text-emerald-400 font-semibold text-sm">
                            ${(item.revenue || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${STATUS_COLORS[item.status] || 'bg-slate-100 text-slate-700'} text-xs`}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-400 text-sm">{item.seller_name || '—'}</TableCell>
                          <TableCell>
                            <Link to={createPageUrl('CRM') + `?edit=${item.id}`}>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-blue-400 transition-colors" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile / Tablet Cards */}
                <div className="lg:hidden divide-y divide-slate-800">
                  {bookings.map(item => (
                    <div key={item.id} className="p-4 hover:bg-slate-700/30 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate">
                            <Link to={createPageUrl('CRM') + `?edit=${item.id}`} className="hover:text-blue-400 transition-colors">
                              {item.booking_name || item.client_name || '—'}
                            </Link>
                          </p>
                          {item.booking_name && item.client_name && (
                            <p className="text-slate-400 text-xs mt-0.5">
                              {item.client_id ? (
                                <Link to={createPageUrl('ClientProfile') + `?client_id=${item.client_id}`} className="hover:text-blue-400 underline underline-offset-2">{item.client_name}</Link>
                              ) : item.client_name}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`${STATUS_COLORS[item.status] || 'bg-slate-700 text-slate-200'} text-xs`}>
                            {item.status}
                          </Badge>
                          <Link to={createPageUrl('CRM') + `?edit=${item.id}`}>
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400 hover:text-blue-400" />
                          </Link>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="text-slate-400">Property: <span className="text-slate-200">{getPropertyName(item)}</span></div>
                        <div className="text-slate-400">Revenue: <span className="text-emerald-400 font-semibold">${(item.revenue || 0).toLocaleString()}</span></div>
                        <div className="text-slate-400">Arrival: <span className="text-slate-200">{item.arrival_date ? format(parseISO(item.arrival_date), 'MMM d, yyyy') : '—'}</span></div>
                        <div className="text-slate-400">Departure: <span className="text-slate-200">{item.departure_date ? format(parseISO(item.departure_date), 'MMM d, yyyy') : '—'}</span></div>
                        {item.seller_name && <div className="text-slate-400">Seller: <span className="text-slate-200">{item.seller_name}</span></div>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {bookings.length > 0 && (
              <div className="px-4 py-3 border-t border-slate-700 text-xs text-slate-500">
                Showing {bookings.length} bookings
              </div>
            )}

          </CardContent>
        </Card>

      </div>

      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export to Excel</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Exporting <strong>{bookings.length}</strong> bookings based on current filters. Select columns to include:
          </p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {ALL_COLUMNS.map(col => (
              <div key={col.key} className="flex items-center gap-2">
                <Checkbox
                  id={col.key}
                  checked={selectedColumns.includes(col.key)}
                  onCheckedChange={() => toggleColumn(col.key)}
                />
                <Label htmlFor={col.key} className="text-sm cursor-pointer">{col.label}</Label>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setSelectedColumns(ALL_COLUMNS.map(c => c.key))}>
              Select All
            </Button>
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500" onClick={handleExport} disabled={selectedColumns.length === 0}>
              <Download className="w-4 h-4 mr-1" /> Download
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}