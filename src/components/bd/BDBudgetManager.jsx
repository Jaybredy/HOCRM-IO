import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function BDBudgetManager({ bdLeads = [] }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [formData, setFormData] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    seller_name: 'Team Total',
    budget_leads: 0,
    budget_signed_deals: 0,
    budget_revenue: 0,
    budget_services: {},
    forecast_leads: 0,
    forecast_signed_deals: 0,
    forecast_revenue: 0,
    notes: ''
  });

  const queryClient = useQueryClient();

  const { data: budgets = [] } = useQuery({
    queryKey: ['bdBudgets', selectedYear],
    queryFn: () => base44.entities.BDBudget.filter({ year: selectedYear })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BDBudget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdBudgets'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BDBudget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdBudgets'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BDBudget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bdBudgets'] })
  });

  const resetForm = () => {
    setFormData({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      seller_name: 'Team Total',
      budget_leads: 0,
      budget_signed_deals: 0,
      budget_revenue: 0,
      budget_services: {},
      forecast_leads: 0,
      forecast_signed_deals: 0,
      forecast_revenue: 0,
      notes: ''
    });
    setEditingBudget(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      year: Number(formData.year),
      month: Number(formData.month),
      budget_leads: Number(formData.budget_leads),
      budget_signed_deals: Number(formData.budget_signed_deals),
      budget_revenue: Number(formData.budget_revenue),
      forecast_leads: Number(formData.forecast_leads),
      forecast_signed_deals: Number(formData.forecast_signed_deals),
      forecast_revenue: Number(formData.forecast_revenue)
    };

    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setFormData(budget);
    setShowDialog(true);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this budget entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const getActuals = (month) => {
    const startDate = new Date(selectedYear, month - 1, 1).toISOString().split('T')[0];
    const endDate = new Date(selectedYear, month, 0).toISOString().split('T')[0];

    const monthLeads = bdLeads.filter(lead => {
      if (!lead.created_date) return false;
      const leadDate = lead.created_date.split('T')[0];
      return leadDate >= startDate && leadDate <= endDate;
    });

    const signedDeals = monthLeads.filter(l => l.status === 'signed_agreement');
    const actualRevenue = signedDeals.reduce((sum, lead) => {
      const total = Object.values(lead.service_pricing || {}).reduce((s, price) => s + price, 0);
      return sum + total;
    }, 0);

    return {
      actualLeads: monthLeads.length,
      actualSigned: signedDeals.length,
      actualRevenue
    };
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>BD Budget vs Actuals</CardTitle>
              <p className="text-sm text-gray-600 mt-1">Track budgeted vs actual performance</p>
            </div>
            <div className="flex gap-2 items-center">
              <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
                <DialogTrigger asChild>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Budget
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingBudget ? 'Edit' : 'Add'} Budget</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Year *</Label>
                        <Input
                          type="number"
                          value={formData.year}
                          onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Month *</Label>
                        <Select value={formData.month.toString()} onValueChange={(val) => setFormData({ ...formData, month: Number(val) })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map((m, i) => (
                              <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Seller Name *</Label>
                      <Input
                        value={formData.seller_name}
                        onChange={(e) => setFormData({ ...formData, seller_name: e.target.value })}
                        placeholder="Team Total or individual name"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Budget Leads</Label>
                        <Input
                          type="number"
                          value={formData.budget_leads}
                          onChange={(e) => setFormData({ ...formData, budget_leads: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Budget Signed Deals</Label>
                        <Input
                          type="number"
                          value={formData.budget_signed_deals}
                          onChange={(e) => setFormData({ ...formData, budget_signed_deals: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Budget Revenue ($)</Label>
                        <Input
                          type="number"
                          value={formData.budget_revenue}
                          onChange={(e) => setFormData({ ...formData, budget_revenue: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Forecast Leads</Label>
                        <Input
                          type="number"
                          value={formData.forecast_leads}
                          onChange={(e) => setFormData({ ...formData, forecast_leads: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Forecast Signed</Label>
                        <Input
                          type="number"
                          value={formData.forecast_signed_deals}
                          onChange={(e) => setFormData({ ...formData, forecast_signed_deals: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label>Forecast Revenue ($)</Label>
                        <Input
                          type="number"
                          value={formData.forecast_revenue}
                          onChange={(e) => setFormData({ ...formData, forecast_revenue: e.target.value })}
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">
                      {editingBudget ? 'Update' : 'Add'} Budget
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {budgets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No budgets set for {selectedYear}. Click "Add Budget" to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead className="text-right">Budget Leads</TableHead>
                  <TableHead className="text-right">Actual Leads</TableHead>
                  <TableHead className="text-right">Budget Revenue</TableHead>
                  <TableHead className="text-right">Actual Revenue</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgets.sort((a, b) => a.month - b.month).map((budget) => {
                  const actuals = getActuals(budget.month);
                  const leadsVariance = ((actuals.actualLeads - budget.budget_leads) / budget.budget_leads * 100) || 0;
                  const revenueVariance = ((actuals.actualRevenue - budget.budget_revenue) / budget.budget_revenue * 100) || 0;

                  return (
                    <TableRow key={budget.id}>
                      <TableCell className="font-medium">{months[budget.month - 1]}</TableCell>
                      <TableCell>{budget.seller_name}</TableCell>
                      <TableCell className="text-right">{budget.budget_leads}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {actuals.actualLeads}
                          {budget.budget_leads > 0 && (
                            <Badge className={leadsVariance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {leadsVariance >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(leadsVariance).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">${budget.budget_revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          ${actuals.actualRevenue.toLocaleString()}
                          {budget.budget_revenue > 0 && (
                            <Badge className={revenueVariance >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                              {revenueVariance >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {Math.abs(revenueVariance).toFixed(0)}%
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(budget)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(budget.id)}>
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}