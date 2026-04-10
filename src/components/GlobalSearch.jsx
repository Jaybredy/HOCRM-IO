import React, { useState, useRef, useEffect } from 'react';
import { Search, Building2, Bed } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ clients: [], bookings: [] });
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults({ clients: [], bookings: [] });
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = query.toLowerCase();
      const [clients, bookings] = await Promise.all([
        base44.entities.Client.list(),
        base44.entities.ProductionItem.list('-created_date', 200)
      ]);
      setResults({
        clients: clients.filter(c =>
          c.company_name?.toLowerCase().includes(q) ||
          c.contact_person?.toLowerCase().includes(q)
        ).slice(0, 5),
        bookings: bookings.filter(b =>
          b.client_name?.toLowerCase().includes(q)
        ).slice(0, 5)
      });
      setOpen(true);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const hasResults = results.clients.length > 0 || results.bookings.length > 0;

  const goToClient = (client) => {
    navigate(createPageUrl('ClientProfile') + `?id=${client.id}`);
    setQuery('');
    setOpen(false);
  };

  const goToBooking = (booking) => {
    navigate(createPageUrl('CRM') + `?edit=${booking.id}`);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative px-2 mb-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="Search clients & bookings..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-700/60 border border-slate-600 rounded-md text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:bg-slate-700 transition-colors"
        />
      </div>

      {open && (
        <div className="absolute left-2 right-2 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden max-h-72 overflow-y-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-slate-400">Searching...</div>
          )}

          {!loading && !hasResults && (
            <div className="px-3 py-2 text-xs text-slate-400">No results found.</div>
          )}

          {results.clients.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700">
                Clients
              </div>
              {results.clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => goToClient(client)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-left transition-colors"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <div>
                    <p className="text-xs text-white font-medium">{client.company_name}</p>
                    {client.contact_person && (
                      <p className="text-[10px] text-slate-400">{client.contact_person}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {results.bookings.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-700">
                Bookings
              </div>
              {results.bookings.map(booking => (
                <button
                  key={booking.id}
                  onClick={() => goToBooking(booking)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700 text-left transition-colors"
                >
                  <Bed className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <div>
                    <p className="text-xs text-white font-medium">{booking.client_name}</p>
                    <p className="text-[10px] text-slate-400">
                      {booking.arrival_date} · {booking.status}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}