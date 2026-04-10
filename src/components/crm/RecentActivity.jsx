import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function RecentActivity() {
  const { data: activities = [] } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date', 8)
  });

  const statusColors = {
    solicitation_call: 'bg-blue-100 text-blue-800',
    sent_proposal: 'bg-purple-100 text-purple-800',
    follow_up: 'bg-yellow-100 text-yellow-800',
    site_visit: 'bg-green-100 text-green-800',
    tentative: 'bg-orange-100 text-orange-800',
    definite: 'bg-emerald-100 text-emerald-800',
    lost: 'bg-red-100 text-red-800'
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-400" />
          <CardTitle className="text-base text-white">Recent Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-slate-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5" />
            No activity logged yet
          </div>
        ) : (
          <div className="space-y-2.5">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-700 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200 truncate">
                    {activity.client_name}
                  </div>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${statusColors[activity.status] || 'bg-slate-700 text-slate-300'}`}>
                    {activity.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex-shrink-0">
                  {format(new Date(activity.activity_date), 'MMM d')}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}