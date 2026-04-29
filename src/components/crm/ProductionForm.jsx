import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Trash2, Paperclip, Upload, FileText, ExternalLink } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import { base44 } from "@/api/base44Client";
import { eachDayOfInterval, format, parseISO } from "date-fns";

const DEFAULT_ADDITIONAL_SERVICES = [
  { label: 'Resort Fee', key: 'resort_fee' },
  { label: 'F&B / Banquet', key: 'fb_banquet' },
  { label: 'Spa & Wellness', key: 'spa' },
  { label: 'AV / Tech', key: 'av_tech' },
  { label: 'Transportation', key: 'transportation' },
];

const ROOM_TYPE_OPTIONS = ['ROH', 'Single', 'Double', 'Bed(s)'];

// Detect if daily_rooms is old flat format {date: num} or new nested {type: {date: num}}
function isNestedFormat(daily_rooms) {
  if (!daily_rooms || Object.keys(daily_rooms).length === 0) return false;
  const firstVal = Object.values(daily_rooms)[0];
  return typeof firstVal === 'object' && firstVal !== null && !Array.isArray(firstVal);
}

function getValidDates(editItem) {
  if (!editItem?.arrival_date || !editItem?.departure_date) return null;
  try {
    const arr = parseISO(editItem.arrival_date);
    const dep = parseISO(editItem.departure_date);
    if (arr >= dep) return null;
    return eachDayOfInterval({ start: arr, end: dep }).slice(0, -1).map(d => format(d, 'yyyy-MM-dd'));
  } catch { return null; }
}

function filterToDates(typeMap, validDates) {
  const result = {};
  const validSet = new Set(validDates);
  Object.keys(typeMap).forEach(type => {
    result[type] = {};
    validDates.forEach(d => { result[type][d] = typeMap[type]?.[d] || 0; });
  });
  return result;
}

function initRoomsState(editItem) {
  if (!editItem?.daily_rooms) return {};
  const validDates = getValidDates(editItem);
  if (isNestedFormat(editItem.daily_rooms)) {
    return validDates ? filterToDates(editItem.daily_rooms, validDates) : editItem.daily_rooms;
  }
  // Legacy flat format: filter to valid dates and put under 'ROH'
  const legacyFlat = {};
  if (validDates) validDates.forEach(d => { legacyFlat[d] = editItem.daily_rooms[d] || 0; });
  return { ROH: legacyFlat };
}

function initRatesState(editItem) {
  if (!editItem?.daily_rates) return {};
  const validDates = getValidDates(editItem);
  if (isNestedFormat(editItem.daily_rates)) {
    return validDates ? filterToDates(editItem.daily_rates, validDates) : editItem.daily_rates;
  }
  // Legacy flat format
  const legacyFlat = {};
  if (validDates) validDates.forEach(d => { legacyFlat[d] = editItem.daily_rates[d] || 0; });
  return { ROH: legacyFlat };
}

export default function ProductionForm({ hotels, onSuccess, onCancel, editItem = null }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(() => {
    if (editItem) {
      // For Uma House GRC imports (no client_id): move client_name → booking_name, clear client for user to fill
      const isUmaHouseGRC = editItem.event_type === 'group' && !editItem.client_id;
      return {
        ...editItem,
        booking_name: isUmaHouseGRC ? (editItem.client_name || editItem.booking_name || '') : (editItem.booking_name || ''),
        client_name: isUmaHouseGRC ? '' : (editItem.client_name || ''),
      };
    }
    return {
      hotel_id: '',
      status: 'tentative',
      client_id: '',
      client_name: '',
      booking_name: '',
      arrival_date: '',
      departure_date: '',
      cutoff_date: '',
      activity_date: new Date().toISOString().split('T')[0],
      room_nights: 0,
      revenue: 0,
      accommodation_revenue: 0,
      additional_services: {},
      daily_rooms: {},
      seller_type: 'hotel_sales',
      notes: ''
    };
  });

  const [loading, setLoading] = useState(false);
  // Nested: { ROH: { '2026-03-23': 10 }, Single: { '2026-03-23': 5 } }
  const [dailyRooms, setDailyRooms] = useState(() => initRoomsState(editItem));
  const [dailyRates, setDailyRates] = useState(() => initRatesState(editItem));
  const [isEditingDates, setIsEditingDates] = useState(!editItem);
  const [accountSearch, setAccountSearch] = useState('');
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [clients, setClients] = useState([]);
  const [existingBookingClients, setExistingBookingClients] = useState([]);
  const [customServiceName, setCustomServiceName] = useState('');
  const [showCustomService, setShowCustomService] = useState(false);
  const [activeRoomType, setActiveRoomType] = useState(() => editItem?.room_type || 'ROH');
  const [customRoomType, setCustomRoomType] = useState('');
  const [documents, setDocuments] = useState(() => editItem?.documents || []);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    base44.entities.Client.list().then(setClients).catch(() => {});
    base44.entities.ProductionItem.list().then(items => {
      // Collect unique client_names from existing bookings for the selected hotel
      const names = [...new Set(items.filter(i => i.client_name).map(i => i.client_name))];
      setExistingBookingClients(names);
    }).catch(() => {});
  }, []);

  // When dates change on a NEW form, regenerate daily rooms grid (preserving existing values)
  useEffect(() => {
    if (!isEditingDates) return;
    if (formData.arrival_date && formData.departure_date) {
      try {
        const arrival = parseISO(formData.arrival_date);
        const departure = parseISO(formData.departure_date);
        if (arrival >= departure) { setDailyRooms({}); setDailyRates({}); return; }
        const days = eachDayOfInterval({ start: arrival, end: departure }).slice(0, -1);
        // For each room type that has data, trim to new date range; keep existing values
        setDailyRooms(prev => {
          const updated = {};
          const types = Object.keys(prev).length > 0 ? Object.keys(prev) : ['ROH'];
          types.forEach(type => {
            updated[type] = {};
            days.forEach(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              updated[type][dateStr] = prev[type]?.[dateStr] || 0;
            });
          });
          return updated;
        });
        setDailyRates(prev => {
          const updated = {};
          const types = Object.keys(prev).length > 0 ? Object.keys(prev) : ['ROH'];
          types.forEach(type => {
            updated[type] = {};
            days.forEach(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              updated[type][dateStr] = prev[type]?.[dateStr] || 0;
            });
          });
          return updated;
        });
      } catch { setDailyRooms({}); setDailyRates({}); }
    } else {
      setDailyRooms({});
      setDailyRates({});
    }
  }, [formData.arrival_date, formData.departure_date, isEditingDates]);

  // Auto-calculate total room nights and accommodation revenue (sum across ALL room types per day)
  useEffect(() => {
    const allDates = new Set();
    Object.values(dailyRooms).forEach(typeRooms => Object.keys(typeRooms).forEach(d => allDates.add(d)));

    let totalNights = 0;
    let peakRooms = 0;
    let accRev = 0;

    allDates.forEach(date => {
      let roomsOnDate = 0;
      Object.keys(dailyRooms).forEach(type => {
        const rooms = parseFloat(dailyRooms[type]?.[date]) || 0;
        const rate = parseFloat(dailyRates[type]?.[date]) || 0;
        totalNights += rooms;
        accRev += rooms * rate;
        roomsOnDate += rooms;
      });
      peakRooms = Math.max(peakRooms, roomsOnDate);
    });

    setFormData(prev => ({ ...prev, room_nights: totalNights, peak_rooms: peakRooms, accommodation_revenue: accRev }));
  }, [dailyRooms, dailyRates]);

  // Auto-calculate total revenue
  useEffect(() => {
    const addlTotal = Object.values(formData.additional_services || {}).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    const total = (parseFloat(formData.accommodation_revenue) || 0) + addlTotal;
    setFormData(prev => ({ ...prev, revenue: total }));
  }, [formData.accommodation_revenue, formData.additional_services]);

  const handleDailyRoomChange = (date, value) => {
    setDailyRooms(prev => ({
      ...prev,
      [activeRoomType]: { ...(prev[activeRoomType] || {}), [date]: parseFloat(value) || 0 }
    }));
  };

  const handleDailyRateChange = (date, value) => {
    setDailyRates(prev => ({
      ...prev,
      [activeRoomType]: { ...(prev[activeRoomType] || {}), [date]: parseFloat(value) || 0 }
    }));
  };

  const handleSelectClient = (client) => {
    setFormData({ ...formData, client_id: client.id, client_name: client.company_name });
    setAccountSearch('');
    setShowAccountDropdown(false);
  };

  const handleServiceChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      additional_services: { ...prev.additional_services, [key]: parseFloat(value) || 0 }
    }));
  };

  const handleAddCustomService = () => {
    if (!customServiceName.trim()) return;
    handleServiceChange(customServiceName, 0);
    setCustomServiceName('');
    setShowCustomService(false);
  };

  const handleRemoveService = (key) => {
    setFormData(prev => {
      const updated = { ...prev.additional_services };
      delete updated[key];
      return { ...prev, additional_services: updated };
    });
  };

  const handleDateChange = (field, value) => {
    setIsEditingDates(true);
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSelectRoomType = (type) => {
    setActiveRoomType(type);
    // Ensure this room type has an entry in dailyRooms/dailyRates (with existing dates)
    setDailyRooms(prev => {
      if (prev[type]) return prev;
      const dates = dailyRoomEntries;
      const newType = {};
      dates.forEach(d => { newType[d] = 0; });
      return { ...prev, [type]: newType };
    });
    setDailyRates(prev => {
      if (prev[type]) return prev;
      const dates = dailyRoomEntries;
      const newType = {};
      dates.forEach(d => { newType[d] = 0; });
      return { ...prev, [type]: newType };
    });
  };

  // Show Client entity records + unique client names from existing bookings
  const filteredClients = (() => {
    const q = accountSearch.toLowerCase();
    const clientMatches = clients
      .filter(c => !q || c.company_name.toLowerCase().includes(q))
      .map(c => ({ id: c.id, label: c.company_name, isClient: true }));
    const bookingMatches = existingBookingClients
      .filter(name => !q || name.toLowerCase().includes(q))
      .filter(name => !clientMatches.find(c => c.label.toLowerCase() === name.toLowerCase()))
      .map(name => ({ id: null, label: name, isClient: false }));
    return [...clientMatches, ...bookingMatches];
  })();

  const dailyRoomEntries = useMemo(() => {
    if (formData.arrival_date && formData.departure_date) {
      try {
        const arrival = parseISO(formData.arrival_date);
        const departure = parseISO(formData.departure_date);
        if (arrival >= departure) return [];
        return eachDayOfInterval({ start: arrival, end: departure })
          .slice(0, -1)
          .map(day => format(day, 'yyyy-MM-dd'));
      } catch { return []; }
    }
    // Fall back to dates from any room type
    const allDates = new Set();
    Object.values(dailyRooms).forEach(typeRooms => Object.keys(typeRooms).forEach(d => allDates.add(d)));
    return [...allDates].sort();
  }, [formData.arrival_date, formData.departure_date, dailyRooms]);

  const activeRooms = dailyRooms[activeRoomType] || {};
  const activeRatesMap = dailyRates[activeRoomType] || {};

  // Which room types have any data entered
  const typesWithData = ROOM_TYPE_OPTIONS.filter(t =>
    dailyRooms[t] && Object.values(dailyRooms[t]).some(v => v > 0)
  );

  const addlTotal = Object.values(formData.additional_services || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  const effectiveRoomType = activeRoomType === 'custom' ? (customRoomType || 'Custom') : activeRoomType;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasRooms = Object.values(dailyRooms).some(typeRooms =>
      Object.values(typeRooms).some(v => v > 0)
    );
    if (!hasRooms) {
      alert('Please enter room counts for at least one day');
      return;
    }
    if (!formData.client_name?.trim()) {
      alert('Please enter a client / group name');
      return;
    }
    setLoading(true);
    const payload = {
      hotel_id: formData.hotel_id,
      status: formData.status,
      ...(formData.client_id ? { client_id: formData.client_id } : {}),
      client_name: formData.client_name,
      booking_name: formData.booking_name || '',
      arrival_date: formData.arrival_date,
      cutoff_date: formData.cutoff_date,
      activity_date: formData.activity_date,
      room_nights: parseFloat(formData.room_nights) || 0,
      revenue: parseFloat(formData.revenue) || 0,
      accommodation_revenue: parseFloat(formData.accommodation_revenue) || 0,
      additional_services: formData.additional_services || {},
      daily_rooms: dailyRooms,
      daily_rates: dailyRates,
      room_type: effectiveRoomType,
      seller_type: 'hotel_sales',
      notes: formData.notes || '',
      seller_name: formData.seller_name || '',
      documents: documents
    };
    try {
      if (editItem) {
        await base44.entities.ProductionItem.update(editItem.id, payload);
      } else {
        await base44.entities.ProductionItem.create(payload);
      }
      onSuccess();
    } catch (err) {
      const msg = err?.message || (typeof err === 'object' ? JSON.stringify(err) : String(err));
      alert(`Failed to save booking: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader className="bg-blue-50 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl text-blue-700">{editItem ? 'Edit' : 'Add'} Group Booking</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              {editItem ? 'Modify booking details, dates, rooms, and revenues below' : 'Enter arrival/departure dates, then fill in daily room counts'}
            </p>
          </div>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Core Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hotel *</Label>
              <Select value={formData.hotel_id} onValueChange={(val) => setFormData({...formData, hotel_id: val})}>
                <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                <SelectContent>
                  {hotels.map(hotel => (
                    <SelectItem key={hotel.id} value={hotel.id}>{hotel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 relative">
              <Label>Client / Account Name *</Label>
              <div className="relative">
                <Input
                  value={accountSearch || formData.client_name}
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    setShowAccountDropdown(true);
                    setFormData(prev => ({ ...prev, client_name: e.target.value }));
                  }}
                  onFocus={() => setShowAccountDropdown(true)}
                  placeholder="Search for existing client or type a new name"
                  className="border-blue-300"
                />
                {showAccountDropdown && accountSearch && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-blue-300 rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                    {filteredClients.length > 0 ? (
                      filteredClients.map((item, idx) => (
                        <button key={item.id || idx} type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, client_name: item.label, ...(item.id ? { client_id: item.id } : {}) }));
                            setAccountSearch('');
                            setShowAccountDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b last:border-b-0 text-sm flex items-center justify-between">
                          <span>{item.label}</span>
                          {!item.isClient && <span className="text-xs text-slate-400 ml-2">from bookings</span>}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-gray-500">No match found.</span>
                        <Button
                          type="button" variant="link" size="sm"
                          className="h-auto p-0 text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          onClick={() => navigate(`/Clients?newClientName=${encodeURIComponent(accountSearch)}`)}>
                          Create Account <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Booking Name / Event Title</Label>
              <Input
                value={formData.booking_name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, booking_name: e.target.value }))}
                placeholder="e.g. ATSUS-1352 TOURBANK, Annual Conference 2026"
                className="border-blue-300"
              />
            </div>

            <div className="space-y-2">
              <Label>Arrival Date *</Label>
              <Input type="date" value={formData.arrival_date}
                onChange={(e) => handleDateChange('arrival_date', e.target.value)}
                required className="border-blue-300" />
            </div>

            <div className="space-y-2">
              <Label>Departure Date *</Label>
              <Input type="date" value={formData.departure_date}
                onChange={(e) => handleDateChange('departure_date', e.target.value)}
                required className="border-blue-300" />
            </div>

            <div className="space-y-2">
              <Label>Cutoff Date</Label>
              <Input type="date" value={formData.cutoff_date}
                onChange={(e) => setFormData({...formData, cutoff_date: e.target.value})}
                className="border-blue-300" />
            </div>

            <div className="space-y-2">
              <Label>Activity Date *</Label>
              <Input type="date" value={formData.activity_date}
                onChange={(e) => setFormData({...formData, activity_date: e.target.value})}
                required className="border-blue-300" />
            </div>

            <div className="space-y-2">
              <Label>Status *</Label>
              <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {editItem ? (
                    (() => {
                      const transitions = {
                        prospect:  [{ value: 'prospect', label: 'Prospect' }, { value: 'tentative', label: 'Tentative' }, { value: 'lost', label: 'Lost' }],
                        tentative: [{ value: 'tentative', label: 'Tentative' }, { value: 'definite', label: 'Definite' }, { value: 'lost', label: 'Lost' }],
                        definite:  [{ value: 'definite', label: 'Definite' }, { value: 'lost', label: 'Cancel (Lost)' }],
                      };
                      const opts = transitions[editItem.status] || [{ value: editItem.status, label: editItem.status }];
                      return opts.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>);
                    })()
                  ) : (
                    <>
                      <SelectItem value="solicitation">Solicitation</SelectItem>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="tentative">Tentative</SelectItem>
                      <SelectItem value="definite">Definite</SelectItem>
                      <SelectItem value="actual">Actual</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Seller Name</Label>
              <Input value={formData.seller_name || ''} onChange={(e) => setFormData({...formData, seller_name: e.target.value})}
                className="border-blue-300" placeholder="Seller name" />
            </div>
          </div>

          {/* Daily Room Breakdown */}
          {dailyRoomEntries.length > 0 && (
            <div className="space-y-3 border-2 border-blue-400 rounded-lg p-4 bg-gradient-to-br from-blue-50 to-blue-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-1 bg-blue-600 rounded"></div>
                  <div>
                    <Label className="text-lg font-bold text-blue-800">Daily Room Breakdown *</Label>
                    <p className="text-xs text-gray-700">Enter rooms and rate per room for each night. Accommodation revenue auto-calculates.</p>
                  </div>
                </div>
                {editItem && (
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => setIsEditingDates(true)}
                    className="text-xs border-blue-400 text-blue-700">
                    Regenerate from Dates
                  </Button>
                )}
              </div>

              {/* Room Type Selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <Label className="text-sm font-medium text-blue-800 shrink-0">Room Type:</Label>
                <div className="flex gap-2 flex-wrap">
                  {ROOM_TYPE_OPTIONS.map(opt => {
                    const hasData = dailyRooms[opt] && Object.values(dailyRooms[opt]).some(v => v > 0);
                    return (
                      <button key={opt} type="button"
                        onClick={() => handleSelectRoomType(opt)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors relative ${
                          activeRoomType === opt
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                        }`}>
                        {opt}
                        {hasData && activeRoomType !== opt && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" title="Has data" />
                        )}
                      </button>
                    );
                  })}
                  <button type="button"
                    onClick={() => handleSelectRoomType('custom')}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                      activeRoomType === 'custom'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
                    }`}>
                    Other…
                  </button>
                </div>
                {activeRoomType === 'custom' && (
                  <Input value={customRoomType} onChange={e => setCustomRoomType(e.target.value)}
                    className="border-blue-300 h-8 w-40 text-sm"
                    placeholder="e.g. Suite, King…" />
                )}
              </div>

              {/* Per-type summary badges */}
              {typesWithData.length > 0 && (
                <div className="flex gap-2 flex-wrap text-xs">
                  {typesWithData.map(t => {
                    const typeNights = Object.values(dailyRooms[t] || {}).reduce((s, v) => s + (parseFloat(v) || 0), 0);
                    return (
                      <span key={t} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full border border-blue-200 font-medium">
                        {t}: {typeNights} nights
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="border-2 border-blue-300 rounded-lg p-4 max-h-72 overflow-y-auto bg-white shadow-inner">
                <div className="grid grid-cols-3 gap-1 mb-2">
                  <span className="text-xs font-semibold text-gray-500">Date</span>
                  <span className="text-xs font-semibold text-gray-500 text-center">Rooms ({effectiveRoomType})</span>
                  <span className="text-xs font-semibold text-gray-500 text-center">Rate / Room ($)</span>
                </div>
                <div className="space-y-2">
                  {dailyRoomEntries.map(date => (
                    <div key={date} className="grid grid-cols-3 gap-2 items-center">
                      <Label className="text-xs font-medium text-gray-700">{format(parseISO(date), 'EEE, MMM d')}</Label>
                      <Input type="number" min="0"
                        value={activeRooms[date] || ''}
                        onChange={(e) => handleDailyRoomChange(date, e.target.value)}
                        className="h-8 bg-white border-blue-300 text-center"
                        placeholder="0" />
                      <Input type="number" min="0"
                        value={activeRatesMap[date] || ''}
                        onChange={(e) => handleDailyRateChange(date, e.target.value)}
                        className="h-8 bg-white border-green-300 text-center"
                        placeholder="0.00" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 bg-blue-600 text-white rounded-lg">
                  <span className="text-sm font-medium">Total Room Nights:</span>
                  <span className="text-2xl font-bold">{formData.room_nights || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-600 text-white rounded-lg">
                  <span className="text-sm font-medium">Peak Rooms:</span>
                  <span className="text-2xl font-bold">{formData.peak_rooms || 0}</span>
                </div>
              </div>
            </div>
          )}

          {/* Revenue Section */}
          <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50 space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-green-600 rounded"></div>
              <Label className="text-lg font-bold text-green-800">Revenue Breakdown</Label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-green-800 font-medium">Accommodation Revenue ($)</Label>
                <Input type="number" min="0"
                  value={formData.accommodation_revenue || ''}
                  onChange={(e) => setFormData({...formData, accommodation_revenue: parseFloat(e.target.value) || 0})}
                  className="border-green-300 bg-white"
                  placeholder="0.00" />
                <p className="text-xs text-gray-500">Auto-calculated from daily rooms × rates above, or enter manually.</p>
              </div>
            </div>

            {/* Additional Services */}
            <div className="space-y-2">
              <Label className="text-green-800 font-medium">Additional Services / Revenue</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DEFAULT_ADDITIONAL_SERVICES.map(service => (
                  <div key={service.key} className="flex items-center gap-2">
                    <Label className="w-36 text-sm text-gray-700 shrink-0">{service.label} ($)</Label>
                    <Input type="number" min="0"
                      value={(formData.additional_services || {})[service.key] || ''}
                      onChange={(e) => handleServiceChange(service.key, e.target.value)}
                      className="border-green-300 bg-white h-8"
                      placeholder="0" />
                  </div>
                ))}
                {Object.keys(formData.additional_services || {})
                  .filter(k => !DEFAULT_ADDITIONAL_SERVICES.find(s => s.key === k))
                  .map(key => (
                    <div key={key} className="flex items-center gap-2">
                      <Label className="w-36 text-sm text-gray-700 shrink-0 truncate capitalize">{key} ($)</Label>
                      <Input type="number" min="0"
                        value={(formData.additional_services || {})[key] || ''}
                        onChange={(e) => handleServiceChange(key, e.target.value)}
                        className="border-green-300 bg-white h-8" placeholder="0" />
                      <button type="button" onClick={() => handleRemoveService(key)}
                        className="text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                }
              </div>

              {showCustomService ? (
                <div className="flex gap-2 mt-2">
                  <Input value={customServiceName} onChange={(e) => setCustomServiceName(e.target.value)}
                    placeholder="Service name (e.g. Parking, Transfers)" className="border-green-300 bg-white" />
                  <Button type="button" size="sm" onClick={handleAddCustomService} className="bg-green-600 hover:bg-green-700 text-white">Add</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowCustomService(false)}>Cancel</Button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowCustomService(true)}
                  className="flex items-center gap-1 text-sm text-green-700 hover:text-green-900 font-medium mt-1">
                  <Plus className="w-4 h-4" /> Add Custom Service
                </button>
              )}
            </div>

            <div className="flex items-center justify-between p-3 bg-green-600 text-white rounded-lg">
              <div>
                <span className="text-sm font-medium">Total Revenue (Accommodation + Services):</span>
                {addlTotal > 0 && (
                  <p className="text-xs opacity-80">Accommodation: ${(formData.accommodation_revenue || 0).toLocaleString()} + Services: ${addlTotal.toLocaleString()}</p>
                )}
              </div>
              <span className="text-2xl font-bold">${(formData.revenue || 0).toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes || ''} onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={2} placeholder="Any additional details..." />
          </div>

          {/* Documents */}
          <div className="border-2 border-slate-300 rounded-lg p-4 bg-slate-50 space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-slate-500 rounded"></div>
              <Label className="text-base font-bold text-slate-700">Documents</Label>
              <span className="text-xs text-slate-500">Proposals, agreements, contracts, etc.</span>
            </div>

            {documents.length > 0 && (
              <div className="space-y-2">
                {documents.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{doc.name}</span>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button type="button" onClick={() => setDocuments(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-colors w-fit ${uploadingDoc ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">{uploadingDoc ? 'Uploading...' : 'Upload Document'}</span>
              <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.png,.jpg,.jpeg"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingDoc(true);
                  const { file_url } = await base44.integrations.Core.UploadFile({ file });
                  setDocuments(prev => [...prev, { name: file.name, url: file_url, type: file.type, uploaded_at: new Date().toISOString() }]);
                  setUploadingDoc(false);
                  e.target.value = '';
                }} />
            </label>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Saving...' : (editItem ? 'Update Group' : 'Add Group Booking')}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}