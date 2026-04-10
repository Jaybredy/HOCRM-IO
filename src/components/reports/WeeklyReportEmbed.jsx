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
import { format, isWithinInterval, parseISO, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { CalendarDays, Building2, Users, FileText, CheckSquare, TrendingUp, FileDown, FileSpreadsheet } from 'lucide-react';
import { Input } from "@/components/ui/input";

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

export default function WeeklyReportEmbed({ onExport }) {
  const [selectedHotelId, setSelectedHotelId] = useState('all');
  const today = new Date();
  const defaultStart = startOfWeek(today, { weekStartsOn: 1 });
  const defaultEnd = endOfWeek(today, { weekStartsOn: 1 });
  const [dateFrom, setDateFrom] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(defaultEnd, 'yyyy-MM-dd'));

  const weekStart = dateFrom ? parseISO(dateFrom) : defaultStart;
  const weekEnd = dateTo ? parseISO(dateTo) : defaultEnd;
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  const { data: hotels = [] } = useQuery({ queryKey: ['hotels'], queryFn: () => base44.entities.Hotel.list() });
  const { data: allProduction = [] } = useQuery({ queryKey: ['production'], queryFn: () => base44.entities.ProductionItem.list('-activity_date') });
  const { data: allRFPs = [] } = useQuery({ queryKey: ['rfps'], queryFn: () => base44.entities.RFP.list('-created_date') });
  const { data: allTasks = [] } = useQuery({ queryKey: ['tasks'], queryFn: () => base44.entities.Task.list('-due_date') });
  const { data: allActivityLogs = [] } = useQuery({ queryKey: ['activity_logs'], queryFn: () => base44.entities.ActivityLog.list('-activity_date') });

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || 'Unknown';

  const inWeek = (dateStr) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), { start: weekStart, end: weekEnd }); }
    catch { return false; }
  };

  const hotelFilter = (item) => selectedHotelId === 'all' || item.hotel_id === selectedHotelId;

  const weekProduction = allProduction.filter(p => inWeek(p.activity_date) && hotelFilter(p));
  const weekRFPs = allRFPs.filter(r => (inWeek(r.created_date) || inWeek(r.submission_date)) && hotelFilter(r));
  const weekTasks = allTasks.filter(t => inWeek(t.due_date));
  const weekActivityLogs = allActivityLogs.filter(a => inWeek(a.activity_date) && hotelFilter(a));

  const totalRoomNights = weekProduction.reduce((s, p) => s + (p.room_nights || 0), 0);
  const totalRevenue = weekProduction.reduce((s, p) => s + (p.revenue || 0), 0);
  const definiteRevenue = weekProduction.filter(p => ['definite','actual'].includes(p.status)).reduce((s, p) => s + (p.revenue || 0), 0);

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

  const hotelChartData = Object.entries(productionByHotel).map(([name, d]) => ({ hotel: name, roomNights: d.roomNights, revenue: d.revenue }));

  const statusChartData = ['solicitation','prospect','tentative','definite','actual','lost'].map(s => ({
    status: s,
    count: weekProduction.filter(p => p.status === s).length,
    revenue: weekProduction.filter(p => p.status === s).reduce((sum, p) => sum + (p.revenue || 0), 0),
  })).filter(d => d.count > 0);

  const rfpsByHotel = useMemo(() => {
    const byHotel = {};
    weekRFPs.forEach(r => {
      const hName = getHotelName(r.hotel_id);
      if (!byHotel[hName]) byHotel[hName] = [];
      byHotel[hName].push(r);
    });
    return byHotel;
  }, [weekRFPs, hotels]);

  const tasksByStatus = useMemo(() => {
    const byStatus = {};
    weekTasks.forEach(t => {
      const s = t.status || 'todo';
      if (!byStatus[s]) byStatus[s] = [];
      byStatus[s].push(t);
    });
    return byStatus;
  }, [weekTasks]);

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
    <div className="space-y-6 mt-4">
      {/* Date Range + Hotel Filter */}
      <div className="flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-slate-700 text-xs">From</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-white border-slate-300 text-slate-900"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-slate-400 text-xs">To</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-white border-slate-300 text-slate-900"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => { setDateFrom(format(defaultStart, 'yyyy-MM-dd')); setDateTo(format(defaultEnd, 'yyyy-MM-dd')); }}
            className="bg-cyan-600 border-cyan-600 text-white hover:bg-cyan-700">
            This Week
          </Button>
        </div>
        <div className="flex items-end gap-3 flex-wrap md:ml-auto">
          <div className="space-y-1">
            <Label className="text-slate-300 text-xs">Hotel</Label>
            <Select value={selectedHotelId} onValueChange={setSelectedHotelId}>
              <SelectTrigger className="w-44 bg-white border-slate-300 text-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-300">
                <SelectItem value="all" className="text-slate-900">All Hotels</SelectItem>
                {hotels.map(h => <SelectItem key={h.id} value={h.id} className="text-slate-900">{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {onExport && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onExport('csv', dateFrom, dateTo)}
                className="bg-cyan-600 border-cyan-600 text-white hover:bg-cyan-700">
                <FileDown className="w-4 h-4 mr-1.5" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => onExport('excel', dateFrom, dateTo)}
                className="bg-cyan-600 border-cyan-600 text-white hover:bg-cyan-700">
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Group Bookings</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{weekProduction.length}</p>
            <p className="text-xs text-slate-300 mt-1">{totalRoomNights.toLocaleString()} room nights</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Total Revenue</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">${totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-slate-300 mt-1">Definite: ${definiteRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">RFPs</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{weekRFPs.length}</p>
            <p className="text-xs text-slate-300 mt-1">{weekRFPs.reduce((s, r) => s + (r.potential_room_nights || 0), 0).toLocaleString()} potential RN</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide">Tasks Due</p>
            <p className="text-2xl font-bold text-cyan-400 mt-1">{weekTasks.length}</p>
            <p className="text-xs text-slate-300 mt-1">{weekTasks.filter(t => t.status === 'completed').length} completed</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="groups" className="w-full">
        <TabsList className="bg-slate-800 border border-slate-700">
          <TabsTrigger value="groups" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <Building2 className="w-4 h-4 mr-1" /> Groups
          </TabsTrigger>
          <TabsTrigger value="rfps" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <FileText className="w-4 h-4 mr-1" /> RFPs
          </TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <CheckSquare className="w-4 h-4 mr-1" /> Tasks
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <Users className="w-4 h-4 mr-1" /> Activity Logs
          </TabsTrigger>
          <TabsTrigger value="charts" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
            <TrendingUp className="w-4 h-4 mr-1" /> Charts
          </TabsTrigger>
        </TabsList>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4 mt-4">
          {weekProduction.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center text-slate-400">No group bookings logged this week</CardContent>
            </Card>
          ) : (
            Object.entries(productionByHotel).map(([hotelName, data]) => (
              <Card key={hotelName} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-cyan-400" /> {hotelName}
                    </CardTitle>
                    <div className="flex gap-3 text-sm">
                      <span className="text-slate-400">{data.roomNights.toLocaleString()} RN</span>
                      <span className="text-cyan-400 font-semibold">${data.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-300">Client</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300">Event Type</TableHead>
                        <TableHead className="text-slate-300 text-right">RN</TableHead>
                        <TableHead className="text-slate-300 text-right">Revenue</TableHead>
                        <TableHead className="text-slate-300">Seller</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map(p => (
                        <TableRow key={p.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">{p.client_name}</TableCell>
                          <TableCell><Badge className={STATUS_COLORS[p.status] || 'bg-slate-700 text-slate-300'}>{p.status}</Badge></TableCell>
                          <TableCell className="text-slate-400">{p.event_type || '—'}</TableCell>
                          <TableCell className="text-right text-slate-400">{(p.room_nights || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-cyan-400">${(p.revenue || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-slate-400">{p.seller_name || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* RFPs Tab */}
        <TabsContent value="rfps" className="space-y-4 mt-4">
          {weekRFPs.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center text-slate-400">No RFPs this week</CardContent>
            </Card>
          ) : (
            Object.entries(rfpsByHotel).map(([hotelName, rfps]) => (
              <Card key={hotelName} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" /> {hotelName}
                    <span className="text-slate-400 text-sm font-normal ml-2">{rfps.length} RFP{rfps.length !== 1 ? 's' : ''}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-300">Company</TableHead>
                        <TableHead className="text-slate-300">Status</TableHead>
                        <TableHead className="text-slate-300 text-right">Potential RN</TableHead>
                        <TableHead className="text-slate-300">Seller</TableHead>
                        <TableHead className="text-slate-300">Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rfps.map(r => (
                        <TableRow key={r.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">{r.company_name}</TableCell>
                          <TableCell><Badge className={RFP_STATUS_COLORS[r.status] || 'bg-slate-700 text-slate-300'}>{r.status?.replace('_', ' ')}</Badge></TableCell>
                          <TableCell className="text-right text-slate-400">{(r.potential_room_nights || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-slate-400">{r.seller_name || '—'}</TableCell>
                          <TableCell className="text-slate-400">{r.submission_date || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4 mt-4">
          {weekTasks.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center text-slate-400">No tasks due this week</CardContent>
            </Card>
          ) : (
            Object.entries(tasksByStatus).map(([status, tasks]) => (
              <Card key={status} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-white text-base capitalize">{status.replace('_', ' ')}</CardTitle>
                    <Badge className={TASK_STATUS_COLORS[status]}>{tasks.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tasks.map(t => (
                      <div key={t.id} className="flex items-start justify-between p-2 rounded bg-slate-900/50">
                        <div>
                          <p className="text-white text-sm font-medium">{t.title}</p>
                          {t.description && <p className="text-slate-400 text-xs mt-0.5">{t.description}</p>}
                        </div>
                        <div className="text-right text-xs text-slate-400 shrink-0 ml-4">
                          <p>Due: {t.due_date}</p>
                          {t.assigned_to && <p>{t.assigned_to}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Activity Logs Tab */}
        <TabsContent value="activity" className="space-y-4 mt-4">
          {weekActivityLogs.length === 0 ? (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center text-slate-400">No activity logs this week</CardContent>
            </Card>
          ) : (
            Object.entries(activityByHotel).map(([hotelName, logs]) => (
              <Card key={hotelName} className="bg-slate-800 border-slate-700">
                <CardHeader className="pb-2">
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-400" /> {hotelName}
                    <span className="text-slate-400 text-sm font-normal ml-2">{logs.length} log{logs.length !== 1 ? 's' : ''}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-slate-300">Client</TableHead>
                        <TableHead className="text-slate-300">Activity Type</TableHead>
                        <TableHead className="text-slate-300">Date</TableHead>
                        <TableHead className="text-slate-300">Seller</TableHead>
                        <TableHead className="text-slate-300">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map(a => (
                        <TableRow key={a.id} className="border-slate-700">
                          <TableCell className="text-white font-medium">{a.client_name}</TableCell>
                          <TableCell className="text-slate-400">{a.status?.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-slate-400">{a.activity_date}</TableCell>
                          <TableCell className="text-slate-400">{a.seller_name || '—'}</TableCell>
                          <TableCell className="text-slate-500 text-xs max-w-[200px] truncate">{a.notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Charts Tab */}
        <TabsContent value="charts" className="space-y-6 mt-4">
          {hotelChartData.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white text-base">Revenue & Room Nights by Hotel</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={hotelChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="hotel" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#f8f9fa', border: '1px solid #cbd5e1', color: '#1e293b' }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="Revenue ($)" />
                    <Bar yAxisId="right" dataKey="roomNights" fill="#10b981" name="Room Nights" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {statusChartData.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader><CardTitle className="text-white text-base">Bookings by Status</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={statusChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                    <XAxis dataKey="status" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#f8f9fa', border: '1px solid #cbd5e1', color: '#1e293b' }} />
                    <Bar dataKey="count" fill="#8b5cf6" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
          {hotelChartData.length === 0 && statusChartData.length === 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-8 text-center text-slate-400">No chart data for this week</CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}