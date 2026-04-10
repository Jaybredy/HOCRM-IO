import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UtensilsCrossed, X } from "lucide-react";

export default function CateringEventForm({ onCancel, onSuccess }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const [formData, setFormData] = useState({
    hotel_id: '',
    client_name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    event_name: '',
    event_type: '',
    event_date: '',
    setup_time: '',
    start_time: '',
    end_time: '',
    guest_count: '',
    venue_space: '',
    menu_style: '',
    menu_notes: '',
    beverage_package: 'none',
    estimated_revenue: '',
    fb_revenue: '',
    av_revenue: '',
    decor_revenue: '',
    other_revenue: '',
    status: 'inquiry',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CateringEvent.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cateringEvents'] });
      if (onSuccess) onSuccess();
    }
  });

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    const e = {};
    if (!formData.hotel_id) e.hotel_id = 'Required';
    if (!formData.client_name.trim()) e.client_name = 'Required';
    if (!formData.event_date) e.event_date = 'Required';
    if (!formData.guest_count || Number(formData.guest_count) <= 0) e.guest_count = 'Must be > 0';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    createMutation.mutate({
      ...formData,
      guest_count: Number(formData.guest_count) || 0,
      estimated_revenue: Number(formData.estimated_revenue) || 0,
      fb_revenue: Number(formData.fb_revenue) || 0,
      av_revenue: Number(formData.av_revenue) || 0,
      decor_revenue: Number(formData.decor_revenue) || 0,
      other_revenue: Number(formData.other_revenue) || 0,
      seller_name: user?.full_name || ''
    });
  };

  const totalRevenue =
    (Number(formData.fb_revenue) || 0) +
    (Number(formData.av_revenue) || 0) +
    (Number(formData.decor_revenue) || 0) +
    (Number(formData.other_revenue) || 0);

  return (
    <Card className="border-2 border-orange-200">
      <CardHeader className="bg-orange-50 border-b border-orange-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-5 h-5 text-orange-600" />
            <div>
              <CardTitle className="text-xl text-orange-700">New Catering Event</CardTitle>
              <p className="text-sm text-gray-600 mt-0.5">Capture event details, menu, and revenue estimates</p>
            </div>
          </div>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-4 h-4" /></Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Client Info */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide mb-3 border-b pb-1">Client Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Hotel *</Label>
                <Select value={formData.hotel_id} onValueChange={v => set('hotel_id', v)}>
                  <SelectTrigger className={errors.hotel_id ? 'border-red-400' : ''}><SelectValue placeholder="Select hotel" /></SelectTrigger>
                  <SelectContent>
                    {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.hotel_id && <p className="text-xs text-red-500">{errors.hotel_id}</p>}
              </div>

              <div className="space-y-1">
                <Label>Client / Organization *</Label>
                <Input value={formData.client_name} onChange={e => set('client_name', e.target.value)}
                  placeholder="Company or family name" className={errors.client_name ? 'border-red-400' : ''} />
                {errors.client_name && <p className="text-xs text-red-500">{errors.client_name}</p>}
              </div>

              <div className="space-y-1">
                <Label>Contact Person</Label>
                <Input value={formData.contact_person} onChange={e => set('contact_person', e.target.value)} placeholder="Full name" />
              </div>

              <div className="space-y-1">
                <Label>Contact Email</Label>
                <Input type="email" value={formData.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="email@example.com" />
              </div>

              <div className="space-y-1">
                <Label>Contact Phone</Label>
                <Input value={formData.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="+1 (555) 000-0000" />
              </div>
            </div>
          </div>

          {/* Event Details */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide mb-3 border-b pb-1">Event Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Event Name</Label>
                <Input value={formData.event_name} onChange={e => set('event_name', e.target.value)} placeholder="e.g. Smith-Jones Wedding" />
              </div>

              <div className="space-y-1">
                <Label>Event Type</Label>
                <Select value={formData.event_type} onValueChange={v => set('event_type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="corporate_dinner">Corporate Dinner</SelectItem>
                    <SelectItem value="gala">Gala</SelectItem>
                    <SelectItem value="conference_banquet">Conference Banquet</SelectItem>
                    <SelectItem value="birthday">Birthday / Milestone</SelectItem>
                    <SelectItem value="cocktail_reception">Cocktail Reception</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Event Date *</Label>
                <Input type="date" value={formData.event_date} onChange={e => set('event_date', e.target.value)}
                  className={errors.event_date ? 'border-red-400' : ''} />
                {errors.event_date && <p className="text-xs text-red-500">{errors.event_date}</p>}
              </div>

              <div className="space-y-1">
                <Label>Guest Count *</Label>
                <Input type="number" min="1" value={formData.guest_count} onChange={e => set('guest_count', e.target.value)}
                  placeholder="Expected attendees" className={errors.guest_count ? 'border-red-400' : ''} />
                {errors.guest_count && <p className="text-xs text-red-500">{errors.guest_count}</p>}
              </div>

              <div className="space-y-1">
                <Label>Venue / Space</Label>
                <Input value={formData.venue_space} onChange={e => set('venue_space', e.target.value)} placeholder="e.g. Grand Ballroom, Terrace" />
              </div>

              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={v => set('status', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inquiry">Inquiry</SelectItem>
                    <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                    <SelectItem value="tentative">Tentative</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Setup Time</Label>
                <Input type="time" value={formData.setup_time} onChange={e => set('setup_time', e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>Start Time</Label>
                <Input type="time" value={formData.start_time} onChange={e => set('start_time', e.target.value)} />
              </div>

              <div className="space-y-1">
                <Label>End Time</Label>
                <Input type="time" value={formData.end_time} onChange={e => set('end_time', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Menu & Beverage */}
          <div>
            <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide mb-3 border-b pb-1">Menu & Beverage</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Menu Style</Label>
                <Select value={formData.menu_style} onValueChange={v => set('menu_style', v)}>
                  <SelectTrigger><SelectValue placeholder="Select style" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buffet">Buffet</SelectItem>
                    <SelectItem value="plated">Plated / Sit-down</SelectItem>
                    <SelectItem value="stations">Food Stations</SelectItem>
                    <SelectItem value="cocktail_reception">Cocktail Reception</SelectItem>
                    <SelectItem value="family_style">Family Style</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Beverage Package</Label>
                <Select value={formData.beverage_package} onValueChange={v => set('beverage_package', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="soft_drinks_only">Soft Drinks Only</SelectItem>
                    <SelectItem value="beer_wine">Beer & Wine</SelectItem>
                    <SelectItem value="open_bar">Open Bar</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1 mt-3">
              <Label>Menu Notes / Dietary Requirements</Label>
              <Textarea value={formData.menu_notes} onChange={e => set('menu_notes', e.target.value)}
                placeholder="Menu details, allergies, dietary restrictions, special requests..." rows={3} />
            </div>
          </div>

          {/* Revenue */}
          <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50 space-y-3">
            <h3 className="font-semibold text-sm text-orange-800 uppercase tracking-wide">Revenue Estimate</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-orange-800">F&B ($)</Label>
                <Input type="number" min="0" value={formData.fb_revenue} onChange={e => set('fb_revenue', e.target.value)} placeholder="0" className="bg-white border-orange-200" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-orange-800">AV / Tech ($)</Label>
                <Input type="number" min="0" value={formData.av_revenue} onChange={e => set('av_revenue', e.target.value)} placeholder="0" className="bg-white border-orange-200" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-orange-800">Decor / Floral ($)</Label>
                <Input type="number" min="0" value={formData.decor_revenue} onChange={e => set('decor_revenue', e.target.value)} placeholder="0" className="bg-white border-orange-200" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-orange-800">Other ($)</Label>
                <Input type="number" min="0" value={formData.other_revenue} onChange={e => set('other_revenue', e.target.value)} placeholder="0" className="bg-white border-orange-200" />
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-orange-600 text-white rounded-lg">
              <span className="text-sm font-medium">Total Estimated Revenue:</span>
              <span className="text-2xl font-bold">${totalRevenue.toLocaleString()}</span>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label>Additional Notes</Label>
            <Textarea value={formData.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Any other details, special requirements, or internal notes..." rows={2} />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={createMutation.isPending} className="bg-orange-600 hover:bg-orange-700">
              {createMutation.isPending ? 'Saving...' : 'Create Catering Event'}
            </Button>
            {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}