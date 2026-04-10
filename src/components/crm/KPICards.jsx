import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Bed, Target, AlertTriangle } from "lucide-react";

export default function KPICards({ data, onCardClick, onCutoffAlertClick }) {
  const today = new Date().toISOString().split('T')[0];

  // Exclude actual_pickup records to avoid double-counting
  const cleanData = data.filter(i => i.record_type !== 'actual_pickup');

  // Only show definite bookings using record_type (matches GRC definition), fallback to status if record_type not set
  const definiteItems = cleanData.filter(i => (i.record_type || i.status) === 'definite');
  const definiteRevenue = definiteItems.reduce((sum, i) => sum + (i.revenue || 0), 0);
  const definiteRoomNights = definiteItems.reduce((sum, i) => sum + (i.room_nights || 0), 0);

  const totalRoomNights = definiteRoomNights;
  const totalRevenue = definiteRevenue;
  const avgADR = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;

  const pipelineItems = cleanData.filter(i => ['prospect', 'tentative', 'definite'].includes(i.status));
  const pipelineValue = pipelineItems.reduce((sum, i) => sum + (i.revenue || 0), 0);
  const pipelineRoomNights = pipelineItems.reduce((sum, i) => sum + (i.room_nights || 0), 0);

  const actualItems = cleanData.filter(i => i.status === 'actual');
  
  const definites = definiteItems.length;
  const activeTotal = cleanData.filter(i => ['prospect', 'tentative', 'definite'].includes(i.status)).length;
  const conversionRate = activeTotal > 0 ? ((definites / activeTotal) * 100) : 0;

  // Cutoff alerts: definite items with cutoff date within 7 days
  const cutoffAlerts = cleanData.filter(i => {
    if (!i.cutoff_date || (i.record_type || i.status) !== 'definite') return false;
    const diff = (new Date(i.cutoff_date) - new Date(today)) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  const avgDealSize = definites > 0 ? definiteRevenue / definites : 0;

  const cards = [
    {
      title: "Total Room Nights",
      value: totalRoomNights.toLocaleString(),
      sub: `${definiteItems.length} definite bookings`,
      icon: Bed,
      color: "text-blue-300",
      bg: "bg-blue-500/20",
      border: "border-blue-500/30",
      filterKey: "room_nights",
      items: definiteItems
    },
    {
      title: "Total Revenue",
      value: `$${totalRevenue >= 1000000
        ? (totalRevenue / 1000000).toFixed(1) + 'M'
        : totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      sub: `${definiteItems.length} definite bookings`,
      icon: DollarSign,
      color: "text-emerald-300",
      bg: "bg-emerald-500/20",
      border: "border-emerald-500/30",
      filterKey: "revenue",
      items: definiteItems
    },
    {
      title: "Average ADR",
      value: `$${avgADR.toFixed(2)}`,
      sub: `Avg deal: $${avgDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      icon: TrendingUp,
      color: "text-purple-300",
      bg: "bg-purple-500/20",
      border: "border-purple-500/30",
      filterKey: "adr",
      items: definiteItems
    },
    {
      title: "Conversion Rate",
      value: `${conversionRate.toFixed(1)}%`,
      sub: `${definites} definite / ${activeTotal} in pipeline`,
      icon: Target,
      color: "text-orange-300",
      bg: "bg-orange-500/20",
      border: "border-orange-500/30",
      filterKey: "conversion",
      items: definiteItems
    }
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-300 uppercase tracking-wider font-semibold">Overall Pipeline Summary (based on current filters)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => (
          <Card 
            key={index} 
            className={`relative overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 border ${card.border} backdrop-blur-sm hover:from-slate-800 hover:to-slate-800/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer`}
            onClick={() => onCardClick?.(card)}
          >
            <div className={`absolute inset-0 opacity-5 bg-gradient-to-br ${card.bg.replace('bg-', 'from-').replace('/20', '')} to-transparent pointer-events-none`} />
            <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
              <CardTitle className="text-sm font-medium text-slate-300">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.bg} ring-1 ring-white/10`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent className="relative">
              <div className="text-3xl font-bold text-white">{card.value}</div>
              <p className="text-xs text-slate-400 mt-1">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {cutoffAlerts > 0 && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-2 text-amber-300 text-sm cursor-pointer hover:bg-amber-500/20 transition-colors" onClick={() => onCutoffAlertClick?.()}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            <strong>{cutoffAlerts}</strong> definite booking{cutoffAlerts > 1 ? 's have' : ' has'} a cutoff date within the next 7 days — review and confirm!
          </span>
        </div>
      )}
    </div>
  );
}