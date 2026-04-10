import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, addDays, differenceInDays } from "date-fns";
import { Calendar, Clock, TrendingUp, DollarSign } from "lucide-react";

export default function BDTimeline({ data }) {
  const [timelineFilter, setTimelineFilter] = useState('all');
  
  const filterByTimeline = (leads) => {
    if (timelineFilter === 'all') return leads;
    
    const today = new Date();
    const daysAhead = parseInt(timelineFilter);
    const futureDate = addDays(today, daysAhead);
    
    return leads.filter(lead => {
      if (!lead.created_date) return false;
      const leadDate = new Date(lead.created_date);
      return leadDate >= addDays(today, -daysAhead) && leadDate <= futureDate;
    });
  };
  
  const filteredData = filterByTimeline(data);
  
  const sortedData = [...filteredData].sort((a, b) => 
    new Date(b.created_date) - new Date(a.created_date)
  );

  const getLeadValue = (lead) => {
    return Object.values(lead.service_pricing || {}).reduce((sum, price) => sum + price, 0);
  };

  const statusColors = {
    reached_out: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-yellow-100 text-yellow-800',
    proposal_sent: 'bg-purple-100 text-purple-800',
    signed_agreement: 'bg-green-100 text-green-800',
    closed_lost: 'bg-red-100 text-red-800'
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            BD Activity Timeline
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
              Last 30 Days
            </Button>
            <Button
              variant={timelineFilter === '60' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimelineFilter('60')}
            >
              Last 60 Days
            </Button>
            <Button
              variant={timelineFilter === '90' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimelineFilter('90')}
            >
              Last 90 Days
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {sortedData.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No leads to display</p>
          ) : (
            sortedData.map(lead => {
              const daysAgo = lead.created_date ? differenceInDays(
                new Date(),
                new Date(lead.created_date)
              ) : null;
              
              return (
                <div key={lead.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{lead.hotel_name}</h4>
                        <Badge className={statusColors[lead.status]}>
                          {lead.status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{lead.contact_person}</p>
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-4 text-sm">
                      {lead.created_date && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-blue-600" />
                          <div>
                            <p className="text-xs text-gray-500">Created</p>
                            <p className="font-medium">{format(new Date(lead.created_date), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                      )}
                      
                      {daysAgo !== null && (
                        <div className={`px-3 py-1 rounded-lg ${
                          daysAgo <= 7 ? 'bg-green-100 text-green-800' :
                          daysAgo <= 30 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          <p className="text-xs font-semibold">{daysAgo} days ago</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-4 mt-3 pt-3 border-t text-sm">
                    <span className="text-gray-600">
                      <strong>{(lead.services || []).length}</strong> services
                    </span>
                    <span className="text-gray-600 flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      <strong>${getLeadValue(lead).toLocaleString()}</strong>
                    </span>
                    {lead.seller_name && (
                      <span className="text-gray-600">
                        Owner: <strong>{lead.seller_name}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}