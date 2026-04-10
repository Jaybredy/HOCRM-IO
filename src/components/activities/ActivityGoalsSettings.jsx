import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Target } from "lucide-react";

const ACTIVITY_LABELS = {
  solicitation_call: 'Solicitation Calls',
  prospecting: 'Prospecting',
  sent_proposal: 'Proposals Sent',
  follow_up: 'Follow Ups',
  site_inspection: 'Site Inspections',
  network_event: 'Networking Events',
  tradeshow: 'Tradeshows',
  client_entertainment: 'Client Entertainment',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;

export default function ActivityGoalsSettings() {
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [formData, setFormData] = useState({ seller_name: '', year: currentYear, month: currentMonth, ...Object.fromEntries(Object.keys(ACTIVITY_LABELS).map(k => [k, ''])) });

  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery({ queryKey: ['activityGoals'], queryFn: () => base44.entities.ActivityGoal.list() });
  const { data: activities = [] } = useQuery({ queryKey: ['activityLogs'], queryFn: () => base44.entities.ActivityLog.list() });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ActivityGoal.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activityGoals'] }); setShowForm(false); }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ActivityGoal.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['activityGoals'] }); setShowForm(false); setEditingGoal(null); }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ActivityGoal.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['activityGoals'] })
  });

  const handleOpen = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({ ...Object.fromEntries(Object.keys(ACTIVITY_LABELS).map(k => [k, ''])), ...goal });
    } else {
      setEditingGoal(null);
      setFormData({ seller_name: '', year: currentYear, month: currentMonth, ...Object.fromEntries(Object.keys(ACTIVITY_LABELS).map(k => [k, ''])) });
    }
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData, year: parseInt(formData.year), month: parseInt(formData.month) };
    Object.keys(ACTIVITY_LABELS).forEach(k => { payload[k] = parseInt(formData[k]) || 0; });
    if (editingGoal) {
      updateMutation.mutate({ id: editingGoal.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getActualCount = (goal, activityType) => {
    return activities.filter(a => {
      const d = new Date(a.activity_date);
      return a.seller_name === goal.seller_name &&
        d.getFullYear() === goal.year &&
        d.getMonth() + 1 === goal.month &&
        a.activity_type === activityType;
    }).length;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-sm text-gray-500">Set monthly activity targets per seller. Track progress on the Sales Activities page.</p>
        </div>
        <Button onClick={() => handleOpen()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-1" /> Add Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-500">
          <Target className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No activity goals set yet. Add goals to track team performance against targets.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.sort((a, b) => b.year - a.year || b.month - a.month).map(goal => (
            <Card key={goal.id} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="font-semibold text-gray-800">{goal.seller_name}</span>
                    <span className="text-gray-500 text-sm ml-2">{MONTHS[goal.month - 1]} {goal.year}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleOpen(goal)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(goal.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(ACTIVITY_LABELS).map(([key, label]) => {
                    const target = goal[key] || 0;
                    if (!target) return null;
                    const actual = getActualCount(goal, key);
                    const pct = Math.min(100, Math.round((actual / target) * 100));
                    return (
                      <div key={key} className="bg-gray-50 rounded-lg p-2.5">
                        <div className="text-xs text-gray-500 mb-1">{label}</div>
                        <div className="flex items-end justify-between">
                          <span className="text-lg font-bold text-gray-800">{actual}</span>
                          <span className="text-xs text-gray-400">/ {target}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Edit Activity Goal' : 'Add Activity Goal'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1 space-y-1.5">
                <Label>Seller Name *</Label>
                <Input value={formData.seller_name} onChange={e => setFormData(prev => ({ ...prev, seller_name: e.target.value }))} placeholder="e.g. John Smith" required />
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Input type="number" value={formData.year} onChange={e => setFormData(prev => ({ ...prev, year: e.target.value }))} min="2020" max="2030" />
              </div>
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select value={String(formData.month)} onValueChange={v => setFormData(prev => ({ ...prev, month: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Monthly Targets (enter 0 or leave blank to skip)</Label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-2">
                    <Label className="text-sm text-gray-600 w-36 shrink-0">{label}</Label>
                    <Input type="number" min="0" value={formData[key] || ''} onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      className="h-8 w-20" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingGoal ? 'Update Goal' : 'Save Goal'}
              </Button>
              <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditingGoal(null); }}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}