import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Activity, Calendar } from 'lucide-react';

export default function ActivityVsArrivalsOverview({ production, activityLogs, dateRange }) {
  // Count bookings created within date range
  const bookingsCreated = production.filter(p => 
    p.created_date && 
    p.created_date.split('T')[0] >= dateRange.start && 
    p.created_date.split('T')[0] <= dateRange.end
  ).length;

  // Count activities logged within date range
  const activitiesLogged = activityLogs.filter(a => 
    a.activity_date && 
    a.activity_date >= dateRange.start && 
    a.activity_date <= dateRange.end
  ).length;

  // Count arrivals within date range
  const arrivalsCount = production.filter(p => 
    p.arrival_date && 
    p.arrival_date >= dateRange.start && 
    p.arrival_date <= dateRange.end
  ).length;

  const totalActivity = bookingsCreated + activitiesLogged;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Created Activity */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Created Activity</p>
                <div className="text-4xl font-bold text-white">{totalActivity}</div>
                <p className="text-xs text-slate-500 mt-2">
                  {bookingsCreated} bookings + {activitiesLogged} activities
                </p>
              </div>
              <Activity className="w-8 h-8 text-blue-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Arrivals */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Guest Arrivals</p>
                <div className="text-4xl font-bold text-white">{arrivalsCount}</div>
                <p className="text-xs text-slate-500 mt-2">
                  Bookings with arrival date
                </p>
              </div>
              <Calendar className="w-8 h-8 text-green-400 opacity-50" />
            </div>
          </CardContent>
        </Card>

        {/* Activity to Arrival Ratio */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Activity Ratio</p>
                <div className="text-4xl font-bold text-white">
                  {arrivalsCount > 0 ? (totalActivity / arrivalsCount).toFixed(1) : '—'}
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Activity per arrival
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-400 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="p-6">
          <p className="text-sm text-slate-300">
            {totalActivity === 0 && arrivalsCount === 0 && "No data for selected period."}
            {totalActivity > 0 && arrivalsCount === 0 && "Activities logged but no guest arrivals scheduled in this period."}
            {totalActivity === 0 && arrivalsCount > 0 && "Guest arrivals scheduled but no activities logged yet."}
            {totalActivity > 0 && arrivalsCount > 0 && `Strong activity tracking with ${totalActivity} actions supporting ${arrivalsCount} arriving guests.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}