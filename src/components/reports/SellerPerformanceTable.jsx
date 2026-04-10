import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Award, TrendingUp, TrendingDown } from 'lucide-react';

export default function SellerPerformanceTable({ production }) {
  const sellerStats = {};
  
  production.forEach(item => {
    const seller = item.seller_name || 'Unknown';
    if (!sellerStats[seller]) {
      sellerStats[seller] = {
        seller_type: item.seller_type || 'hotel_sales',
        room_nights: 0,
        revenue: 0,
        deals: 0,
        solicitations: 0,
        definites: 0,
        actuals: 0
      };
    }
    sellerStats[seller].room_nights += item.room_nights || 0;
    sellerStats[seller].revenue += item.revenue || 0;
    sellerStats[seller].deals += 1;
    if (item.status === 'solicitation') sellerStats[seller].solicitations += 1;
    if (item.status === 'definite') sellerStats[seller].definites += 1;
    if (item.status === 'actual') sellerStats[seller].actuals += 1;
  });

  const sellers = Object.entries(sellerStats)
    .map(([seller, stats]) => ({
      seller,
      ...stats,
      adr: stats.room_nights > 0 ? stats.revenue / stats.room_nights : 0,
      conversionRate: stats.solicitations > 0 
        ? ((stats.definites + stats.actuals) / stats.solicitations * 100) 
        : 0,
      avgDealSize: stats.deals > 0 ? stats.revenue / stats.deals : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const topPerformer = sellers[0];

  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Award className="w-5 h-5 text-slate-400" />
          Sales Performance by Seller
        </CardTitle>
      </CardHeader>
      <CardContent>
        {topPerformer && (
          <div className="mb-6 p-4 bg-slate-700/40 rounded-lg border border-slate-600/40">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-400 mb-1">🥇 Top Performer</div>
                <div className="text-xl font-bold text-white">
                  {topPerformer.seller === 'Unknown' ? (
                    <Link to={createPageUrl('Bookings') + '?seller=__unknown__'} className="text-yellow-300 underline hover:text-yellow-100" title="Click to view bookings with no seller assigned">
                      Unknown ⚠️
                    </Link>
                  ) : topPerformer.seller}
                </div>
                <div className="text-sm text-slate-300">
                  {topPerformer.seller_type === 'business_development' ? 'BD - EPIC' : 'Hotel Sales'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-200">
                  ${(topPerformer.revenue / 1000).toFixed(0)}K
                </div>
                <div className="text-sm text-slate-400">{topPerformer.deals} deals</div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-slate-800/50">
                <TableHead className="text-slate-300">Seller</TableHead>
                <TableHead className="text-slate-300">Type</TableHead>
                <TableHead className="text-right text-slate-300">Deals</TableHead>
                <TableHead className="text-right text-slate-300">Revenue</TableHead>
                <TableHead className="text-right text-slate-300">Room Nights</TableHead>
                <TableHead className="text-right text-slate-300">ADR</TableHead>
                <TableHead className="text-right text-slate-300">Avg Deal</TableHead>
                <TableHead className="text-right text-slate-300">Conv. Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.map((seller, idx) => (
                <TableRow key={idx} className="border-slate-800 hover:bg-slate-800/30">
                  <TableCell className="font-medium text-white">
                    {seller.seller === 'Unknown' ? (
                      <Link to={createPageUrl('Bookings') + '?seller=__unknown__'} className="text-orange-400 underline hover:text-orange-200 text-sm" title="These bookings have no seller assigned — click to review">
                        Unknown ⚠️ (no seller)
                      </Link>
                    ) : seller.seller}
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded ${
                      seller.seller_type === 'business_development' 
                        ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30' 
                        : 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                    }`}>
                      {seller.seller_type === 'business_development' ? 'BD' : 'Sales'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-slate-300">{seller.deals}</TableCell>
                  <TableCell className="text-right font-semibold text-white">
                    ${(seller.revenue / 1000).toFixed(1)}K
                  </TableCell>
                  <TableCell className="text-right text-slate-300">{seller.room_nights}</TableCell>
                  <TableCell className="text-right text-slate-300">${seller.adr.toFixed(0)}</TableCell>
                  <TableCell className="text-right text-slate-300">
                    ${(seller.avgDealSize / 1000).toFixed(1)}K
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {seller.conversionRate >= 50 ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : seller.conversionRate >= 25 ? (
                        <TrendingUp className="w-4 h-4 text-yellow-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                      )}
                      <span className={seller.conversionRate >= 50 ? 'text-green-400 font-semibold' : 'text-slate-300'}>
                        {seller.conversionRate.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {sellers.length === 0 && (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={8} className="text-center text-slate-500">
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}