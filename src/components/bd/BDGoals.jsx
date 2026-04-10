import React, { useState, useMemo } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, Edit, Trash2, TrendingUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";

export default function BDGoals() {
  const [showDialog, setShowDialog] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [formData, setFormData] = useState({
    seller_name: '',
    seller_type: 'business_development',
    goal_level: 'individual',
    parent_goal_id: '',
    period_type: 'monthly',
    period_start: '',
    period_end: '',
    target_revenue: 0,
    target_leads: 0,
    target_services: {},
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_date')
  });

  const { data: bdLeads = [] } = useQuery({
    queryKey: ['bdLeads'],
    queryFn: () => base44.entities.BDLead.list()
  });

  const servicesList = ['revenue_management', 'sales', 'digital_marketing', 'tech_stack', 'project_management', 'advisory', 'audit'];

  // Filter only BD goals
  const bdGoals = goals.filter(g => g.seller_type === 'business_development');

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Goal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Goal.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Goal.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['goals'] })
  });

  const resetForm = () => {
    setFormData({
      seller_name: '',
      seller_type: 'business_development',
      goal_level: 'individual',
      parent_goal_id: '',
      period_type: 'monthly',
      period_start: '',
      period_end: '',
      target_revenue: 0,
      target_leads: 0,
      target_services: {},
      notes: ''
    });
    setEditGoal(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      target_revenue: Number(formData.target_revenue),
      target_leads: Number(formData.target_leads)
    };
    if (editGoal) {
      updateMutation.mutate({ id: editGoal.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (goal) => {
    setEditGoal(goal);
    setFormData(goal);
    setShowDialog(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this goal?')) {
      deleteMutation.mutate(id);
    }
  };

  const calculateProgress = (goal) => {
    const sellerLeads = bdLeads.filter(lead =>
      lead.seller_name === goal.seller_name &&
      lead.created_date >= goal.period_start &&
      lead.created_date <= goal.period_end
    );

    const actualRevenue = sellerLeads
      .filter(l => l.status === 'signed_agreement')
      .reduce((sum, lead) => {
        const total = Object.values(lead.service_pricing || {}).reduce((s, price) => s + price, 0);
        return sum + total;
      }, 0);

    const actualServices = {};
    servicesList.forEach(service => {
      actualServices[service] = sellerLeads.filter(lead =>
        lead.services?.includes(service) && lead.status === 'signed_agreement'
      ).length;
    });

    const targetServices = goal.target_services || {};
    const servicesProgress = {};
    servicesList.forEach(service => {
      const target = targetServices[service] || 0;
      const actual = actualServices[service] || 0;
      servicesProgress[service] = target > 0 ? (actual / target * 100) : 0;
    });

    return {
      revenueProgress: goal.target_revenue > 0 ? (actualRevenue / goal.target_revenue * 100) : 0,
      leadsProgress: goal.target_leads > 0 ? (sellerLeads.length / goal.target_leads * 100) : 0,
      actualRevenue,
      actualLeads: sellerLeads.length,
      actualServices,
      servicesProgress
    };
  };

  const parentGoals = bdGoals.filter(g => g.goal_level === 'company' || g.goal_level === 'team');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Business Development Goals
            </CardTitle>
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Goal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editGoal ? 'Edit' : 'Add'} BD Goal</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Seller Name *</Label>
                      <Input
                        value={formData.seller_name}
                        onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Goal Level *</Label>
                      <Select value={formData.goal_level} onValueChange={(val) => setFormData({ ...formData, goal_level: val })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company">Company</SelectItem>
                          <SelectItem value="team">Team</SelectItem>
                          <SelectItem value="individual">Individual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formData.goal_level === 'individual' && parentGoals.length > 0 && (
                      <div className="space-y-2 col-span-2">
                        <Label>Parent Goal (Optional)</Label>
                        <Select value={formData.parent_goal_id} onValueChange={(val) => setFormData({ ...formData, parent_goal_id: val })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select parent goal" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={null}>None</SelectItem>
                            {parentGoals.map(pg => (
                              <SelectItem key={pg.id} value={pg.id}>
                                {pg.seller_name} ({pg.goal_level})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Period Type *</Label>
                      <Select value={formData.period_type} onValueChange={(val) => setFormData({ ...formData, period_type: val })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Period Start *</Label>
                      <Input
                        type="date"
                        value={formData.period_start}
                        onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Period End *</Label>
                      <Input
                        type="date"
                        value={formData.period_end}
                        onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Revenue ($)</Label>
                      <Input
                        type="number"
                        value={formData.target_revenue}
                        onChange={(e) => setFormData({ ...formData, target_revenue: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Target Leads</Label>
                      <Input
                        type="number"
                        value={formData.target_leads}
                        onChange={(e) => setFormData({ ...formData, target_leads: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Target Services (Signed Agreements)</Label>
                    <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg">
                      {servicesList.map(service => (
                        <div key={service} className="space-y-1">
                          <Label className="text-xs">{service.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.target_services?.[service] || 0}
                            onChange={(e) => setFormData({
                              ...formData,
                              target_services: {
                                ...formData.target_services,
                                [service]: parseInt(e.target.value) || 0
                              }
                            })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editGoal ? 'Update' : 'Create'} Goal
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {bdGoals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No goals set yet. Click "Add Goal" to create your first target.
            </div>
          ) : (
            <div className="space-y-4">
              {bdGoals.map(goal => {
                const progress = calculateProgress(goal);
                const parentGoal = goal.parent_goal_id ? goals.find(g => g.id === goal.parent_goal_id) : null;
                return (
                  <Card key={goal.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="flex items-center gap-2 flex-wrap">
                            <TrendingUp className="w-5 h-5" />
                            {goal.seller_name}
                            <Badge className="bg-purple-100 text-purple-800">BD</Badge>
                            <Badge variant="outline" className="capitalize">{goal.goal_level}</Badge>
                          </CardTitle>
                          {parentGoal && (
                            <p className="text-xs text-gray-500 mt-1">
                              Cascades from: {parentGoal.seller_name}
                            </p>
                          )}
                          <p className="text-sm text-gray-600 mt-1">
                            {goal.period_type} • {format(new Date(goal.period_start), 'MMM d, yyyy')} - {format(new Date(goal.period_end), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(goal)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(goal.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {goal.target_revenue > 0 && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Revenue</span>
                            <span className="font-semibold">${progress.actualRevenue?.toLocaleString() || 0} / ${goal.target_revenue.toLocaleString()}</span>
                          </div>
                          <Progress value={Math.min(progress.revenueProgress || 0, 100)} className="h-2" />
                          <p className="text-xs text-gray-600 mt-1">{(progress.revenueProgress || 0).toFixed(1)}% of target</p>
                        </div>
                      )}
                      {goal.target_leads > 0 && (
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Total Leads</span>
                            <span className="font-semibold">{progress.actualLeads || 0} / {goal.target_leads}</span>
                          </div>
                          <Progress value={Math.min(progress.leadsProgress || 0, 100)} className="h-2" />
                          <p className="text-xs text-gray-600 mt-1">{(progress.leadsProgress || 0).toFixed(1)}% of target</p>
                        </div>
                      )}
                      {goal.target_services && Object.keys(goal.target_services).length > 0 && (
                        <div className="pt-3 border-t">
                          <p className="text-sm font-semibold mb-3">Services Progress</p>
                          <div className="space-y-3">
                            {servicesList.map(service => {
                              const target = goal.target_services?.[service];
                              if (!target || target === 0) return null;
                              const actual = progress.actualServices?.[service] || 0;
                              const serviceProgress = progress.servicesProgress?.[service] || 0;
                              return (
                                <div key={service}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="capitalize">{service.replace(/_/g, ' ')}</span>
                                    <span className="font-semibold">{actual} / {target}</span>
                                  </div>
                                  <Progress value={Math.min(serviceProgress, 100)} className="h-1.5" />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {goal.notes && (
                        <p className="text-sm text-gray-600 pt-2 border-t">{goal.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}