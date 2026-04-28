import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, TrendingUp, Award, DollarSign, BarChart3, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

export default function ActualResultsManager({ hotels }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [activeTab, setActiveTab] = useState('definite_actualized');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    hotel_id: '',
    result_type: 'definite_actualized',
    account_name: '',
    description: '',
    date_signed: '',
    start_date: '',
    end_date: '',
    projected_room_nights: '',
    projected_revenue: '',
    actual_room_nights: '',
    actual_revenue: '',
    marketing_spend: '',
    seller_name: '',
    status: 'active',
    notes: ''
  });

  const { data: results = [] } = useQuery({
    queryKey: ['actualResults'],
    queryFn: () => base44.entities.ActualResults.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ActualResults.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actualResults'] });
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ActualResults.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actualResults'] });
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ActualResults.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['actualResults'] })
  });

  const resetForm = () => {
    setFormData({
      hotel_id: '',
      result_type: activeTab,
      account_name: '',
      description: '',
      date_signed: '',
      start_date: '',
      end_date: '',
      projected_room_nights: '',
      projected_revenue: '',
      actual_room_nights: '',
      actual_revenue: '',
      marketing_spend: '',
      seller_name: '',
      status: 'active',
      notes: ''
    });
    setEditItem(null);
    setShowDialog(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Coerce empty strings to null for typed columns. Postgres rejects ""
    // for DATE / NUMERIC columns with code 22007 / 22P02.
    const dateFields = ['date_signed', 'start_date', 'end_date'];
    const numericFields = ['projected_room_nights', 'projected_revenue', 'actual_room_nights', 'actual_revenue', 'marketing_spend'];
    const cleaned = { ...formData };
    for (const k of [...dateFields, ...numericFields]) {
      if (cleaned[k] === '' || cleaned[k] === undefined) cleaned[k] = null;
    }
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data: cleaned });
    } else {
      createMutation.mutate(cleaned);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setFormData(item);
    setShowDialog(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this result?')) {
      deleteMutation.mutate(id);
    }
  };

  const getHotelName = (hotelId) => {
    return hotels.find(h => h.id === hotelId)?.name || 'Unknown';
  };

  const filteredResults = results.filter(r => {
    if (r.result_type !== activeTab) return false;
    if (dateRange.start && r.start_date < dateRange.start) return false;
    if (dateRange.end && r.start_date > dateRange.end) return false;
    return true;
  });

  const calculateROI = (item) => {
    if (item.marketing_spend > 0 && item.actual_revenue > 0) {
      return (((item.actual_revenue - item.marketing_spend) / item.marketing_spend) * 100).toFixed(1);
    }
    return null;
  };

  const totalActualRevenue = filteredResults.reduce((sum, r) => sum + (r.actual_revenue || 0), 0);
  const totalActualRoomNights = filteredResults.reduce((sum, r) => sum + (r.actual_room_nights || 0), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Actualized Results & Impact
            </CardTitle>
            <Button onClick={() => { setFormData({ ...formData, result_type: activeTab }); setShowDialog(true); }}>
              <Plus className="w-4 h-4 mr-2" />
              Log Result
            </Button>
          </div>
          <div className="flex gap-3 items-center">
            <Input
              type="date"
              placeholder="Start date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-40"
            />
            <span className="text-gray-500">to</span>
            <Input
              type="date"
              placeholder="End date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-40"
            />
            {(dateRange.start || dateRange.end) && (
              <Button variant="outline" size="sm" onClick={() => setDateRange({ start: '', end: '' })}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Total Actual Revenue</div>
              <div className="text-2xl font-bold text-green-600">${totalActualRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Total Room Nights</div>
              <div className="text-2xl font-bold text-blue-600">{totalActualRoomNights.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-sm text-gray-600">Active Results</div>
              <div className="text-2xl font-bold text-purple-600">{filteredResults.length}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setFormData({ ...formData, result_type: v }); }}>
          <TabsList>
            <TabsTrigger value="definite_actualized">Definite Business</TabsTrigger>
            <TabsTrigger value="transient_account">Transient Accounts</TabsTrigger>
            <TabsTrigger value="marketing_initiative">Marketing Initiatives</TabsTrigger>
          </TabsList>

          {['definite_actualized', 'transient_account', 'marketing_initiative'].map(type => (
            <TabsContent key={type} value={type} className="space-y-4">
              {filteredResults.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No results logged yet</div>
              ) : (
                filteredResults.map(item => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-lg">{item.account_name}</h4>
                            <Badge className={item.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                              {item.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{getHotelName(item.hotel_id)}</p>
                          {item.description && (
                            <p className="text-sm text-gray-700 mb-3">{item.description}</p>
                          )}
                          
                          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            {item.projected_room_nights > 0 && (
                              <div>
                                <div className="text-gray-500">Projected RN</div>
                                <div className="font-medium">{item.projected_room_nights}</div>
                              </div>
                            )}
                            {item.actual_room_nights > 0 && (
                              <div>
                                <div className="text-gray-500">Actual RN</div>
                                <div className="font-semibold text-blue-600">{item.actual_room_nights}</div>
                              </div>
                            )}
                            {item.projected_revenue > 0 && (
                              <div>
                                <div className="text-gray-500">Projected Revenue</div>
                                <div className="font-medium">${item.projected_revenue.toLocaleString()}</div>
                              </div>
                            )}
                            {item.actual_revenue > 0 && (
                              <div>
                                <div className="text-gray-500">Actual Revenue</div>
                                <div className="font-semibold text-green-600">${item.actual_revenue.toLocaleString()}</div>
                              </div>
                            )}
                            {item.marketing_spend > 0 && (
                              <div>
                                <div className="text-gray-500">Marketing Spend</div>
                                <div className="font-medium">${item.marketing_spend.toLocaleString()}</div>
                              </div>
                            )}
                            {calculateROI(item) && (
                              <div>
                                <div className="text-gray-500">ROI</div>
                                <div className="font-semibold text-purple-600">{calculateROI(item)}%</div>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-4 mt-3 pt-3 border-t text-xs text-gray-500">
                            {item.start_date && <span>Start: {format(new Date(item.start_date), 'MMM d, yyyy')}</span>}
                            {item.end_date && <span>End: {format(new Date(item.end_date), 'MMM d, yyyy')}</span>}
                            {item.seller_name && <span>By: {item.seller_name}</span>}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Dialog Form */}
        <Dialog open={showDialog} onOpenChange={(open) => { if (!open) resetForm(); else setShowDialog(open); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editItem ? 'Edit' : 'Log'} Actual Result</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hotel *</Label>
                  <Select value={formData.hotel_id} onValueChange={(val) => setFormData({...formData, hotel_id: val})} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select hotel" />
                    </SelectTrigger>
                    <SelectContent>
                      {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Account/Initiative Name *</Label>
                  <Input value={formData.account_name} onChange={(e) => setFormData({...formData, account_name: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input type="date" value={formData.start_date} onChange={(e) => setFormData({...formData, start_date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input type="date" value={formData.end_date} onChange={(e) => setFormData({...formData, end_date: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Projected Room Nights</Label>
                  <Input type="number" value={formData.projected_room_nights} onChange={(e) => setFormData({...formData, projected_room_nights: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Actual Room Nights</Label>
                  <Input type="number" value={formData.actual_room_nights} onChange={(e) => setFormData({...formData, actual_room_nights: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Projected Revenue ($)</Label>
                  <Input type="number" value={formData.projected_revenue} onChange={(e) => setFormData({...formData, projected_revenue: parseFloat(e.target.value)})} />
                </div>
                <div className="space-y-2">
                  <Label>Actual Revenue ($)</Label>
                  <Input type="number" value={formData.actual_revenue} onChange={(e) => setFormData({...formData, actual_revenue: parseFloat(e.target.value)})} />
                </div>
                {activeTab === 'marketing_initiative' && (
                  <div className="space-y-2">
                    <Label>Marketing Spend ($)</Label>
                    <Input type="number" value={formData.marketing_spend} onChange={(e) => setFormData({...formData, marketing_spend: parseFloat(e.target.value)})} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Seller Name</Label>
                  <Input value={formData.seller_name} onChange={(e) => setFormData({...formData, seller_name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({...formData, status: val})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
              </div>
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>Cancel</Button>
                <Button type="submit">{editItem ? 'Update' : 'Log'} Result</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}