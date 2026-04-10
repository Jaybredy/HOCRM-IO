import React, { useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, TrendingUp, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function GoalNotifications({ goals, progress, onUpdateGoal }) {
  useEffect(() => {
    goals.forEach(goal => {
      const goalProgress = progress[goal.id];
      if (!goalProgress) return;

      const thresholds = goal.notification_thresholds || [50, 75, 90, 100];
      const sentNotifications = goal.notifications_sent || [];

      // Check revenue progress
      const revenueProgress = goalProgress.revenueProgress || 0;
      
      thresholds.forEach(threshold => {
        if (revenueProgress >= threshold && !sentNotifications.includes(threshold)) {
          // Send notification
          const message = threshold === 100 
            ? `🎉 ${goal.seller_name} has achieved their ${goal.period_type} goal!`
            : `🎯 ${goal.seller_name} has reached ${threshold}% of their ${goal.period_type} goal`;

          toast.success(message, {
            duration: 5000,
            icon: threshold === 100 ? <CheckCircle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />
          });

          // Update goal to mark notification as sent
          onUpdateGoal(goal.id, {
            ...goal,
            notifications_sent: [...sentNotifications, threshold]
          });
        }
      });
    });
  }, [goals, progress, onUpdateGoal]);

  // Get recent notifications
  const recentAlerts = goals
    .map(goal => {
      const goalProgress = progress[goal.id];
      if (!goalProgress) return null;

      const revenueProgress = goalProgress.revenueProgress || 0;
      const isNearTarget = revenueProgress >= 75 && revenueProgress < 100;
      const hasAchieved = revenueProgress >= 100;

      if (hasAchieved || isNearTarget) {
        return {
          goal,
          progress: revenueProgress,
          type: hasAchieved ? 'achieved' : 'near'
        };
      }
      return null;
    })
    .filter(Boolean);

  if (recentAlerts.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Goal Alerts</h3>
        </div>
        <div className="space-y-2">
          {recentAlerts.map(alert => (
            <div key={alert.goal.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
              <div className="flex items-center gap-3">
                {alert.type === 'achieved' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                )}
                <div>
                  <div className="font-medium">{alert.goal.seller_name}</div>
                  <div className="text-sm text-gray-600">
                    {alert.type === 'achieved' ? 'Goal achieved!' : 'Approaching target'}
                  </div>
                </div>
              </div>
              <Badge variant={alert.type === 'achieved' ? 'default' : 'secondary'}>
                {alert.progress.toFixed(0)}%
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}