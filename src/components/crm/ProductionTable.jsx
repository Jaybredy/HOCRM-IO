import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, MessageSquarePlus, AlertTriangle, Search, ArrowUpDown, SlidersHorizontal, X, ChevronDown, Check, Paperclip, Clock } from "lucide-react";
import { format, differenceInDays, parse } from "date-fns";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import QuickActivityLog from "../crm/QuickActivityLog";
import { createPageUrl } from "@/utils";

const ALL_STATUSES = ['solicitation', 'prospect', 'tentative', 'definite', 'actual', 'lost'];

const STATUS_COLORS = {
  solicitation: 'bg-slate-600/60 text-slate-200 border-slate-500',
  prospect:     'bg-blue-500/20 text-blue-300 border-blue-500/40',
  tentative:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  definite:     'bg-green-500/20 text-green-300 border-green-500/40',
  actual:       'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  lost:         'bg-red-500/20 text-red-300 border-red-500/40',
};

export default function ProductionTable({ data, hotels, onEdit, onDelete, onStatusChange }) {
  const [search, setSearch] = useState('');
  const [quickLogItem, setQuickLogItem] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'arrival', dir: 'desc' });


  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [arrivalFrom, setArrivalFrom] = useState('');
  const [arrivalTo, setArrivalTo] = useState('');
  const [departureFrom, setDepartureFrom] = useState('');
  const [departureTo, setDepartureTo] = useState('');
  const [minRoomNights, setMinRoomNights] = useState('');
  const [maxRoomNights, setMaxRoomNights] = useState('');
  const [minRevenue, setMinRevenue] = useState('');
  const [maxRevenue, setMaxRevenue] = useState('');

  const today = new Date();

  const getHotelName = (hotelId) => {
    const hotel = hotels.find(h => h.id === hotelId);
    return hotel ? hotel.name : 'Unknown';
  };

  const toggleStatus = (s) => {
    setSelectedStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setArrivalFrom(''); setArrivalTo('');
    setDepartureFrom(''); setDepartureTo('');
    setMinRoomNights(''); setMaxRoomNights('');
    setMinRevenue(''); setMaxRevenue('');
    setSearch('');
  };

  const activeFilterCount = [
    selectedStatuses.length > 0,
    arrivalFrom || arrivalTo,
    departureFrom || departureTo,
    minRoomNights || maxRoomNights,
    minRevenue || maxRevenue,
    search,
  ].filter(Boolean).length;

  const filtered = data.filter(item => {
    if (search && !item.client_name?.toLowerCase().includes(search.toLowerCase()) &&
        !getHotelName(item.hotel_id)?.toLowerCase().includes(search.toLowerCase())) return false;
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(item.status)) return false;
    if (arrivalFrom && item.arrival_date < arrivalFrom) return false;
    if (arrivalTo && item.arrival_date > arrivalTo) return false;
    if (departureFrom && item.departure_date < departureFrom) return false;
    if (departureTo && item.departure_date > departureTo) return false;
    if (minRoomNights && (item.room_nights || 0) < Number(minRoomNights)) return false;
    if (maxRoomNights && (item.room_nights || 0) > Number(maxRoomNights)) return false;
    if (minRevenue && (item.revenue || 0) < Number(minRevenue)) return false;
    if (maxRevenue && (item.revenue || 0) > Number(maxRevenue)) return false;
    return true;
  });

  const handleSort = (key) => {
    setSortConfig(prev =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const SortHeader = ({ label, sortKey, className = '' }) => {
    const active = sortConfig.key === sortKey;
    return (
      <button
        onClick={() => handleSort(sortKey)}
        className={`flex items-center gap-1.5 transition-colors uppercase tracking-wide font-semibold text-xs ${active ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'} ${className}`}
      >
        {label}
        <ArrowUpDown className={`w-3 h-3 ${active ? 'text-blue-400' : 'text-slate-600'}`} />
      </button>
    );
  };

  const getAllowedTransitions = (currentStatus) => {
    switch (currentStatus) {
      case 'prospect':   return ['tentative', 'lost'];
      case 'tentative':  return ['definite', 'lost'];
      case 'definite':   return ['lost'];
      default:           return [];
    }
  };

  const displayData = (() => {
    if (!sortConfig.key) return filtered;
    return [...filtered].sort((a, b) => {
      let av, bv;
      switch (sortConfig.key) {
        case 'hotel':    av = getHotelName(a.hotel_id); bv = getHotelName(b.hotel_id); break;
        case 'client':   av = a.client_name || ''; bv = b.client_name || ''; break;
        case 'status':   av = a.status || ''; bv = b.status || ''; break;
        case 'arrival':  av = a.arrival_date || ''; bv = b.arrival_date || ''; break;
        case 'departure': av = a.departure_date || ''; bv = b.departure_date || ''; break;
        case 'cutoff':   av = a.cutoff_date || ''; bv = b.cutoff_date || ''; break;
        case 'rooms':    av = a.room_nights || 0; bv = b.room_nights || 0; break;
        case 'revenue':  av = a.revenue || 0; bv = b.revenue || 0; break;
        default: return 0;
      }
      if (av < bv) return sortConfig.dir === 'asc' ? -1 : 1;
      if (av > bv) return sortConfig.dir === 'asc' ? 1 : -1;
      return 0;
    });
  })();

  const safeFormat = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = parse(dateStr, 'yyyy-MM-dd', new Date());
      if (isNaN(d.getTime())) return '—';
      return format(d, 'MMM d, yy');
    } catch { return '—'; }
  };

  const getCutoffAlert = (item) => {
    if (!item.cutoff_date || item.status !== 'definite') return null;
    const diff = differenceInDays(new Date(item.cutoff_date), today);
    if (diff < 0) return { label: 'Cutoff passed', color: 'text-red-400' };
    if (diff <= 7) return { label: `Cutoff in ${diff}d`, color: 'text-amber-400' };
    return null;
  };

  return (
    <>
      {quickLogItem && (
        <QuickActivityLog
          item={quickLogItem}
          hotels={hotels}
          onClose={() => setQuickLogItem(null)}
        />
      )}

      <div className="rounded-xl border border-slate-700 bg-slate-900/60 backdrop-blur overflow-hidden">
        {/* Table Header */}
        <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-sm font-semibold text-slate-100">Bookings</span>
            <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
              {filtered.length}
            </span>
            <span className="flex items-center gap-1 text-xs text-slate-400 ml-1">
              <Clock className="w-3 h-3" /> Most recent first
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search client / hotel..."
                className="pl-8 h-8 text-sm bg-slate-800 border-slate-600 text-slate-100 placeholder-slate-500 focus:border-blue-500 w-48"
              />
            </div>

            {/* Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={`h-8 gap-1.5 border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white ${showFilters ? 'bg-blue-600/20 border-blue-500 text-blue-300' : 'bg-slate-800'}`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-slate-400 hover:text-white px-2">
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/30 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Status multi-select */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Status</label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 w-full justify-between bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700 text-xs">
                    {selectedStatuses.length === 0 ? 'All Statuses' : `${selectedStatuses.length} selected`}
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-slate-800 border-slate-700">
                  {ALL_STATUSES.map(s => (
                    <DropdownMenuItem
                      key={s}
                      onClick={() => toggleStatus(s)}
                      className="text-slate-200 hover:bg-slate-700 capitalize flex items-center gap-2"
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${selectedStatuses.includes(s) ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                        {selectedStatuses.includes(s) && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      {s}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Arrival Range */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Arrival From – To</label>
              <div className="flex gap-1">
                <Input type="date" value={arrivalFrom} onChange={e => setArrivalFrom(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
                <Input type="date" value={arrivalTo} onChange={e => setArrivalTo(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
              </div>
            </div>

            {/* Departure Range */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Departure From – To</label>
              <div className="flex gap-1">
                <Input type="date" value={departureFrom} onChange={e => setDepartureFrom(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
                <Input type="date" value={departureTo} onChange={e => setDepartureTo(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
              </div>
            </div>

            {/* Room Nights Range */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Room Nights (min – max)</label>
              <div className="flex gap-1">
                <Input type="number" placeholder="Min" value={minRoomNights} onChange={e => setMinRoomNights(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
                <Input type="number" placeholder="Max" value={maxRoomNights} onChange={e => setMaxRoomNights(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
              </div>
            </div>

            {/* Revenue Range */}
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Revenue (min – max)</label>
              <div className="flex gap-1">
                <Input type="number" placeholder="Min" value={minRevenue} onChange={e => setMinRevenue(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
                <Input type="number" placeholder="Max" value={maxRevenue} onChange={e => setMaxRevenue(e.target.value)}
                  className="h-8 text-xs bg-slate-800 border-slate-600 text-slate-200 focus:border-blue-500" />
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent bg-slate-800/40">
                <TableHead className="w-20 px-2"><SortHeader label="Hotel" sortKey="hotel" /></TableHead>
                <TableHead className="px-2"><SortHeader label="Client" sortKey="client" /></TableHead>
                <TableHead className="w-20 px-2"><SortHeader label="Status" sortKey="status" /></TableHead>
                <TableHead className="w-20 px-2"><SortHeader label="Arrival" sortKey="arrival" /></TableHead>
                <TableHead className="w-20 px-2"><SortHeader label="Depart." sortKey="departure" /></TableHead>
                <TableHead className="w-20 px-2"><SortHeader label="Cutoff" sortKey="cutoff" /></TableHead>
                <TableHead className="text-right w-14 px-2"><SortHeader label="Rooms" sortKey="rooms" className="justify-end" /></TableHead>
                <TableHead className="text-right w-24 px-2"><SortHeader label="Revenue" sortKey="revenue" className="justify-end" /></TableHead>
                <TableHead className="w-20 px-1"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-500 py-10">
                    No production entries match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                displayData.map((item) => {
                  const cutoffAlert = getCutoffAlert(item);
                  return (
                    <TableRow key={item.id} className="border-slate-700/50 hover:bg-slate-800/40 transition-colors">
                      <TableCell className="font-medium text-slate-200 text-xs px-2 whitespace-nowrap max-w-[80px] truncate" title={getHotelName(item.hotel_id)}>{getHotelName(item.hotel_id)}</TableCell>
                      <TableCell className="px-2">
                        <Link
                          to={createPageUrl(`BookingProfile?id=${item.id}`)}
                          className="text-sm text-blue-300 hover:text-blue-200 hover:underline cursor-pointer max-w-[160px] block truncate"
                          title={item.client_name}
                        >
                          {item.client_name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-auto p-0 hover:bg-transparent">
                              <Badge className={`${STATUS_COLORS[item.status]} border text-xs capitalize cursor-pointer`}>
                                {item.status}
                              </Badge>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-slate-800 border-slate-700">
                            {getAllowedTransitions(item.status).length === 0 ? (
                              <DropdownMenuItem disabled className="text-slate-500 text-xs">No transitions available</DropdownMenuItem>
                            ) : (
                              getAllowedTransitions(item.status).map(s => (
                                <DropdownMenuItem key={s} onClick={() => onStatusChange(item, s)}
                                  className="text-slate-200 hover:bg-slate-700 capitalize">
                                  {s === 'lost' && item.status === 'definite' ? 'Cancel' : s.charAt(0).toUpperCase() + s.slice(1)}
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-slate-300 text-xs px-2 whitespace-nowrap">{safeFormat(item.arrival_date)}</TableCell>
                      <TableCell className="text-slate-300 text-xs px-2 whitespace-nowrap">{safeFormat(item.departure_date)}</TableCell>
                      <TableCell className="text-xs px-2 whitespace-nowrap">
                        {item.cutoff_date ? (
                          <div>
                            <div className={`${cutoffAlert ? cutoffAlert.color : 'text-slate-300'}`}>
                              {safeFormat(item.cutoff_date)}
                            </div>
                            {cutoffAlert && (
                              <div className={`flex items-center gap-1 text-xs mt-0.5 ${cutoffAlert.color}`}>
                                <AlertTriangle className="w-3 h-3" />
                                {cutoffAlert.label}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-slate-200 text-xs px-2">{item.room_nights?.toLocaleString()}</TableCell>
                      <TableCell className="text-right whitespace-nowrap px-2">
                        <div className="text-xs font-medium text-slate-100">${item.revenue?.toLocaleString() || 0}</div>
                      </TableCell>
                      <TableCell className="px-1">
                        <div className="flex gap-0.5 items-center">
                          {item.documents?.length > 0 && (
                            <span title={`${item.documents.length} document(s)`} className="flex items-center gap-0.5 text-xs text-slate-400 mr-1">
                              <Paperclip className="w-3 h-3" />{item.documents.length}
                            </span>
                          )}
                          <Button variant="ghost" size="icon" title="Log Activity" onClick={() => setQuickLogItem(item)}
                            className="w-7 h-7 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                            <MessageSquarePlus className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onEdit(item)}
                            className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-700">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}
                            className="w-7 h-7 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}