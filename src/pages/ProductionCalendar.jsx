import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Upload, AlertCircle } from 'lucide-react';
import ReportUpload from '@/components/crm/ReportUpload';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import BookingDetailModal from '@/components/crm/BookingDetailModal';

const STATUS_COLORS = {
  prospect:  'bg-blue-500/20 text-blue-300 border-blue-500/40',
  tentative: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  definite:  'bg-green-500/20 text-green-300 border-green-500/40',
  lost:      'bg-red-500/20 text-red-300 border-red-500/40',
};

const getAllowedTransitions = (currentStatus) => {
  switch (currentStatus) {
    case 'prospect':  return ['tentative', 'lost'];
    case 'tentative': return ['definite', 'lost'];
    case 'definite':  return ['lost'];
    default:          return [];
  }
};

export default function ProductionCalendar() {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth());
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [selectedHotel, setSelectedHotel] = useState('all');
  const [selectedItem, setSelectedItem] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(user => {
      if (['admin', 'EPIC_ADMIN'].includes(user?.role)) setIsAdmin(true);
    }).catch(() => {});
  }, []);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: production = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list()
  });

  const monthStart = startOfMonth(new Date(selectedYear, selectedMonth));
  const monthEnd = endOfMonth(new Date(selectedYear, selectedMonth));
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Filter production by hotel, seller type, and selected month
  const filteredProduction = production.filter(item => {
    if ((item.seller_type || 'hotel_sales') !== 'hotel_sales') return false;
    if (selectedHotel !== 'all' && item.hotel_id !== selectedHotel) return false;
    if (!item.arrival_date && !item.departure_date) return false;
    // Include if arrival or departure overlaps with selected month
    const arrival = item.arrival_date ? parseISO(item.arrival_date) : null;
    const departure = item.departure_date ? parseISO(item.departure_date) : null;
    const overlap = (arrival && arrival <= monthEnd) && (departure && departure >= monthStart);
    return overlap;
  });

  // Group by record_type (with fallback to status for legacy records without record_type)
  const groupByRecordType = (recordType) => {
    return filteredProduction
      .filter(item => {
        const rt = item.record_type || item.status;
        return rt === recordType;
      })
      .sort((a, b) => {
        if (!a.arrival_date) return 1;
        if (!b.arrival_date) return -1;
        return new Date(a.arrival_date) - new Date(b.arrival_date);
      });
  };

  // For Actuals: only definite groups that have an ActualResults entry
  const getActualGroups = () => {
    const actualProductionIds = new Set(actuals.map(a => a.production_item_id).filter(Boolean));
    return filteredProduction
      .filter(item => {
        const rt = item.record_type || item.status;
        return (rt === 'definite' || rt === 'actual_pickup') && actualProductionIds.has(item.id);
      })
      .sort((a, b) => {
        if (!a.arrival_date) return 1;
        if (!b.arrival_date) return -1;
        return new Date(a.arrival_date) - new Date(b.arrival_date);
      });
  };

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['production'] })
  });

  const handleStatusChange = (item, newStatus) => {
    updateMutation.mutate({ id: item.id, data: { ...item, status: newStatus } });
  };

  const { data: actuals = [] } = useQuery({
    queryKey: ['actualResults'],
    queryFn: () => base44.entities.ActualResults.list()
  });

  // Sanitize a room count value (reject Excel serial date numbers > 9999)
  const sanitizeRooms = (val) => {
    const n = parseFloat(val) || 0;
    return n > 9999 ? 0 : n;
  };

  // Calculate rooms for a specific group on a specific day
  const getRoomsForDay = (item, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    
    // Always prefer daily_rooms if available (trust imported data directly)
    if (item.daily_rooms && Object.keys(item.daily_rooms).length > 0) {
      return sanitizeRooms(item.daily_rooms[dateStr] || 0);
    }
    
    // Fallback to even distribution across arrival->departure
    if (!item.arrival_date || !item.departure_date) return 0;
    const arrival = parseISO(item.arrival_date);
    const departure = parseISO(item.departure_date);
    
    if (day >= arrival && day < departure) {
      const totalDays = Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24));
      return Math.round(item.room_nights / totalDays);
    }
    return 0;
  };

  // Get actual rooms for a day
  const getActualRoomsForDay = (productionId, day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const actual = actuals.find(a => a.production_item_id === productionId);
    return actual?.daily_actual_rooms?.[dateStr] || 0;
  };

  const getDailyTotal = (groups, day) => {
    return groups.reduce((sum, item) => sum + getRoomsForDay(item, day), 0);
  };

  const getGroupTotals = (item) => {
    const adr = item.room_nights > 0 ? (item.revenue / item.room_nights) : 0;
    return { adr: adr.toFixed(0) };
  };

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const ActualSection = ({ label, bgColor }) => {
    const groups = getActualGroups();

    const getActualRoomsForDayDisplay = (item, day) => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const actual = actuals.find(a => a.production_item_id === item.id);
      if (actual?.daily_actual_rooms && actual.daily_actual_rooms[dateStr] != null) {
        return sanitizeRooms(actual.daily_actual_rooms[dateStr]);
      }
      // Fall back to the group's own rooms
      return getRoomsForDay(item, day);
    };

    const getActualTotalsForItem = (item) => {
      const actual = actuals.find(a => a.production_item_id === item.id);
      if (actual) {
        return {
          roomNights: actual.actual_room_nights || item.room_nights || 0,
          revenue: actual.actual_revenue || item.revenue || 0,
        };
      }
      return { roomNights: item.room_nights || 0, revenue: item.revenue || 0 };
    };

    const safeFormat = (dateStr) => {
      try { return dateStr ? format(parseISO(dateStr), 'dd-MMM-yy') : '-'; } catch { return '-'; }
    };

    return (
      <div className="mb-6">
        <div className={`${bgColor} text-white font-bold px-3 py-2 text-sm rounded-t`}>
          {label}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-700 text-slate-200">
                <th className="border border-slate-600 p-1 text-left sticky left-0 bg-slate-700 z-10 min-w-[100px]">Group Name</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Arrival</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Departure</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Cutoff Date</th>
                <th className="border border-slate-600 p-1 min-w-[50px]">Rooms</th>
                <th className="border border-slate-600 p-1 min-w-[60px]">Total RN</th>
                <th className="border border-slate-600 p-1 min-w-[50px]">Rate</th>
                {daysInMonth.map((day, idx) => (
                  <th key={idx} className="border border-slate-600 p-1 min-w-[30px]">
                    {format(day, 'd')}
                  </th>
                ))}
                <th className="border border-slate-600 p-1 min-w-[70px]">Room nights</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Revenue</th>
                <th className="border border-slate-600 p-1 min-w-[50px]">ADR</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((item) => {
                const dailyRooms = daysInMonth.map(day => getActualRoomsForDayDisplay(item, day));
                const peakRooms = dailyRooms.length > 0 ? Math.max(...dailyRooms) : 0;
                const { roomNights, revenue } = getActualTotalsForItem(item);
                const adr = roomNights > 0 ? (revenue / roomNights).toFixed(0) : 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-700/50 text-slate-200">
                    <td className="border border-slate-600 p-1 font-medium sticky left-0 bg-slate-800">
                      <button onClick={() => setSelectedItem(item)} className="text-blue-400 hover:text-blue-300 hover:underline text-left">
                        {item.client_name}
                      </button>
                    </td>
                    <td className="border border-slate-600 p-1">{safeFormat(item.arrival_date)}</td>
                    <td className="border border-slate-600 p-1">{safeFormat(item.departure_date)}</td>
                    <td className="border border-slate-600 p-1 text-center font-medium text-red-400">{safeFormat(item.cutoff_date)}</td>
                    <td className="border border-slate-600 p-1 text-center">{peakRooms}</td>
                    <td className="border border-slate-600 p-1 text-center">{roomNights}</td>
                    <td className="border border-slate-600 p-1 text-right">${adr}</td>
                    {dailyRooms.map((rooms, idx) => (
                      <td key={idx} className="border border-slate-600 p-1 text-center">
                        {rooms > 0 ? rooms : ''}
                      </td>
                    ))}
                    <td className="border border-slate-600 p-1 text-center font-medium">{roomNights}</td>
                    <td className="border border-slate-600 p-1 text-right">${revenue.toLocaleString()}</td>
                    <td className="border border-slate-600 p-1 text-right">${adr}</td>
                  </tr>
                );
              })}
              {groups.length > 0 && (
                <tr className="bg-slate-600 font-bold text-white">
                  <td className="border border-slate-500 p-1 sticky left-0 bg-slate-600">TOTAL {label}</td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1 text-center">
                    {groups.reduce((sum, item) => sum + getActualTotalsForItem(item).roomNights, 0)}
                  </td>
                  <td className="border border-slate-500 p-1"></td>
                  {daysInMonth.map((day, idx) => (
                    <td key={idx} className="border border-slate-500 p-1 text-center">
                      {groups.reduce((sum, item) => sum + getActualRoomsForDayDisplay(item, day), 0) || ''}
                    </td>
                  ))}
                  <td className="border border-slate-500 p-1 text-center">
                    {groups.reduce((sum, item) => sum + getActualTotalsForItem(item).roomNights, 0)}
                  </td>
                  <td className="border border-slate-500 p-1 text-right">
                    ${groups.reduce((sum, item) => sum + getActualTotalsForItem(item).revenue, 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-500 p-1 text-right">
                    ${(() => {
                      const totalRN = groups.reduce((sum, item) => sum + getActualTotalsForItem(item).roomNights, 0);
                      const totalRev = groups.reduce((sum, item) => sum + getActualTotalsForItem(item).revenue, 0);
                      return totalRN > 0 ? (totalRev / totalRN).toFixed(0) : 0;
                    })()}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const StatusSection = ({ recordType, status, label, bgColor, showActuals = false }) => {
    const groups = groupByRecordType(recordType || status);
    
    return (
      <div className="mb-6">
        <div className={`${bgColor} text-white font-bold px-3 py-2 text-sm rounded-t`}>
          {label}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-700 text-slate-200">
                <th className="border border-slate-600 p-1 text-left sticky left-0 bg-slate-700 z-10 min-w-[100px]">Group Name</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Arrival</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Departure</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Cutoff Date</th>
                <th className="border border-slate-600 p-1 min-w-[50px]">Rooms</th>
                <th className="border border-slate-600 p-1 min-w-[60px]">Total RN</th>
                <th className="border border-slate-600 p-1 min-w-[50px]">Rate</th>
                {daysInMonth.map((day, idx) => (
                  <th key={idx} className="border border-slate-600 p-1 min-w-[30px]">
                    {format(day, 'd')}
                  </th>
                ))}
                <th className="border border-slate-600 p-1 min-w-[70px]">Room nights</th>
                <th className="border border-slate-600 p-1 min-w-[70px]">Revenue</th>
                <th className="border border-slate-600 p-1 min-w-[50px]">ADR</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((item) => {
                const { adr } = getGroupTotals(item);
                const dailyRooms = daysInMonth.map(day => getRoomsForDay(item, day));
                const peakRooms = dailyRooms.length > 0 ? Math.max(...dailyRooms) : 0;
                const totalRN = dailyRooms.reduce((sum, r) => sum + r, 0);
                
                const safeFormat = (dateStr) => {
                  try { return dateStr ? format(parseISO(dateStr), 'dd-MMM-yy') : '-'; } catch { return '-'; }
                };
                return (
                  <tr key={item.id} className="hover:bg-slate-700/50 text-slate-200">
                      <td className="border border-slate-600 p-1 font-medium sticky left-0 bg-slate-800">
                        <button onClick={() => setSelectedItem(item)} className="text-blue-400 hover:text-blue-300 hover:underline text-left">
                          {item.client_name}
                        </button>
                      </td>
                       <td className="border border-slate-600 p-1">{safeFormat(item.arrival_date)}</td>
                       <td className="border border-slate-600 p-1">{safeFormat(item.departure_date)}</td>
                       <td className="border border-slate-600 p-1 text-center font-medium text-red-400">{safeFormat(item.cutoff_date)}</td>
                       <td className="border border-slate-600 p-1 text-center">{peakRooms}</td>
                       <td className="border border-slate-600 p-1 text-center">{totalRN}</td>
                       <td className="border border-slate-600 p-1 text-right">${adr}</td>
                      {dailyRooms.map((rooms, idx) => {
                        const actualRooms = showActuals ? getActualRoomsForDay(item.id, daysInMonth[idx]) : 0;
                        return (
                          <td key={idx} className="border border-slate-600 p-1 text-center">
                            {rooms > 0 ? (
                              <div>
                                <div>{rooms}</div>
                                {actualRooms > 0 && (
                                  <div className="text-xs text-green-400 font-semibold">({actualRooms})</div>
                                )}
                              </div>
                            ) : ''}
                          </td>
                        );
                      })}
                      <td className="border border-slate-600 p-1 text-center font-medium">{totalRN}</td>
                      <td className="border border-slate-600 p-1 text-right">${item.revenue.toLocaleString()}</td>
                      <td className="border border-slate-600 p-1 text-right">${adr}</td>
                    </tr>
                );
              })}
              {groups.length > 0 && (
                <tr className="bg-slate-600 font-bold text-white">
                  <td className="border border-slate-500 p-1 sticky left-0 bg-slate-600">TOTAL {label}</td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1"></td>
                  <td className="border border-slate-500 p-1 text-center">
                    {groups.reduce((sum, item) => sum + item.room_nights, 0)}
                  </td>
                  <td className="border border-slate-500 p-1"></td>
                  {daysInMonth.map((day, idx) => (
                    <td key={idx} className="border border-slate-500 p-1 text-center">
                      {getDailyTotal(groups, day) || ''}
                    </td>
                  ))}
                  <td className="border border-slate-500 p-1 text-center">
                    {groups.reduce((sum, item) => sum + item.room_nights, 0)}
                  </td>
                  <td className="border border-slate-500 p-1 text-right">
                    ${groups.reduce((sum, item) => sum + item.revenue, 0).toLocaleString()}
                  </td>
                  <td className="border border-slate-500 p-1 text-right">
                    ${(groups.reduce((sum, item) => sum + item.revenue, 0) / 
                       groups.reduce((sum, item) => sum + item.room_nights, 0) || 0).toFixed(0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2 text-white">
          <CalendarIcon className="w-8 h-8 text-blue-400" />
          Hotel GRC
        </h1>
        
        <div className="flex gap-3 items-center">
          <Select value={selectedHotel} onValueChange={setSelectedHotel}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-600 text-white">
              <SelectValue placeholder="Select hotel" />
            </SelectTrigger>
            <SelectContent>
              {hotels.map(h => (
                <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth('prev')} className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-lg font-semibold min-w-[150px] text-center text-white">
              {format(new Date(selectedYear, selectedMonth), 'MMMM yyyy')}
            </div>
            <Button variant="outline" size="icon" onClick={() => navigateMonth('next')} className="border-slate-500 bg-slate-700 text-white hover:bg-slate-600">
              <ChevronRight className="w-4 h-4" />
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setShowImport(v => !v)}
                disabled={selectedHotel === 'all'}
                title={selectedHotel === 'all' ? 'Select a specific hotel first' : 'Import GRC for this hotel'}
                className="border-yellow-600 text-yellow-300 hover:bg-yellow-900/30 hover:text-yellow-200 bg-transparent ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                {selectedHotel === 'all' ? 'Select a hotel to import' : 'Import GRC'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {showImport && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <ReportUpload
            hotels={hotels}
            selectedHotelId={selectedHotel}
            onSuccess={() => { queryClient.invalidateQueries({ queryKey: ['production'] }); setShowImport(false); }}
          />
        </div>
      )}

      {selectedHotel === 'all' ? (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-16">
          <div className="flex flex-col items-center justify-center text-center space-y-6 min-h-[400px]">
            <div className="bg-blue-500/20 rounded-full p-8">
              <AlertCircle className="w-20 h-20 text-blue-400" />
            </div>
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-white">Group Rooms Control (GRC) is Hotel-Specific</h2>
              <p className="text-slate-400 text-base max-w-xl">
                Each hotel has its own GRC data. Please select a specific hotel from the dropdown above to view its Group Rooms Control calendar.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <StatusSection recordType="definite" label="DEFINITES" bgColor="bg-green-700" />
          <StatusSection recordType="tentative" label="TENTATIVES" bgColor="bg-emerald-500" />
          <StatusSection recordType="prospect" label="PROSPECTS" bgColor="bg-blue-600" />
          <ActualSection label="ACTUAL / PICKUP (Definites)" bgColor="bg-purple-700" />
        </div>
      )}

      <BookingDetailModal
        item={selectedItem}
        actual={selectedItem ? actuals.find(a => a.production_item_id === selectedItem.id) : null}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}