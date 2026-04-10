import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";

const emptySeason = () => ({ season_name: '', start_date: '', end_date: '', rate_type: 'flat_rate', rate_value: '' });

export default function RFPForm({ rfp, onSuccess, onCancel }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState(rfp ? {
    ...rfp,
    seasons: rfp.seasons || []
  } : {
    company_name: '', contact_person: '', contact_email: '', contact_phone: '',
    hotel_id: '', seller_name: '', status: 'in_progress', potential_room_nights: '',
    about_account: '', submission_date: '', response_date: '', seasons: [], notes: ''
  });

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const addSeason = () => setFormData(p => ({ ...p, seasons: [...p.seasons, emptySeason()] }));
  const removeSeason = (i) => setFormData(p => ({ ...p, seasons: p.seasons.filter((_, idx) => idx !== i) }));
  const updateSeason = (i, field, value) => setFormData(p => ({
    ...p,
    seasons: p.seasons.map((s, idx) => idx === i ? { ...s, [field]: value } : s)
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const data = { ...formData, potential_room_nights: Number(formData.potential_room_nights) || 0 };
    if (rfp) {
      await base44.entities.RFP.update(rfp.id, data);
    } else {
      await base44.entities.RFP.create(data);
    }
    queryClient.invalidateQueries({ queryKey: ['rfps'] });
    setLoading(false);
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-slate-300">Company Name *</Label>
          <Input className="bg-slate-700 border-slate-600 text-white" value={formData.company_name} onChange={e => setFormData(p => ({ ...p, company_name: e.target.value }))} required />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Hotel *</Label>
          <Select value={formData.hotel_id} onValueChange={v => setFormData(p => ({ ...p, hotel_id: v }))}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white"><SelectValue placeholder="Select hotel" /></SelectTrigger>
            <SelectContent>{hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Contact Person</Label>
          <Input className="bg-slate-700 border-slate-600 text-white" value={formData.contact_person} onChange={e => setFormData(p => ({ ...p, contact_person: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Contact Email</Label>
          <Input type="email" className="bg-slate-700 border-slate-600 text-white" value={formData.contact_email} onChange={e => setFormData(p => ({ ...p, contact_email: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Contact Phone</Label>
          <Input className="bg-slate-700 border-slate-600 text-white" value={formData.contact_phone} onChange={e => setFormData(p => ({ ...p, contact_phone: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Seller Name</Label>
          <Input className="bg-slate-700 border-slate-600 text-white" value={formData.seller_name} onChange={e => setFormData(p => ({ ...p, seller_name: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Status</Label>
          <Select value={formData.status} onValueChange={v => setFormData(p => ({ ...p, status: v }))}>
            <SelectTrigger className="bg-slate-700 border-slate-600 text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Potential Room Nights</Label>
          <Input type="number" className="bg-slate-700 border-slate-600 text-white" value={formData.potential_room_nights} onChange={e => setFormData(p => ({ ...p, potential_room_nights: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Submission Date</Label>
          <Input type="date" className="bg-slate-700 border-slate-600 text-white [color-scheme:dark]" value={formData.submission_date} onChange={e => setFormData(p => ({ ...p, submission_date: e.target.value }))} />
        </div>
        <div className="space-y-1">
          <Label className="text-slate-300">Response Date</Label>
          <Input type="date" className="bg-slate-700 border-slate-600 text-white [color-scheme:dark]" value={formData.response_date} onChange={e => setFormData(p => ({ ...p, response_date: e.target.value }))} />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-slate-300">About the Account</Label>
        <Textarea className="bg-slate-700 border-slate-600 text-white" rows={3} value={formData.about_account} onChange={e => setFormData(p => ({ ...p, about_account: e.target.value }))} />
      </div>

      {/* Seasons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-slate-300">Rate Offering by Season</Label>
          <Button type="button" size="sm" variant="outline" className="border-slate-400 text-white bg-slate-600 hover:bg-slate-500" onClick={addSeason}>
            <Plus className="w-3 h-3 mr-1" /> Add Season
          </Button>
        </div>
        {formData.seasons.map((season, i) => (
          <div key={i} className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Season Name</Label>
              <Input className="bg-slate-700 border-slate-600 text-white h-8 text-sm" value={season.season_name} onChange={e => updateSeason(i, 'season_name', e.target.value)} placeholder="e.g. Peak Season" />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Rate Type</Label>
              <Select value={season.rate_type} onValueChange={v => updateSeason(i, 'rate_type', v)}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat_rate">Flat Rate ($)</SelectItem>
                  <SelectItem value="discount_percentage">Discount (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">Start Date</Label>
              <Input type="date" className="bg-slate-700 border-slate-600 text-white h-8 text-sm [color-scheme:dark]" value={season.start_date} onChange={e => updateSeason(i, 'start_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">End Date</Label>
              <Input type="date" className="bg-slate-700 border-slate-600 text-white h-8 text-sm [color-scheme:dark]" value={season.end_date} onChange={e => updateSeason(i, 'end_date', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-slate-400 text-xs">{season.rate_type === 'flat_rate' ? 'Rate ($)' : 'Discount (%)'}</Label>
              <Input type="number" className="bg-slate-700 border-slate-600 text-white h-8 text-sm" value={season.rate_value} onChange={e => updateSeason(i, 'rate_value', e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="button" size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8" onClick={() => removeSeason(i)}>
                <Trash2 className="w-3 h-3 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <Label className="text-slate-300">Notes</Label>
        <Textarea className="bg-slate-700 border-slate-600 text-white" rows={2} value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 flex-1">
          {loading ? 'Saving...' : rfp ? 'Update RFP' : 'Create RFP'}
        </Button>
        <Button type="button" variant="outline" className="border-slate-400 text-white bg-slate-600 hover:bg-slate-500" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}