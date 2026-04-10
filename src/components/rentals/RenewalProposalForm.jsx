import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DollarSign, FileText, Send } from 'lucide-react';

export default function RenewalProposalForm({ renewal, onSubmit, onClose, isLoading }) {
  const [formData, setFormData] = useState({
    proposed_monthly_rent: renewal?.proposed_monthly_rent || renewal?.current_monthly_rent || '',
    proposed_lease_start_date: renewal?.proposed_lease_start_date || '',
    proposed_lease_end_date: renewal?.proposed_lease_end_date || '',
    renewal_notes: renewal?.renewal_notes || '',
  });

  const rentIncrease = renewal ? ((formData.proposed_monthly_rent - renewal.current_monthly_rent) / renewal.current_monthly_rent * 100).toFixed(1) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            Generate Lease Renewal Proposal
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current Terms */}
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Current Lease Terms</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-400">Current Rent</p>
                <p className="text-white font-semibold">${renewal?.current_monthly_rent}</p>
              </div>
              <div>
                <p className="text-slate-400">Lease Ends</p>
                <p className="text-white font-semibold">{renewal?.current_lease_end_date}</p>
              </div>
            </div>
          </div>

          {/* Proposed Terms */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300">Proposed Terms</h3>
            
            <div className="space-y-2">
              <Label className="text-slate-300">Proposed Monthly Rent *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <Input
                  type="number"
                  step="0.01"
                  value={formData.proposed_monthly_rent}
                  onChange={(e) => setFormData({ ...formData, proposed_monthly_rent: parseFloat(e.target.value) })}
                  className="bg-slate-800 border-slate-700 text-white pl-8"
                  required
                />
              </div>
              {rentIncrease !== 0 && (
                <p className={`text-xs ${rentIncrease >= 0 ? 'text-amber-400' : 'text-green-400'}`}>
                  {rentIncrease > 0 ? '+' : ''}{rentIncrease}% change from current rent
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-slate-300">Lease Start Date *</Label>
                <Input
                  type="date"
                  value={formData.proposed_lease_start_date}
                  onChange={(e) => setFormData({ ...formData, proposed_lease_start_date: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white [&::-webkit-calendar-picker-indicator]:invert"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Lease End Date *</Label>
                <Input
                  type="date"
                  value={formData.proposed_lease_end_date}
                  onChange={(e) => setFormData({ ...formData, proposed_lease_end_date: e.target.value })}
                  className="bg-slate-800 border-slate-700 text-white [&::-webkit-calendar-picker-indicator]:invert"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Additional Notes</Label>
              <Textarea
                value={formData.renewal_notes}
                onChange={(e) => setFormData({ ...formData, renewal_notes: e.target.value })}
                placeholder="Include any special terms, conditions, or notes for the renewal..."
                className="bg-slate-800 border-slate-700 text-white h-24"
              />
            </div>
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-slate-600 text-slate-300">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700">
            <Send className="w-4 h-4 mr-2" />
            {isLoading ? 'Generating...' : 'Generate & Send Proposal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}