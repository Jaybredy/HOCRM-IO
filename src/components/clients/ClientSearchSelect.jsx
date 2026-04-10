import React, { useState, useRef, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Plus, Building2, CheckCircle2 } from "lucide-react";

export default function ClientSearchSelect({ clients = [], hotels = [], selectedClientName, selectedClientId, onSelect, propertyId, required }) {
  const [query, setQuery] = useState(selectedClientName || '');
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newCompany, setNewCompany] = useState('');
  const wrapperRef = useRef(null);
  const queryClient = useQueryClient();

  const filtered = query.trim().length > 0
    ? clients.filter(c => c.company_name?.toLowerCase().includes(query.toLowerCase()))
    : clients.slice(0, 8);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const createClientMutation = useMutation({
    mutationFn: (data) => base44.entities.Client.create(data),
    onSuccess: (newClient) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setQuery(newClient.company_name);
      onSelect({ id: newClient.id, company_name: newClient.company_name });
      setShowCreate(false);
      setNewCompany('');
      setOpen(false);
    }
  });

  const handleSelect = (client) => {
    setQuery(client.company_name);
    onSelect({ id: client.id, company_name: client.company_name });
    setOpen(false);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newCompany.trim()) return;
    createClientMutation.mutate({
      company_name: newCompany.trim(),
      status: 'new_lead',
      property_id: propertyId || undefined,
      property_type: propertyId ? 'hotel' : undefined,
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
        <Input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); onSelect(null); }}
          onFocus={() => setOpen(true)}
          placeholder="Search for a client or company..."
          className="bg-slate-800 border-slate-600 text-white pl-9"
          required={required}
          autoComplete="off"
        />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {filtered.length > 0 ? (
            <ul className="max-h-52 overflow-y-auto divide-y divide-slate-700">
              {filtered.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-700 flex items-center gap-2 transition-colors"
                    onMouseDown={() => handleSelect(c)}
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-sm text-white">{c.company_name}</span>
                    {c.contact_person && <span className="text-xs text-slate-400 ml-auto">{c.contact_person}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-400">No clients found for "{query}"</div>
          )}
          <div className="border-t border-slate-700">
            <button
              type="button"
              className="w-full text-left px-4 py-2.5 hover:bg-blue-900/40 flex items-center gap-2 text-blue-400 text-sm font-medium transition-colors"
              onMouseDown={() => { setOpen(false); setNewCompany(query); setShowCreate(true); }}
            >
              <Plus className="w-4 h-4" /> Create new client "{query || '...'}"
            </button>
          </div>
        </div>
      )}

      {/* Create New Client Mini Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-sm bg-slate-900 border border-slate-700 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">Create New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Company Name *</Label>
              <Input
                value={newCompany}
                onChange={e => setNewCompany(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                placeholder="Company or organization name"
                required
                autoFocus
              />
            </div>
            {propertyId && (
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                Will be linked to the selected property automatically.
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500" disabled={createClientMutation.isPending}>
                {createClientMutation.isPending ? 'Creating...' : 'Create & Select'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}