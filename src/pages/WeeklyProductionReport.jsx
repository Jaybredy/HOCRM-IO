import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { startOfWeek, endOfWeek, format, addWeeks, subWeeks, isWithinInterval, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Building2, Users, FileText, CheckSquare, TrendingUp } from 'lucide-react';

const STATUS_COLORS = {
  solicitation: 'bg-blue-900 text-blue-300',
  prospect: 'bg-purple-900 text-purple-300',
  tentative: 'bg-yellow-900 text-yellow-300',
  definite: 'bg-green-900 text-green-300',
  actual: 'bg-emerald-900 text-emerald-300',
  lost: 'bg-red-900 text-red-300',
};

const RFP_STATUS_COLORS = {
  in_progress: 'bg-blue-900 text-blue-300',
  submitted: 'bg-yellow-900 text-yellow-300',
  approved: 'bg-green-900 text-green-300',
  declined: 'bg-red-900 text-red-300',
};

const TASK_STATUS_COLORS = {
  todo: 'bg-slate-700 text-slate-300',
  in_progress: 'bg-blue-900 text-blue-300',
  completed: 'bg-green-900 text-green-300',
  cancelled: 'bg-red-900 text-red-300',
};

export default function WeeklyProductionReport() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedHotelId, setSelectedHotelId] = useState('all');

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  // Data fetching
  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: allProduction = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list('-activity_date')
  });

  const { data: allRFPs = [] } = useQuery({
    queryKey: ['rfps'],
    queryFn: () => base44.entities.RFP.list('-created_date')
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-due_date')
  });

  const { data: allActivityLogs = [] } = useQuery({
    queryKey: ['activity_logs'],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date')
  });

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || 'Unknown';

  const inWeek = (dateStr) => {
    if (!dateStr) return false;
    try {
      return isWithinInterval(parseISO(dateStr), { start: weekStart, end: weekEnd });
    } catch { return false; }
  };

  const hotelFilter = (item) => selectedHotelId === 'all' || item.hotel_id === selectedHotelId;

  // Filter data for selected week and hotel
  const weekProduction = allProduction.filter(p => inWeek(p.activity_date) && hotelFilter(p));
  const weekRFPs = allRFPs.filter(r => (inWeek(r.created_date) || inWeek(r.submission_date)) && hotelFilter(r));
  const weekTasks = allTasks.filter(t => inWeek(t.due_date));
  const weekActivityLogs = allActivityLogs.filter(a => inWeek(a.activity_date) && hotelFilter(a));

  // Summary KPIs
  const totalRoomNights = weekProduction.reduce((s, p) => s + (p.room_nights || 0), 0);
  const totalRevenue = weekProduction.reduce((s, p) => s + (p.revenue || 0), 0);
  const definiteRevenue = weekProduction.filter(p => ['definite','actual'].includes(p.status)).reduce((s, p) => s + (p.revenue || 0), 0);
  const definiteRN = weekProduction.filter(p => ['definite','actual'].includes(p.status)).reduce((s, p) => s + (p.room_nights || 0), 0);

  // --- Groups by Hotel ---
  const productionByHotel = useMemo(() => {
    const byHotel = {};
    weekProduction.forEach(p => {
      const hName = getHotelName(p.hotel_id);
      if (!byHotel[hName]) byHotel[hName] = { items: [], roomNights: 0, revenue: 0 };
      byHotel[hName].items.push(p);
      byHotel[hName].roomNights += p.room_nights || 0;
      byHotel[hName].revenue += p.revenue || 0;
    });
    return byHotel;
  }, [weekProduction, hotels]);

  // --- Groups by Event Type ---
  const productionByEventType = useMemo(() => {
    const byType = {};
    weekProduction.forEach(p => {
      const t = p.event_type || 'other';
      if (!byType[t]) byType[t] = { items: [], roomNights: 0, revenue: 0 };
      byType[t].items.push(p);
      byType[t].roomNights += p.room_nights || 0;
      byType[t].revenue += p.revenue || 0;
    });
    return byType;
  }, [weekProduction]);

  // --- Revenue & RN chart by hotel ---
  const hotelChartData = Object.entries(productionByHotel).map(([name, d]) => ({
    hotel: name,
    roomNights: d.roomNights,
    revenue: d.revenue
  }));

  // --- Status breakdown chart ---
  const statusChartData = ['solicitation','prospect','tentative','definite','actual','lost'].map(s => ({
    status: s,
    count: weekProduction.filter(p => p.status === s).length,
    revenue: weekProduction.filter(p => p.status === s).reduce((sum, p) => sum + (p.revenue || 0), 0),
  })).filter(d => d.count > 0);

  // --- RFPs by hotel ---
  const rfpsByHotel = useMemo(() => {
    const byHotel = {};
    weekRFPs.forEach(r => {
      const hName = getHotelName(r.hotel_id);
      if (!byHotel[hName]) byHotel[hName] = [];
      byHotel[hName].push(r);
    });
    return byHotel;
  }, [weekRFPs, hotels]);

  // --- Tasks by status ---
  const tasksByStatus = useMemo(() => {
    const byStatus = {};
    weekTasks.forEach(t => {
      const s = t.status || 'todo';
      if (!byStatus[s]) byStatus[s] = [];
      byStatus[s].push(t);
    });
    return byStatus;
  }, [weekTasks]);

  // --- Activity logs by hotel ---
  const activityByHotel = useMemo(() => {
    const byHotel = {};
    weekActivityLogs.forEach(a => {
      const hName = getHotelName(a.hotel_id);
      if (!byHotel[hName]) byHotel[hName] = [];
      byHotel[hName].push(a);
    });
    return byHotel;
  }, [weekActivityLogs, hotels]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-blue-400" />
              Weekly Production Report
            </h1>
            <p className="text-slate-400 mt-1">All activity grouped by hotel and type</p>
          </div>
          {/* Week Navigation */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w - 1)}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-medium min-w-[200px] text-center">
              {weekLabel}
            </div>
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(w => w + 1)}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}
              className="bg-slate-800 border-slate-700 text-white hover:bg-slate-700">
              Current Week
            </Button>
          </div>
        </div>

        {/* Hotel Filter */}
        <div className="flex items-center gap-4">
          <Label className="text-slate-300">Filter by Hotel:</Label>
          <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
            <SelectTrigger className="w-48 bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              <SelectItem value="all" className="text-white">All Hotels</SelectItem>
              {hotels.map(h => (
                <SelectItem key={h.id} value={h.id} className="text-white">{h.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Group Bookings</p>
              <p className="text-2xl font-bold text-white mt-1">{weekProduction.length}</p>
              <p className="text-xs text-slate-500 mt-1">{totalRoomNights.toLocaleString()} room nights</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Total Revenue</p>
              <p className="text-2xl font-bold text-green-400 mt-1">${totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1">Definite: ${definiteRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">RFPs</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{weekRFPs.length}</p>
              <p className="text-xs text-slate-500 mt-1">{weekRFPs.reduce((s, r) => s + (r.potential_room_nights || 0), 0).toLocaleString()} potential RN</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-wide">Tasks Due</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{weekTasks.length}</p>
              <p className="text-xs text-slate-500 mt-1">{weekTasks.filter(t => t.status === 'completed').length} completed</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="groups" className="w-full">
          <TabsList className="bg-slate-900/50 border border-slate-800">
            <TabsTrigger value="groups" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <Building2 className="w-4 h-4 mr-1" /> Groups
            </TabsTrigger>
            <TabsTrigger value="rfps" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <FileText className="w-4 h-4 mr-1" /> RFPs
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <CheckSquare className="w-4 h-4 mr-1" /> Tasks
            </TabsTrigger>
            <TabsTrigger value="activity" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <Users className="w-4 h-4 mr-1" /> Activity Logs
            </TabsTrigger>
            <TabsTrigger value="charts" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400">
              <TrendingUp className="w-4 h-4 mr-1" /> Charts
            </TabsTrigger>
          </TabsList>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4 mt-4">
            {weekProduction.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-8 text-center text-slate-400">No group bookings logged this week</CardContent>
              </Card>
            ) : (
              <>
                {/* By Hotel */}
                {Object.entries(productionByHotel).map(([hotelName, data]) => (
                  <Card key={hotelName} className="bg-slate-900/50 border-slate-800">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-base flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" /> {hotelName}
                        </CardTitle>
                        <div className="flex gap-3 text-sm">
                          <span className="text-slate-400">{data.roomNights.toLocaleString()} RN</span>
                          <span className="text-green-400 font-semibold">${data.revenue.toLocaleString()}</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-slate-400">Client</TableHead>
                            <TableHead className="text-slate-400">Status</TableHead>
                            <TableHead className="text-slate-400">Event Type</TableHead>
                            <TableHead className="text-right text-slate-400">Room Nights</TableHead>
                            <TableHead className="text-right text-slate-400">Revenue</TableHead>
                            <TableHead className="text-slate-400">Arrival</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.items.map(p => (
                            <TableRow key={p.id} className="border-slate-700 hover:bg-slate-800/50">
                              <TableCell className="text-white font-medium">{p.client_name}</TableCell>
                              <TableCell>
                                <Badge className={`text-xs ${STATUS_COLORS[p.status] || 'bg-slate-700 text-slate-300'}`}>
                                  {p.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-300 capitalize">{p.event_type || '—'}</TableCell>
                              <TableCell className="text-right text-slate-300">{(p.room_nights || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right text-green-400">${(p.revenue || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-slate-300">{p.arrival_date || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}

                {/* Summary by Event Type */}
                <Card className="bg-slate-900/50 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white text-base">Summary by Event Type</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-slate-400">Event Type</TableHead>
                          <TableHead className="text-right text-slate-400">Count</TableHead>
                          <TableHead className="text-right text-slate-400">Room Nights</TableHead>
                          <TableHead className="text-right text-slate-400">Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(productionByEventType).map(([type, d]) => (
                          <TableRow key={type} className="border-slate-700">
                            <TableCell className="text-white capitalize">{type}</TableCell>
                            <TableCell className="text-right text-slate-300">{d.items.length}</TableCell>
                            <TableCell className="text-right text-slate-300">{d.roomNights.toLocaleString()}</TableCell>
                            <TableCell className="text-right text-green-400">${d.revenue.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* RFPs Tab */}
          <TabsContent value="rfps" className="space-y-4 mt-4">
            {weekRFPs.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-8 text-center text-slate-400">No RFPs activity this week</CardContent>
              </Card>
            ) : Object.entries(rfpsByHotel).map(([hotelName, rfps]) => (
              <Card key={hotelName} className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-400" /> {hotelName}
                    </CardTitle>
                    <span className="text-slate-400 text-sm">{rfps.length} RFP{rfps.length > 1 ? 's' : ''}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-400">Company</TableHead>
                        <TableHead className="text-slate-400">Contact</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-right text-slate-400">Potential RN</TableHead>
                        <TableHead className="text-slate-400">Submitted</TableHead>
                        <TableHead className="text-slate-400">Seller</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rfps.map(r => (
                        <TableRow key={r.id} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-white font-medium">{r.company_name}</TableCell>
                          <TableCell className="text-slate-300">{r.contact_person || '—'}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${RFP_STATUS_COLORS[r.status] || 'bg-slate-700 text-slate-300'}`}>
                              {r.status?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-slate-300">{(r.potential_room_nights || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-slate-300">{r.submission_date || '—'}</TableCell>
                          <TableCell className="text-slate-300">{r.seller_name || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="space-y-4 mt-4">
            {weekTasks.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-8 text-center text-slate-400">No tasks due this week</CardContent>
              </Card>
            ) : (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-base">Tasks Due This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-400">Title</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Priority</TableHead>
                        <TableHead className="text-slate-400">Assigned To</TableHead>
                        <TableHead className="text-slate-400">Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {weekTasks.map(t => (
                        <TableRow key={t.id} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-white font-medium">{t.title}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${TASK_STATUS_COLORS[t.status] || 'bg-slate-700 text-slate-300'}`}>
                              {t.status?.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${t.priority === 'urgent' ? 'bg-red-900 text-red-300' : t.priority === 'high' ? 'bg-orange-900 text-orange-300' : 'bg-slate-700 text-slate-300'}`}>
                              {t.priority}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{t.assigned_to || '—'}</TableCell>
                          <TableCell className="text-slate-300">{t.due_date}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {/* Status summary */}
                  <div className="flex gap-4 mt-4 flex-wrap">
                    {Object.entries(tasksByStatus).map(([s, items]) => (
                      <div key={s} className="flex items-center gap-2">
                        <Badge className={`text-xs ${TASK_STATUS_COLORS[s]}`}>{s.replace('_', ' ')}</Badge>
                        <span className="text-slate-400 text-sm">{items.length}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="activity" className="space-y-4 mt-4">
            {weekActivityLogs.length === 0 ? (
              <Card className="bg-slate-900/50 border-slate-800">
                <CardContent className="p-8 text-center text-slate-400">No activity logs this week</CardContent>
              </Card>
            ) : Object.entries(activityByHotel).map(([hotelName, logs]) => (
              <Card key={hotelName} className="bg-slate-900/50 border-slate-800">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-blue-400" /> {hotelName}
                    </CardTitle>
                    <span className="text-slate-400 text-sm">{logs.length} activities</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-400">Client</TableHead>
                        <TableHead className="text-slate-400">Activity Type</TableHead>
                        <TableHead className="text-slate-400">Date</TableHead>
                        <TableHead className="text-slate-400">Seller</TableHead>
                        <TableHead className="text-slate-400">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(a => (
                        <TableRow key={a.id} className="border-slate-700 hover:bg-slate-800/50">
                          <TableCell className="text-white font-medium">{a.client_name}</TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${STATUS_COLORS[a.status] || 'bg-slate-700 text-slate-300'}`}>
                              {a.status?.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-300">{a.activity_date}</TableCell>
                          <TableCell className="text-slate-300">{a.seller_name || '—'}</TableCell>
                          <TableCell className="text-slate-400 max-w-xs truncate">{a.notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-6 mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue by Hotel */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-base">Revenue by Hotel</CardTitle>
                </CardHeader>
                <CardContent>
                  {hotelChartData.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={hotelChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                        <XAxis dataKey="hotel" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                        <Legend wrapperStyle={{ color: '#e2e8f0', fontSize: 12 }} />
                        <Bar dataKey="revenue" fill="#3b82f6" name="Revenue ($)" />
                        <Bar dataKey="roomNights" fill="#10b981" name="Room Nights" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Status Breakdown */}
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white text-base">Groups by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {statusChartData.length === 0 ? (
                    <p className="text-slate-400 text-center py-8">No data</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
                        <XAxis dataKey="status" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569', color: '#e2e8f0' }} />
                        <Legend wrapperStyle={{ color: '#e2e8f0', fontSize: 12 }} />
                        <Bar dataKey="count" fill="#8b5cf6" name="Count" />
                        <Bar dataKey="revenue" fill="#f59e0b" name="Revenue ($)" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Weekly Overview Table */}
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white text-base">Weekly Activity Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-slate-400">Activity Type</TableHead>
                      <TableHead className="text-right text-slate-400">Count</TableHead>
                      <TableHead className="text-right text-slate-400">Room Nights</TableHead>
                      <TableHead className="text-right text-slate-400">Revenue / Value</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="border-slate-700">
                      <TableCell className="text-white">Group Bookings</TableCell>
                      <TableCell className="text-right text-slate-300">{weekProduction.length}</TableCell>
                      <TableCell className="text-right text-slate-300">{totalRoomNights.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-400">${totalRevenue.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-slate-700">
                      <TableCell className="text-white">— of which Definite</TableCell>
                      <TableCell className="text-right text-slate-300">{weekProduction.filter(p => ['definite','actual'].includes(p.status)).length}</TableCell>
                      <TableCell className="text-right text-slate-300">{definiteRN.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-400">${definiteRevenue.toLocaleString()}</TableCell>
                    </TableRow>
                    <TableRow className="border-slate-700">
                      <TableCell className="text-white">RFPs</TableCell>
                      <TableCell className="text-right text-slate-300">{weekRFPs.length}</TableCell>
                      <TableCell className="text-right text-slate-300">{weekRFPs.reduce((s, r) => s + (r.potential_room_nights || 0), 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-slate-300">—</TableCell>
                    </TableRow>
                    <TableRow className="border-slate-700">
                      <TableCell className="text-white">Tasks Due</TableCell>
                      <TableCell className="text-right text-slate-300">{weekTasks.length}</TableCell>
                      <TableCell className="text-right text-slate-300">—</TableCell>
                      <TableCell className="text-right text-slate-300">—</TableCell>
                    </TableRow>
                    <TableRow className="border-slate-700">
                      <TableCell className="text-white">Activity Logs</TableCell>
                      <TableCell className="text-right text-slate-300">{weekActivityLogs.length}</TableCell>
                      <TableCell className="text-right text-slate-300">—</TableCell>
                      <TableCell className="text-right text-slate-300">—</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}