import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, User, Mail, Phone, Trash2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ClientContactsList({ contacts = [], clientId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Contact.create({ ...data, client_id: clientId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', clientId] });
      setShowAdd(false);
      setForm({ first_name: '', last_name: '', title: '', email: '', phone: '', is_primary: false });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contact.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contacts', clientId] })
  });

  const sorted = [...contacts].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Contacts ({contacts.length})</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No contacts added yet.</p>
        ) : (
          sorted.map(c => (
            <div key={c.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-sm font-medium text-white">{c.first_name} {c.last_name}</span>
                  {c.is_primary && <Badge className="bg-amber-100 text-amber-800 text-xs py-0">Primary</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-400" onClick={() => deleteMutation.mutate(c.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              {c.title && <p className="text-xs text-slate-400 pl-5">{c.title}</p>}
              {c.email && <div className="flex items-center gap-1.5 pl-5"><Mail className="w-3 h-3 text-slate-500" /><a href={`mailto:${c.email}`} className="text-xs text-slate-300 hover:text-white">{c.email}</a></div>}
              {c.phone && <div className="flex items-center gap-1.5 pl-5"><Phone className="w-3 h-3 text-slate-500" /><span className="text-xs text-slate-300">{c.phone}</span></div>}
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Contact</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})} required /></div>
              <div className="space-y-1"><Label>Last Name</Label><Input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})} /></div>
              <div className="space-y-1"><Label>Title</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="space-y-1 col-span-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="primary" checked={form.is_primary} onChange={e => setForm({...form, is_primary: e.target.checked})} className="rounded" />
              <Label htmlFor="primary">Primary contact</Label>
            </div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>Add Contact</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}