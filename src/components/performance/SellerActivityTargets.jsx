import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Target } from "lucide-react";

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const emptyForm = () => ({
  seller_name: '',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  target_solicitations: 0,
  target_prospects: 0,
  target_proposals: 0,
  target_contracts: 0,
  target_follow_ups: 0,
  target_site_visits: 0
});

export default function SellerActivityTargets() {
  const [showForm, setShowForm] = useState(false);
  const [editingTarget, setEditingTarget] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const queryClient = useQueryClient();

  const { data: targets = [] } = useQuery({
    queryKey: ['seller_activity_targets'],
    queryFn: () => base44.entities.SalesTarget.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SalesTarget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller_activity_targets'] });
      setShowForm(false);
      setFormData(emptyForm());
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SalesTarget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['seller_activity_targets'] });
      setShowForm(false);
      setEditingTarget(null);
      setFormData(emptyForm());
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SalesTarget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seller_activity_targets'] })
  });

  const handleEdit = (t) => {
    setEditingTarget(t);
    setFormData({
      seller_name: t.seller_name || '',
      year: t.year || new Date().getFullYear(),
      month: t.month || new Date().getMonth() + 1,
      target_solicitations: t.target_solicitations || 0,
      target_prospects: t.target_prospects || 0,
      target_proposals: t.target_proposals || 0,
      target_contracts: t.target_contracts || 0,
      target_follow_ups: t.target_follow_ups || 0,
      target_site_visits: t.target_site_visits || 0
    });
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = { ...formData, year: Number(formData.year), month: Number(formData.month) };
    if (editingTarget) {
      updateMutation.mutate({ id: editingTarget.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const activityFields = [
    { key: 'target_solicitations', label: 'Solicitation Calls' },
    { key: 'target_prospects', label: 'Prospects' },
    { key: 'target_proposals', label: 'Proposals Sent' },
    { key: 'target_contracts', label: 'Contracts / Definites' },
    { key: 'target_follow_ups', label: 'Follow-ups' },
    { key: 'target_site_visits', label: 'Site Visits' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <CardTitle>Seller Activity Targets</CardTitle>
          </div>
          <Dialog open={showForm} onOpenChange={(open) => {
            setShowForm(open);
            if (!open) { setEditingTarget(null); setFormData(emptyForm()); }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />Add Target
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingTarget ? 'Edit' : 'Add'} Seller Activity Target</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Seller Name *</Label>
                  <Input value={formData.seller_name}
                    onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                    required placeholder="e.g. John Smith" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Year</Label>
                    <Input type="number" value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: e.target.value })} required />
                  </div>
                  <div>
                    <Label>Month</Label>
                    <Select value={formData.month.toString()}
                      onValueChange={(v) => setFormData({ ...formData, month: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
                  <p className="text-sm font-medium text-gray-700">Monthly Activity Targets</p>
                  {activityFields.map(field => (
                    <div key={field.key} className="grid grid-cols-2 gap-2 items-center">
                      <Label className="text-sm">{field.label}</Label>
                      <Input type="number" min="0" value={formData[field.key]}
                        onChange={(e) => setFormData({ ...formData, [field.key]: parseInt(e.target.value) || 0 })}
                        className="h-8" placeholder="0" />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1">
                    {editingTarget ? 'Update' : 'Create'} Target
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Seller</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Solicit.</TableHead>
              <TableHead className="text-right">Prospects</TableHead>
              <TableHead className="text-right">Proposals</TableHead>
              <TableHead className="text-right">Contracts</TableHead>
              <TableHead className="text-right">Follow-ups</TableHead>
              <TableHead className="text-right">Site Visits</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {targets.filter(t => t.seller_name && t.month).length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-500">
                  No seller activity targets set.
                </TableCell>
              </TableRow>
            ) : (
              targets.filter(t => t.seller_name && t.month).map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.seller_name}</TableCell>
                  <TableCell>{t.month ? MONTHS[t.month - 1] : '—'} {t.year}</TableCell>
                  <TableCell className="text-right">{t.target_solicitations || 0}</TableCell>
                  <TableCell className="text-right">{t.target_prospects || 0}</TableCell>
                  <TableCell className="text-right">{t.target_proposals || 0}</TableCell>
                  <TableCell className="text-right">{t.target_contracts || 0}</TableCell>
                  <TableCell className="text-right">{t.target_follow_ups || 0}</TableCell>
                  <TableCell className="text-right">{t.target_site_visits || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => handleEdit(t)}><Edit className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
                        onClick={() => deleteMutation.mutate(t.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}