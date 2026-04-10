import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Users, User, Target } from "lucide-react";

export default function PerformanceDashboard({ goals, progress }) {
  const dashboardData = useMemo(() => {
    const companyGoals = goals.filter(g => g.goal_level === 'company');
    const teamGoals = goals.filter(g => g.goal_level === 'team');
    const individualGoals = goals.filter(g => g.goal_level === 'individual');

    // Aggregate by seller type
    const hotelSalesData = individualGoals
      .filter(g => g.seller_type === 'hotel_sales')
      .map(g => ({
        name: g.seller_name,
        target: g.target_revenue || 0,
        actual: progress[g.id]?.actualRevenue || 0,
        progress: progress[g.id]?.revenueProgress || 0
      }));

    const bdData = individualGoals
      .filter(g => g.seller_type === 'business_development')
      .map(g => ({
        name: g.seller_name,
        target: g.target_revenue || 0,
        actual: progress[g.id]?.actualRevenue || 0,
        progress: progress[g.id]?.revenueProgress || 0
      }));

    return { companyGoals, teamGoals, hotelSalesData, bdData };
  }, [goals, progress]);

  const calculateTeamTotals = (teamMembers) => {
    return teamMembers.reduce((acc, member) => ({
      targetRevenue: acc.targetRevenue + (member.target || 0),
      actualRevenue: acc.actualRevenue + (member.actual || 0)
    }), { targetRevenue: 0, actualRevenue: 0 });
  };

  const hotelSalesTotals = calculateTeamTotals(dashboardData.hotelSalesData);
  const bdTotals = calculateTeamTotals(dashboardData.bdData);

  return (
    <div className="space-y-6">
      {/* Company Overview */}
      {dashboardData.companyGoals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Company Goals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {dashboardData.companyGoals.map(goal => {
              const goalProgress = progress[goal.id] || {};
              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{goal.seller_name}</span>
                    <Badge variant="outline">{goal.period_type}</Badge>
                  </div>
                  {goal.target_revenue > 0 && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Revenue</span>
                        <span>${(goalProgress.actualRevenue || 0).toLocaleString()} / ${goal.target_revenue.toLocaleString()}</span>
                      </div>
                      <Progress value={Math.min(goalProgress.revenueProgress || 0, 100)} className="h-2" />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Team Performance */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Hotel Sales Team */}
        {dashboardData.hotelSalesData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Hotel Sales Team
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600">Team Total</div>
                <div className="text-2xl font-bold text-blue-600">
                  ${hotelSalesTotals.actualRevenue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  of ${hotelSalesTotals.targetRevenue.toLocaleString()} target
                </div>
                <Progress 
                  value={hotelSalesTotals.targetRevenue > 0 ? Math.min((hotelSalesTotals.actualRevenue / hotelSalesTotals.targetRevenue * 100), 100) : 0} 
                  className="h-2 mt-2" 
                />
              </div>

              <div className="space-y-2">
                {dashboardData.hotelSalesData.map((member, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">${member.actual.toLocaleString()}</span>
                      <Badge variant={member.progress >= 100 ? "default" : member.progress >= 75 ? "secondary" : "outline"}>
                        {member.progress.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* BD Team */}
        {dashboardData.bdData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Business Development Team
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-gray-600">Team Total</div>
                <div className="text-2xl font-bold text-purple-600">
                  ${bdTotals.actualRevenue.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">
                  of ${bdTotals.targetRevenue.toLocaleString()} target
                </div>
                <Progress 
                  value={bdTotals.targetRevenue > 0 ? Math.min((bdTotals.actualRevenue / bdTotals.targetRevenue * 100), 100) : 0} 
                  className="h-2 mt-2" 
                />
              </div>

              <div className="space-y-2">
                {dashboardData.bdData.map((member, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{member.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">${member.actual.toLocaleString()}</span>
                      <Badge variant={member.progress >= 100 ? "default" : member.progress >= 75 ? "secondary" : "outline"}>
                        {member.progress.toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance Chart */}
      {(dashboardData.hotelSalesData.length > 0 || dashboardData.bdData.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Performance Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[...dashboardData.hotelSalesData, ...dashboardData.bdData]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                <Legend />
                <Bar dataKey="target" fill="#e5e7eb" name="Target" />
                <Bar dataKey="actual" fill="#3b82f6" name="Actual" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}