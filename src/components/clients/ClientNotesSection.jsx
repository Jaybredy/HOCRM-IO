import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pin, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ClientNotesSection({ notes = [], clientId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TeamNote.create({
      ...data,
      related_entity_type: 'Client',
      related_entity_id: clientId
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamNotes'] });
      setShowAdd(false);
      setForm({ title: '', content: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TeamNote.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamNotes'] })
  });

  const sorted = [...notes].sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Notes ({notes.length})</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => setShowAdd(true)}>
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No notes yet.</p>
        ) : (
          sorted.map(note => (
            <div key={note.id} className={`rounded-lg p-3 border ${note.is_pinned ? 'bg-amber-900/20 border-amber-700/40' : 'bg-slate-900/50 border-slate-700'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {note.is_pinned && <Pin className="w-3 h-3 text-amber-400" />}
                  <span className="text-sm font-medium text-white">{note.title}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-slate-500">{note.created_date ? format(parseISO(note.created_date), 'MMM d') : ''}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:text-red-400" onClick={() => deleteMutation.mutate(note.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-slate-300 mt-1 leading-relaxed">{note.content}</p>
              {note.created_by && <p className="text-xs text-slate-500 mt-1">by {note.created_by}</p>}
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Note</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-3">
            <div className="space-y-1"><Label>Title *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
            <div className="space-y-1"><Label>Content *</Label><Textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} rows={4} required /></div>
            <Button type="submit" className="w-full" disabled={createMutation.isPending}>Save Note</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}