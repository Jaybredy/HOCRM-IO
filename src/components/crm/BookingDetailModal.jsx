import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function BookingDetailModal({ item, actual, onClose }) {
  const [showActualVsProjected, setShowActualVsProjected] = useState(false);

  if (!item) return null;

  const safeFormat = (dateStr) => {
    try { return dateStr ? format(parseISO(dateStr), 'dd MMM yyyy') : '-'; } catch { return '-'; }
  };

  const accommodationRevenue = item.accommodation_revenue || item.revenue || 0;
  const additionalServices = item.additional_services || {};
  const additionalServicesTotal = Object.values(additionalServices).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const totalProjectedRevenue = accommodationRevenue + additionalServicesTotal;

  const actualRoomNights = actual?.actual_room_nights ?? item.room_nights ?? 0;
  const actualRevenue = actual?.actual_revenue ?? null;
  const projectedRevenue = item.revenue || 0;

  const hasActual = !!actual;

  return (
    <Dialog open={!!item} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border border-slate-600 text-slate-100 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white text-lg flex items-center justify-between gap-2">
            <span>{item.client_name}</span>
            <Link
              to={createPageUrl(`CRM?edit=${item.id}&returnTo=ProductionCalendar`)}
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs font-normal"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Edit in CRM
            </Link>
          </DialogTitle>
          <div className="flex gap-4 text-xs text-slate-400 pt-1">
            <span>Arrival: <span className="text-slate-200">{safeFormat(item.arrival_date)}</span></span>
            <span>Departure: <span className="text-slate-200">{safeFormat(item.departure_date)}</span></span>
            <span>Room Nights: <span className="text-slate-200">{item.room_nights}</span></span>
          </div>
        </DialogHeader>

        {/* Revenue Breakdown */}
        <div className="mt-2 space-y-2">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Revenue Breakdown</h3>

          <div className="bg-slate-700 rounded-lg divide-y divide-slate-600">
            {/* Room Revenue */}
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-sm text-slate-200">Room Revenue</span>
              <span className="text-sm font-semibold text-white">${accommodationRevenue.toLocaleString()}</span>
            </div>

            {/* Additional Services */}
            {Object.keys(additionalServices).length > 0 ? (
              Object.entries(additionalServices).map(([service, amount]) => (
                parseFloat(amount) > 0 && (
                  <div key={service} className="flex justify-between items-center px-4 py-2.5">
                    <span className="text-sm text-slate-200 capitalize">{service.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-semibold text-white">${parseFloat(amount).toLocaleString()}</span>
                  </div>
                )
              ))
            ) : (
              <div className="flex justify-between items-center px-4 py-2.5 text-slate-400 text-xs italic">
                <span>No additional services recorded</span>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center px-4 py-2.5 bg-slate-600 rounded-b-lg">
              <span className="text-sm font-bold text-white">Total Projected Revenue</span>
              <span className="text-sm font-bold text-green-400">${totalProjectedRevenue.toLocaleString()}</span>
            </div>
          </div>

          {/* Actual vs Projected Expandable */}
          <button
            onClick={() => setShowActualVsProjected(!showActualVsProjected)}
            className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm text-slate-200 font-medium"
          >
            <span>Actual vs. Projected</span>
            {showActualVsProjected ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showActualVsProjected && (
            <div className="bg-slate-700 rounded-lg divide-y divide-slate-600">
              <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-semibold text-slate-400 uppercase">
                <span>Metric</span>
                <span className="text-center">Projected</span>
                <span className="text-center">Actual</span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-2.5 text-sm">
                <span className="text-slate-300">Room Nights</span>
                <span className="text-center text-white">{item.room_nights}</span>
                <span className="text-center font-semibold text-emerald-400">
                  {hasActual ? actualRoomNights : <span className="text-slate-500 text-xs">N/A</span>}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-2.5 text-sm">
                <span className="text-slate-300">Total Revenue</span>
                <span className="text-center text-white">${projectedRevenue.toLocaleString()}</span>
                <span className="text-center font-semibold text-emerald-400">
                  {hasActual && actualRevenue != null
                    ? `$${actualRevenue.toLocaleString()}`
                    : <span className="text-slate-500 text-xs">N/A</span>}
                </span>
              </div>
              {hasActual && actualRevenue != null && projectedRevenue > 0 && (
                <div className="px-4 py-2.5 text-xs text-slate-400">
                  Pickup vs Projected:{' '}
                  <span className={actualRevenue >= projectedRevenue ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                    {actualRevenue >= projectedRevenue ? '+' : ''}
                    ${(actualRevenue - projectedRevenue).toLocaleString()} ({projectedRevenue > 0 ? ((actualRevenue / projectedRevenue) * 100).toFixed(0) : 0}%)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}