import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';

export default function BDInsightsSummary({ data }) {
  const activeLeads = data.filter(l => l.status !== 'closed_lost');
  const signedDeals = data.filter(l => l.status === 'signed_agreement');
  const proposalsSent = data.filter(l => l.status === 'proposal_sent');
  const inProgress = data.filter(l => l.status === 'in_progress');

  const totalValue = signedDeals.reduce((sum, lead) => {
    return sum + Object.values(lead.service_pricing || {}).reduce((s, price) => s + price, 0);
  }, 0);

  const conversionRate = activeLeads.length > 0 
    ? ((signedDeals.length / activeLeads.length) * 100).toFixed(1)
    : 0;

  const insights = [];

  if (proposalsSent.length > 5) {
    insights.push({
      type: 'warning',
      message: `${proposalsSent.length} proposals awaiting response - follow-up needed`,
      icon: AlertCircle,
      color: 'text-amber-600 bg-amber-50'
    });
  }

  if (signedDeals.length > 0) {
    insights.push({
      type: 'success',
      message: `${signedDeals.length} deals closed with $${totalValue.toLocaleString()} in revenue`,
      icon: CheckCircle,
      color: 'text-emerald-600 bg-emerald-50'
    });
  }

  if (inProgress.length > 10) {
    insights.push({
      type: 'info',
      message: `Strong pipeline: ${inProgress.length} leads actively being worked`,
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-50'
    });
  }

  if (conversionRate > 0 && conversionRate < 15) {
    insights.push({
      type: 'alert',
      message: `Conversion rate at ${conversionRate}% - consider pipeline quality review`,
      icon: TrendingDown,
      color: 'text-red-600 bg-red-50'
    });
  }

  return (
    <Card className="border-l-4 border-l-[#00a3e0]">
      <CardHeader>
        <CardTitle className="text-lg">Key Insights</CardTitle>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-gray-600 text-sm">No significant insights at this time. Keep building your pipeline!</p>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, idx) => (
              <div key={idx} className={`flex items-start gap-3 p-3 rounded-lg ${insight.color}`}>
                <insight.icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-medium">{insight.message}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}