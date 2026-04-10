import React, { useEffect, useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, Search } from "lucide-react";
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subDays, startOfYear, endOfYear, subYears,
  startOfQuarter, endOfQuarter, subQuarters
} from "date-fns";

const PERIOD_OPTIONS = [
  { value: 'this_year',    label: 'This Year' },
  { value: 'last_year',    label: 'Last Year' },
  { value: 'this_quarter', label: 'This Quarter' },
  { value: 'last_quarter', label: 'Last Quarter' },
  { value: 'q1',           label: 'Q1 (Jan–Mar)' },
  { value: 'q2',           label: 'Q2 (Apr–Jun)' },
  { value: 'q3',           label: 'Q3 (Jul–Sep)' },
  { value: 'q4',           label: 'Q4 (Oct–Dec)' },
  { value: 'this_month',   label: 'This Month' },
  { value: 'last_month',   label: 'Last Month' },
  { value: 'this_week',    label: 'This Week' },
  { value: 'last_2_weeks', label: 'Last 2 Weeks' },
  { value: 'all_time',     label: 'All Time' },
  { value: 'custom',       label: 'Custom Range' },
];

const getPeriodRange = (period) => {
  const today = new Date();
  const year = today.getFullYear();
  switch (period) {
    case 'this_year':    return { start: startOfYear(today), end: endOfYear(today) };
    case 'last_year':    return { start: startOfYear(subYears(today, 1)), end: endOfYear(subYears(today, 1)) };
    case 'this_quarter': return { start: startOfQuarter(today), end: endOfQuarter(today) };
    case 'last_quarter': return { start: startOfQuarter(subQuarters(today, 1)), end: endOfQuarter(subQuarters(today, 1)) };
    case 'q1':           return { start: new Date(year, 0, 1), end: new Date(year, 2, 31) };
    case 'q2':           return { start: new Date(year, 3, 1), end: new Date(year, 5, 30) };
    case 'q3':           return { start: new Date(year, 6, 1), end: new Date(year, 8, 30) };
    case 'q4':           return { start: new Date(year, 9, 1), end: new Date(year, 11, 31) };
    case 'this_month':   return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'last_month':   return { start: startOfMonth(subDays(startOfMonth(today), 1)), end: endOfMonth(subDays(startOfMonth(today), 1)) };
    case 'this_week':    return { start: startOfWeek(today), end: endOfWeek(today) };
    case 'last_2_weeks': return { start: subDays(today, 14), end: today };
    case 'all_time':     return { start: new Date('2020-01-01'), end: new Date('2030-12-31') };
    default:             return null;
  }
};

export default function FilterControls({
  selectedHotel, setSelectedHotel, hotels,
  dateRange, setDateRange,
  setSelectedYear,
  selectedSeller, setSelectedSeller, sellers = [],
  selectedStatus, setSelectedStatus,
  selectedEventType, setSelectedEventType,
  searchText, setSearchText,
}) {
  const [users, setUsers] = useState([]);
  const [period, setPeriod] = useState('this_year');
  const [customStart, setCustomStart] = useState(dateRange?.start || '');
  const [customEnd, setCustomEnd] = useState(dateRange?.end || '');

  useEffect(() => {
    base44.entities.User.list().then(setUsers).catch(() => {});
  }, []);

  const allTeamMembers = [...new Set([
    ...sellers,
    ...users.map(u => u.full_name).filter(Boolean)
  ].map(name => name.toLowerCase()))].sort().map(name => name.charAt(0).toUpperCase() + name.slice(1));

  const applyPeriod = (p) => {
    setPeriod(p);
    if (p === 'custom') return;
    const range = getPeriodRange(p);
    if (!range) return;
    const start = range.start.toISOString().split('T')[0];
    const end = range.end.toISOString().split('T')[0];
    setDateRange({ start, end });
    if (setSelectedYear) setSelectedYear(range.start.getFullYear());
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setDateRange({ start: customStart, end: customEnd });
    if (setSelectedYear) setSelectedYear(new Date(customStart).getFullYear());
  };

  const statusOptions = ['prospect', 'tentative', 'definite', 'actual', 'lost'];
  const eventTypes = ['corporate', 'wedding', 'convention', 'group', 'leisure', 'other'];

  return (
    <Card className="bg-slate-800/80 border border-slate-600 backdrop-blur-sm shadow-lg shadow-slate-900/50 ring-1 ring-slate-700/50">
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">

          {/* Hotel */}
          <div className="space-y-1">
            <Label className="flex items-center gap-1.5 text-slate-400 text-xs">
              <Filter className="w-3 h-3 text-cyan-400" /> Hotel
            </Label>
            <Select value={selectedHotel} onValueChange={setSelectedHotel}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm">
                <SelectValue placeholder="All Hotels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Hotels</SelectItem>
                {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Period */}
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">Period</Label>
            <Select value={period} onValueChange={applyPeriod}>
              <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Custom date pickers — only when custom is selected */}
          {period === 'custom' ? (
            <>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">From</Label>
                <Input type="date" value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="h-9 bg-slate-800 border-slate-600 text-white text-sm [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">To</Label>
                <Input type="date" value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="h-9 bg-slate-800 border-slate-600 text-white text-sm [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
              <div className="flex items-end">
                <button onClick={applyCustom}
                  className="h-9 w-full px-3 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
                  Apply
                </button>
              </div>
            </>
          ) : (
            <>
              {/* User */}
              {setSelectedSeller && (
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">User</Label>
                  <Select value={selectedSeller || 'all'} onValueChange={v => setSelectedSeller(v === 'all' ? '' : v)}>
                    <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm">
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Team</SelectItem>
                      {allTeamMembers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status */}
              {setSelectedStatus && (
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Status</Label>
                  <Select value={selectedStatus || 'all'} onValueChange={v => setSelectedStatus(v === 'all' ? '' : v)}>
                    <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {statusOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Search */}
              {setSearchText && (
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input value={searchText || ''} onChange={e => setSearchText(e.target.value)}
                      placeholder="Client name..."
                      className="h-9 bg-slate-800 border-slate-600 text-white text-sm pl-8" />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Extra filters row when custom is active */}
        {period === 'custom' && (setSelectedSeller || setSelectedStatus || setSearchText) && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3">
            {setSelectedSeller && (
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">User</Label>
                <Select value={selectedSeller || 'all'} onValueChange={v => setSelectedSeller(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm">
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Team</SelectItem>
                    {allTeamMembers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {setSelectedStatus && (
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Status</Label>
                <Select value={selectedStatus || 'all'} onValueChange={v => setSelectedStatus(v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 bg-slate-800 border-slate-600 text-white text-sm">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {statusOptions.map(s => <SelectItem key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {setSearchText && (
              <div className="space-y-1">
                <Label className="text-slate-400 text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <Input value={searchText || ''} onChange={e => setSearchText(e.target.value)}
                    placeholder="Client name..."
                    className="h-9 bg-slate-800 border-slate-600 text-white text-sm pl-8" />
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}