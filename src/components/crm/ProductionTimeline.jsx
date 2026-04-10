import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, differenceInDays, addDays } from "date-fns";
import { Calendar, Clock, TrendingUp, CheckCircle } from "lucide-react";

export default function ProductionTimeline({ data, hotels }) {
  const [timelineFilter, setTimelineFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showActualDialog, setShowActualDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actualData, setActualData] = useState({
    actual_room_nights: '',
    actual_revenue: ''
  });

  const queryClient = useQueryClient();
  
  const createActualMutation = useMutation({
    mutationFn: (data) => base44.entities.ActualResults.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actualResults'] });
      setShowActualDialog(false);
      setSelectedItem(null);
      setActualData({ actual_room_nights: '', actual_revenue: '' });
    }
  });

  const filterByTimeline = (items) => {
    if (timelineFilter === 'all') return items;
    
    const today = new Date();
    const daysAhead = parseInt(timelineFilter);
    const futureDate = addDays(today, daysAhead);
    
    return items.filter(item => {
      const arrivalDate = new Date(item.arrival_date);
      return arrivalDate >= today && arrivalDate <= futureDate;
    });
  };

  const filterByStatus = (items) => {
    if (statusFilter === 'all') return items;
    return items.filter(item => item.status === statusFilter);
  };
  
  const filteredData = filterByStatus(filterByTimeline(data));

  const handleLogActual = (item) => {
    setSelectedItem(item);
    setActualData({
      actual_room_nights: item.room_nights || '',
      actual_revenue: item.revenue || ''
    });
    setShowActualDialog(true);
  };

  const handleSubmitActual = () => {
    const adr = actualData.actual_room_nights > 0 
      ? (actualData.actual_revenue / actualData.actual_room_nights).toFixed(2) 
      : 0;

    // Distribute daily rooms evenly
    const arrival = new Date(selectedItem.arrival_date);
    const departure = new Date(selectedItem.departure_date);
    const days = Math.ceil((departure - arrival) / (1000 * 60 * 60 * 24));
    const roomsPerDay = Math.round(parseFloat(actualData.actual_room_nights) / days);
    
    const dailyActualRooms = {};
    for (let i = 0; i < days; i++) {
      const date = new Date(arrival);
      date.setDate(date.getDate() + i);
      const dateStr = format(date, 'yyyy-MM-dd');
      dailyActualRooms[dateStr] = roomsPerDay;
    }

    createActualMutation.mutate({
      hotel_id: selectedItem.hotel_id,
      result_type: 'definite_actualized',
      production_item_id: selectedItem.id,
      account_name: selectedItem.client_name,
      start_date: selectedItem.arrival_date,
      end_date: selectedItem.departure_date,
      projected_room_nights: selectedItem.room_nights,
      projected_revenue: selectedItem.revenue,
      actual_room_nights: parseFloat(actualData.actual_room_nights),
      actual_revenue: parseFloat(actualData.actual_revenue),
      daily_actual_rooms: dailyActualRooms,
      seller_name: selectedItem.seller_name,
      status: 'completed',
      description: `ADR: $${adr}`
    });
  };

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'solicitation', label: 'Solicitation' },
    { value: 'prospect', label: 'Prospect' },
    { value: 'tentative', label: 'Tentative' },
    { value: 'definite', label: 'Definite' },
    { value: 'actual', label: 'Actual' },
    { value: 'lost', label: 'Lost' }
  ];
  const getHotelName = (hotelId) => {
    const hotel = hotels.find(h => h.id === hotelId);
    return hotel ? hotel.name : 'Unknown';
  };

  const sortedData = [...filteredData].sort((a, b) => 
    new Date(a.arrival_date) - new Date(b.arrival_date)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Production Timeline: Activity vs Arrival
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={timelineFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimelineFilter('all')}
              >
                All
              </Button>
              <Button
                variant={timelineFilter === '30' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimelineFilter('30')}
              >
                Next 30 Days
              </Button>
              <Button
                variant={timelineFilter === '60' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimelineFilter('60')}
              >
                Next 60 Days
              </Button>
              <Button
                variant={timelineFilter === '90' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimelineFilter('90')}
              >
                Next 90 Days
              </Button>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {statusOptions.map(opt => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {sortedData.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No production data to display</p>
          ) : (
            sortedData.map(item => {
              const leadTime = differenceInDays(
                new Date(item.arrival_date),
                new Date(item.activity_date)
              );
              
              return (
                <div key={item.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{item.client_name}</h4>
                        <Badge className="text-xs">{item.status}</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{getHotelName(item.hotel_id)}</p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <div>
                          <p className="text-xs text-gray-500">Activity Date</p>
                          <p className="font-medium">{format(new Date(item.activity_date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-green-600" />
                        <div>
                          <p className="text-xs text-gray-500">Arrival - Departure</p>
                          <p className="font-medium">
                            {format(new Date(item.arrival_date), 'MMM d')} - {format(new Date(item.departure_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-lg ${
                          leadTime > 90 ? 'bg-green-100 text-green-800' :
                          leadTime > 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-orange-100 text-orange-800'
                        }`}>
                          <p className="text-xs font-semibold">{leadTime} days lead</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-3 pt-3 border-t text-sm items-center justify-between">
                    <div className="flex gap-4">
                      <span className="text-gray-600">
                        <strong>{item.room_nights}</strong> room nights
                      </span>
                      <span className="text-gray-600">
                        <strong>${item.revenue.toLocaleString()}</strong> revenue
                      </span>
                      {item.seller_name && (
                        <span className="text-gray-600">
                          Seller: <strong>{item.seller_name}</strong>
                        </span>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleLogActual(item)}
                      className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Log Actuals
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Quick Add Actuals Dialog */}
        <Dialog open={showActualDialog} onOpenChange={setShowActualDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Actualized Results</DialogTitle>
            </DialogHeader>
            {selectedItem && (
              <div className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="font-semibold">{selectedItem.client_name}</div>
                  <div className="text-sm text-gray-600">{getHotelName(selectedItem.hotel_id)}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Projected: {selectedItem.room_nights} RN • ${selectedItem.revenue.toLocaleString()}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Actual Room Nights</label>
                    <Input
                      type="number"
                      value={actualData.actual_room_nights}
                      onChange={(e) => setActualData({...actualData, actual_room_nights: e.target.value})}
                      placeholder="Enter room nights"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Actual Revenue ($)</label>
                    <Input
                      type="number"
                      value={actualData.actual_revenue}
                      onChange={(e) => setActualData({...actualData, actual_revenue: e.target.value})}
                      placeholder="Enter revenue"
                    />
                  </div>
                  {actualData.actual_room_nights > 0 && actualData.actual_revenue > 0 && (
                    <div className="p-2 bg-blue-50 rounded text-sm">
                      <strong>ADR:</strong> ${(actualData.actual_revenue / actualData.actual_room_nights).toFixed(2)}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setShowActualDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSubmitActual}
                    disabled={!actualData.actual_room_nights || !actualData.actual_revenue}
                  >
                    Log Results
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}