import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Calendar, DollarSign, BedDouble } from 'lucide-react';

export default function DealSizeMetrics({ production }) {
  const deals = production.filter(p => p.revenue > 0 && p.room_nights > 0);
  
  const totalRevenue = deals.reduce((sum, d) => sum + d.revenue, 0);
  const totalRoomNights = deals.reduce((sum, d) => sum + d.room_nights, 0);
  const avgDealSize = deals.length > 0 ? totalRevenue / deals.length : 0;
  const avgRoomNights = deals.length > 0 ? totalRoomNights / deals.length : 0;
  const avgADR = totalRoomNights > 0 ? totalRevenue / totalRoomNights : 0;

  // Find largest deal
  const largestDeal = deals.reduce((max, d) => d.revenue > (max?.revenue || 0) ? d : max, null);

  // Calculate deal size distribution
  const dealRanges = [
    { label: 'Under $10K', min: 0, max: 10000, count: 0 },
    { label: '$10K-$25K', min: 10000, max: 25000, count: 0 },
    { label: '$25K-$50K', min: 25000, max: 50000, count: 0 },
    { label: '$50K-$100K', min: 50000, max: 100000, count: 0 },
    { label: 'Over $100K', min: 100000, max: Infinity, count: 0 }
  ];

  deals.forEach(deal => {
    const range = dealRanges.find(r => deal.revenue >= r.min && deal.revenue < r.max);
    if (range) range.count++;
  });

  return (
    <Card className="bg-slate-800 border border-slate-700 rounded-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="w-5 h-5 text-purple-600" />
          Deal Size Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Deal Size</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              ${(avgDealSize / 1000).toFixed(1)}K
            </div>
          </div>
          
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <BedDouble className="w-4 h-4" />
              <span className="text-xs font-medium">Avg Room Nights</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              {avgRoomNights.toFixed(0)}
            </div>
          </div>
          
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-medium">Avg ADR</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              ${avgADR.toFixed(0)}
            </div>
          </div>
          
          <div className="p-4 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-2 text-slate-300 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Total Deals</span>
            </div>
            <div className="text-2xl font-bold text-cyan-400">
              {deals.length}
            </div>
          </div>
        </div>

        {largestDeal && (
          <div className="mb-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
            <div className="text-sm font-semibold text-slate-300 mb-2">🏆 Largest Deal</div>
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-lg text-white">{largestDeal.client_name}</div>
                <div className="text-sm text-slate-400">{largestDeal.room_nights} room nights</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-teal-400">
                  ${(largestDeal.revenue / 1000).toFixed(1)}K
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-semibold text-white mb-3">Deal Size Distribution</div>
          {dealRanges.map((range, idx) => {
            const percentage = deals.length > 0 ? (range.count / deals.length * 100) : 0;
            return (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">{range.label}</span>
                  <span className="font-semibold text-cyan-400">{range.count} ({percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div 
                    className="bg-cyan-500 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}