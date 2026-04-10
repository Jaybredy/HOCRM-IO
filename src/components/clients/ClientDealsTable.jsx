import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { BedDouble, Calendar } from "lucide-react";

const STATUS_COLORS = {
  solicitation: 'bg-slate-100 text-slate-700',
  prospect: 'bg-yellow-100 text-yellow-800',
  tentative: 'bg-orange-100 text-orange-800',
  definite: 'bg-green-100 text-green-800',
  actual: 'bg-blue-100 text-blue-800',
  lost: 'bg-red-100 text-red-800',
};

export default function ClientDealsTable({ deals = [], hotels = [] }) {
  const sorted = [...deals].sort((a, b) => new Date(b.arrival_date) - new Date(a.arrival_date));

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">
          Booking History & Deals ({deals.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No deals found for this account.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map(deal => {
              const hotel = hotels.find(h => h.id === deal.hotel_id);
              return (
                <div key={deal.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={STATUS_COLORS[deal.status] || 'bg-slate-100 text-slate-700'}>
                          {deal.status}
                        </Badge>
                        {hotel && <span className="text-xs text-slate-400">{hotel.name}</span>}
                        {deal.event_type && <span className="text-xs text-slate-500 capitalize">{deal.event_type}</span>}
                      </div>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {deal.arrival_date ? format(parseISO(deal.arrival_date), 'MMM d, yyyy') : '—'}
                          {deal.departure_date ? ` → ${format(parseISO(deal.departure_date), 'MMM d, yyyy')}` : ''}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <BedDouble className="w-3 h-3" />
                          {deal.room_nights} nights
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-green-400">${(deal.revenue || 0).toLocaleString()}</p>
                      {deal.seller_name && <p className="text-xs text-slate-500 mt-0.5">{deal.seller_name}</p>}
                    </div>
                  </div>
                  {deal.notes && <p className="text-xs text-slate-500 mt-2 line-clamp-1">{deal.notes}</p>}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}