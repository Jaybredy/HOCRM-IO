import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';

const COLORS = ['#4e6d8c', '#3d7a6a', '#7a6a3d', '#5a4e7a', '#7a4e4e', '#3d6a7a'];

export default function HotelPerformanceChart({ production, hotels }) {
  const hotelMap = {};
  hotels.forEach(h => { hotelMap[h.id] = h.name; });

  const data = hotels.map(hotel => {
    const items = production.filter(p => p.hotel_id === hotel.id && !p.is_deleted);
    const definite = items.filter(p => ['definite', 'actual'].includes(p.status));
    return {
      name: hotel.name?.length > 12 ? hotel.name.slice(0, 12) + '…' : hotel.name,
      fullName: hotel.name,
      revenue: definite.reduce((s, p) => s + (p.revenue || 0), 0),
      rooms: definite.reduce((s, p) => s + (p.room_nights || 0), 0),
      deals: items.length,
    };
  }).filter(d => d.deals > 0).sort((a, b) => b.revenue - a.revenue);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs">
        <p className="font-semibold text-white mb-1">{d?.fullName}</p>
        <p className="text-green-400">Revenue: ${d?.revenue?.toLocaleString()}</p>
        <p className="text-blue-400">Room Nights: {d?.rooms?.toLocaleString()}</p>
        <p className="text-slate-300">Total Deals: {d?.deals}</p>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <h3 className="text-sm font-semibold text-slate-100 mb-1">Sales Performance by Hotel</h3>
      <p className="text-xs text-slate-400 mb-4">Revenue from definite & actualized bookings</p>
      {data.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}