import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const STATUS_LABELS = {
  solicitation_call: 'Solicitation Call',
  sent_proposal: 'Sent Proposal',
  follow_up: 'Follow Up',
  site_visit: 'Site Visit',
  tentative: 'Tentative',
  definite: 'Definite',
  lost: 'Lost'
};

export default function QuickActivityLog({ item, hotels, onClose }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const hotelName = hotels.find(h => h.id === item.hotel_id)?.name || 'Unknown';

  const [formData, setFormData] = useState({
    hotel_id: item.hotel_id,
    client_name: item.client_name,
    status: 'follow_up',
    notes: '',
    activity_date: new Date().toISOString().split('T')[0],
    seller_name: item.seller_name || '',
    next_action: '',
    next_action_date: ''
  });

  const mutation = useMutation({
    mutationFn: (data) => base44.entities.ActivityLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
      onClose();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate({ ...formData, seller_name: user?.full_name || formData.seller_name });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Log Activity
            <Badge variant="outline" className="font-normal text-xs">{item.client_name}</Badge>
            <Badge variant="outline" className="font-normal text-xs">{hotelName}</Badge>
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Activity Type *</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Activity Date *</Label>
              <Input type="date" value={formData.activity_date}
                onChange={(e) => setFormData({ ...formData, activity_date: e.target.value })} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="What happened in this interaction?"
              rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Next Action</Label>
              <Select value={formData.next_action} onValueChange={(v) => setFormData({ ...formData, next_action: v })}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {['Send Proposal', 'Schedule Site Visit', 'Follow-up Call', 'Send Contract', 'Pricing Negotiation', 'Close Deal'].map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Follow-up Date</Label>
              <Input type="date" value={formData.next_action_date}
                onChange={(e) => setFormData({ ...formData, next_action_date: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Log Activity'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}