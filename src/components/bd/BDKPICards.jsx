import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, Users, TrendingUp, FileText } from 'lucide-react';

export default function BDKPICards({ data }) {
  const totalLeads = data.length;
  
  const activeLeads = data.filter(l => 
    ['reached_out', 'in_progress', 'proposal_sent'].includes(l.status)
  ).length;
  
  const signedDeals = data.filter(l => l.status === 'signed_agreement').length;
  
  const pendingAgreements = data.filter(l => l.status === 'proposal_sent').length;
  
  const totalPipelineValue = data
    .filter(l => l.status !== 'closed_lost')
    .reduce((sum, lead) => {
      if (!lead.service_pricing) return sum;
      const leadValue = Object.values(lead.service_pricing).reduce((s, p) => s + (p || 0), 0);
      return sum + leadValue;
    }, 0);

  const cards = [
    {
      title: 'Total Leads',
      value: totalLeads.toLocaleString(),
      icon: Users,
      textColor: 'text-cyan-200',
      iconColor: 'text-cyan-300',
      bgColor: 'bg-cyan-500/20'
    },
    {
      title: 'Active Leads',
      value: activeLeads.toLocaleString(),
      icon: TrendingUp,
      textColor: 'text-emerald-200',
      iconColor: 'text-emerald-300',
      bgColor: 'bg-emerald-500/20'
    },
    {
      title: 'Pending Agreements',
      value: pendingAgreements.toLocaleString(),
      icon: FileText,
      textColor: 'text-amber-200',
      iconColor: 'text-amber-300',
      bgColor: 'bg-amber-500/20'
    },
    {
      title: 'Signed Agreements',
      value: signedDeals.toLocaleString(),
      icon: FileText,
      textColor: 'text-blue-200',
      iconColor: 'text-blue-300',
      bgColor: 'bg-blue-500/20'
    },
    {
      title: 'Pipeline Value',
      value: `$${totalPipelineValue.toLocaleString()}`,
      icon: DollarSign,
      textColor: 'text-green-200',
      iconColor: 'text-green-300',
      bgColor: 'bg-green-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className="bg-slate-800/60 border-slate-700 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">
              {card.title}
            </CardTitle>
            <div className={`${card.bgColor} p-2 rounded-lg`}>
              <card.icon className={`w-5 h-5 ${card.iconColor}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${card.textColor}`}>
              {card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}