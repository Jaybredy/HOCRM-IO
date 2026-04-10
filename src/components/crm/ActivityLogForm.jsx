import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ClientSearchSelect from "@/components/clients/ClientSearchSelect";
import { X } from "lucide-react";

export default function ActivityLogForm({ onCancel, onSuccess }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const [formData, setFormData] = useState({
    hotel_id: '',
    client_id: '',
    client_name: '',
    status: 'solicitation_call',
    notes: '',
    activity_date: new Date().toISOString().split('T')[0],
    seller_name: user?.full_name || '',
    arrival_date: '',
    departure_date: '',
    potential_revenue: '',
    next_action: '',
    next_action_date: '',
    source: '',
    other_source_details: '',
    outcome: ''
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ActivityLog.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
      if (onSuccess) onSuccess();
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...formData,
      seller_name: user?.full_name || formData.seller_name
    });
  };

  const sourceLabels = {
    website: 'Website',
    direct: 'Direct',
    via_solicitation: 'Via Solicitation',
    cvb: 'CVB',
    other: 'Other'
  };

  const outcomeLabels = {
    meeting_scheduled: 'Meeting Scheduled',
    qualified_lead: 'Qualified Lead',
    proposal_requested: 'Proposal Requested',
    no_interest: 'No Interest',
    follow_up_required: 'Follow-up Required',
    converted: 'Converted',
    other: 'Other'
  };

  const statusLabels = {
    solicitation_call: 'Solicitation Call',
    sent_proposal: 'Sent Proposal',
    follow_up: 'Follow Up',
    site_visit: 'Site Visit',
    tentative: 'Tentative',
    definite: 'Definite',
    lost: 'Lost'
  };

  const nextActionOptions = [
    'Send Proposal',
    'Schedule Site Visit',
    'Follow-up Call',
    'Send Contract',
    'Pricing Negotiation',
    'Executive Meeting',
    'Decision Follow-up',
    'Close Deal'
  ];

  const showDatesSection = ['sent_proposal', 'tentative', 'definite'].includes(formData.status);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Quick Activity Log</CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hotel *</Label>
              <Select value={formData.hotel_id} onValueChange={(value) => setFormData({...formData, hotel_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select hotel" />
                </SelectTrigger>
                <SelectContent>
                  {hotels.map(hotel => (
                    <SelectItem key={hotel.id} value={hotel.id}>{hotel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Client</Label>
              <ClientSearchSelect
                clients={clients}
                hotels={hotels}
                selectedClientName={formData.client_name}
                selectedClientId={formData.client_id}
                onSelect={(client) => setFormData({ ...formData, client_id: client?.id || '', client_name: client?.company_name || '' })}
                propertyId={formData.hotel_id}
              />
            </div>

            <div className="space-y-2">
              <Label>Activity Type *</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Activity Date *</Label>
              <Input
                type="date"
                value={formData.activity_date}
                onChange={(e) => setFormData({...formData, activity_date: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Source <span className="text-red-500">*</span></Label>
              <Select value={formData.source} onValueChange={(value) => setFormData({...formData, source: value})} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(sourceLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.source === 'other' && (
              <div className="space-y-2 md:col-span-2">
                <Label>Other Source Details</Label>
                <Input
                  value={formData.other_source_details}
                  onChange={(e) => setFormData({...formData, other_source_details: e.target.value})}
                  placeholder="Describe the source..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Outcome</Label>
              <Select value={formData.outcome} onValueChange={(value) => setFormData({...formData, outcome: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(outcomeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showDatesSection && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Arrival Date</Label>
                <Input
                  type="date"
                  value={formData.arrival_date}
                  onChange={(e) => setFormData({...formData, arrival_date: e.target.value})}
                  placeholder="Expected arrival"
                />
              </div>

              <div className="space-y-2">
                <Label>Departure Date</Label>
                <Input
                  type="date"
                  value={formData.departure_date}
                  onChange={(e) => setFormData({...formData, departure_date: e.target.value})}
                  placeholder="Expected departure"
                />
              </div>

              <div className="space-y-2">
                <Label>Potential Revenue</Label>
                <Input
                  type="number"
                  value={formData.potential_revenue}
                  onChange={(e) => setFormData({...formData, potential_revenue: e.target.value})}
                  placeholder="Est. revenue"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              placeholder="Activity notes..."
              rows={3}
            />
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-sm text-gray-700">Follow-up Plan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Next Action</Label>
                <Select value={formData.next_action} onValueChange={(value) => setFormData({...formData, next_action: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select next action" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextActionOptions.map(action => (
                      <SelectItem key={action} value={action}>{action}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Next Action Date</Label>
                <Input
                  type="date"
                  value={formData.next_action_date}
                  onChange={(e) => setFormData({...formData, next_action_date: e.target.value})}
                  placeholder="When to follow up"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving...' : 'Log Activity'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}