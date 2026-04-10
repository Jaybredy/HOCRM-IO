import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Phone, FileText, Users, CheckCircle2, AlertCircle, MessageSquare } from "lucide-react";

const STATUS_META = {
  solicitation_call: { icon: Phone, color: 'text-blue-400', badge: 'bg-blue-100 text-blue-800' },
  sent_proposal: { icon: FileText, color: 'text-purple-400', badge: 'bg-purple-100 text-purple-800' },
  follow_up: { icon: MessageSquare, color: 'text-yellow-400', badge: 'bg-yellow-100 text-yellow-800' },
  site_visit: { icon: Users, color: 'text-cyan-400', badge: 'bg-cyan-100 text-cyan-800' },
  tentative: { icon: AlertCircle, color: 'text-orange-400', badge: 'bg-orange-100 text-orange-800' },
  definite: { icon: CheckCircle2, color: 'text-green-400', badge: 'bg-green-100 text-green-800' },
  lost: { icon: AlertCircle, color: 'text-red-400', badge: 'bg-red-100 text-red-800' },
};

export default function ClientActivityTimeline({ activities = [] }) {
  const sorted = [...activities].sort((a, b) => new Date(b.activity_date) - new Date(a.activity_date));

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">
          Communication Log ({activities.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No activities logged yet.</p>
        ) : (
          <div className="relative space-y-0">
            {sorted.map((activity, idx) => {
              const meta = STATUS_META[activity.status] || { icon: MessageSquare, color: 'text-slate-400', badge: 'bg-slate-100 text-slate-700' };
              const Icon = meta.icon;
              return (
                <div key={activity.id} className="flex gap-3 pb-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-7 h-7 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center shrink-0 ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    {idx < sorted.length - 1 && <div className="w-px flex-1 bg-slate-700 mt-1" />}
                  </div>
                  <div className="flex-1 pb-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`text-xs ${meta.badge}`}>{activity.status?.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-slate-500">
                        {activity.activity_date ? format(parseISO(activity.activity_date), 'MMM d, yyyy') : ''}
                      </span>
                      {activity.seller_name && <span className="text-xs text-slate-500">· {activity.seller_name}</span>}
                    </div>
                    {activity.notes && <p className="text-sm text-slate-300 mt-1 leading-relaxed">{activity.notes}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}