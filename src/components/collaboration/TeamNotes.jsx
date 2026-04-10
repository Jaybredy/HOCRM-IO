import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Pin, Trash2, Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function TeamNotes({ relatedEntityId, relatedEntityType = 'General' }) {
  const [showDialog, setShowDialog] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    content: ''
  });

  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ['teamNotes', relatedEntityId, relatedEntityType],
    queryFn: () => base44.entities.TeamNote.filter({
      related_entity_id: relatedEntityId || null,
      related_entity_type: relatedEntityType
    }, '-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TeamNote.create({
      ...data,
      related_entity_id: relatedEntityId,
      related_entity_type: relatedEntityType
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamNotes'] });
      setShowDialog(false);
      setFormData({ title: '', content: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TeamNote.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamNotes'] })
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }) => base44.entities.TeamNote.update(id, { is_pinned: !isPinned }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teamNotes'] })
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.title && formData.content) {
      createMutation.mutate(formData);
    }
  };

  const filteredNotes = notes.filter(note =>
    note.title.toLowerCase().includes(searchText.toLowerCase()) ||
    note.content.toLowerCase().includes(searchText.toLowerCase())
  );

  const pinnedNotes = filteredNotes.filter(n => n.is_pinned);
  const regularNotes = filteredNotes.filter(n => !n.is_pinned);

  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-400" />
          Team Notes
          {notes.length > 0 && (
            <span className="bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">{notes.length}</span>
          )}
        </CardTitle>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-7 px-2 text-xs">
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Note</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Note title"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Note content"
                  rows={4}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Add Note</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="pt-0">
        {filteredNotes.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {filteredNotes.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <Input
                  placeholder="Search notes..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="pl-8 h-7 text-xs bg-slate-900/40 border-slate-700"
                />
              </div>
            )}

            {pinnedNotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-semibold">PINNED</p>
                {pinnedNotes.map(note => (
                  <div key={note.id} className="p-2 bg-slate-900/40 rounded-lg border border-slate-700/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{note.title}</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{note.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => pinMutation.mutate({ id: note.id, isPinned: note.is_pinned })} className="p-1 hover:bg-slate-800 rounded">
                          <Pin className="w-3 h-3 text-yellow-400" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(note.id)} className="p-1 hover:bg-slate-800 rounded">
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {regularNotes.length > 0 && (
              <div className="space-y-2">
                {pinnedNotes.length > 0 && <p className="text-xs text-slate-500 font-semibold">OTHERS</p>}
                {regularNotes.map(note => (
                  <div key={note.id} className="p-2 bg-slate-900/40 rounded-lg border border-slate-700/50 hover:border-slate-600/50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{note.title}</p>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{note.content}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => pinMutation.mutate({ id: note.id, isPinned: note.is_pinned })} className="p-1 hover:bg-slate-800 rounded">
                          <Pin className="w-3 h-3 text-slate-500 hover:text-yellow-400" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(note.id)} className="p-1 hover:bg-slate-800 rounded">
                          <Trash2 className="w-3 h-3 text-slate-500 hover:text-red-400" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}