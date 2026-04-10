import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Edit, Trash2 } from "lucide-react";

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const emptyForm = () => ({
  hotel_id: '',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  group_budget_room_nights: 0,
  group_budget_revenue: 0,
  bt_budget_room_nights: 0,
  bt_budget_revenue: 0,
  budget_marketing_spend: 0
});

export default function BudgetManager({ hotels, budgets }) {
  const [showForm, setShowForm] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [activeTab, setActiveTab] = useState('group');

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setShowForm(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Budget.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setShowForm(false);
      setEditingBudget(null);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Budget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] })
  });

  const resetForm = () => setFormData(emptyForm());

  const handleSubmit = (e) => {
    e.preventDefault();
    // Auto-calc combined totals
    const data = {
      ...formData,
      budget_room_nights: (parseFloat(formData.group_budget_room_nights) || 0) + (parseFloat(formData.bt_budget_room_nights) || 0),
      budget_revenue: (parseFloat(formData.group_budget_revenue) || 0) + (parseFloat(formData.bt_budget_revenue) || 0)
    };
    if (editingBudget) {
      updateMutation.mutate({ id: editingBudget.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setFormData({
      hotel_id: budget.hotel_id,
      year: budget.year,
      month: budget.month,
      group_budget_room_nights: budget.group_budget_room_nights || 0,
      group_budget_revenue: budget.group_budget_revenue || 0,
      bt_budget_room_nights: budget.bt_budget_room_nights || 0,
      bt_budget_revenue: budget.bt_budget_revenue || 0,
      budget_marketing_spend: budget.budget_marketing_spend || 0
    });
    setShowForm(true);
  };

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || 'Unknown';

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Monthly Budget Management</CardTitle>
          <Dialog open={showForm} onOpenChange={(open) => {
            setShowForm(open);
            if (!open) { setEditingBudget(null); resetForm(); }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />Add Budget
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingBudget ? 'Edit Budget' : 'Add Monthly Budget'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Hotel *</Label>
                  <Select value={formData.hotel_id} onValueChange={(v) => setFormData({ ...formData, hotel_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select hotel" /></SelectTrigger>
                    <SelectContent>
                      {hotels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Year</Label>
                    <Input type="number" value={formData.year}
                      onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })} required />
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

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="group">Group Budget</TabsTrigger>
                    <TabsTrigger value="bt">Business Transient Budget</TabsTrigger>
                  </TabsList>
                  <TabsContent value="group" className="space-y-3 pt-3">
                    <div>
                      <Label>Group Room Nights</Label>
                      <Input type="number" value={formData.group_budget_room_nights}
                        onChange={(e) => setFormData({ ...formData, group_budget_room_nights: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label>Group Revenue ($)</Label>
                      <Input type="number" value={formData.group_budget_revenue}
                        onChange={(e) => setFormData({ ...formData, group_budget_revenue: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </TabsContent>
                  <TabsContent value="bt" className="space-y-3 pt-3">
                    <div>
                      <Label>BT Room Nights</Label>
                      <Input type="number" value={formData.bt_budget_room_nights}
                        onChange={(e) => setFormData({ ...formData, bt_budget_room_nights: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label>BT Revenue ($)</Label>
                      <Input type="number" value={formData.bt_budget_revenue}
                        onChange={(e) => setFormData({ ...formData, bt_budget_revenue: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </TabsContent>
                </Tabs>

                <div>
                  <Label>Marketing Spend Budget ($)</Label>
                  <Input type="number" value={formData.budget_marketing_spend}
                    onChange={(e) => setFormData({ ...formData, budget_marketing_spend: parseFloat(e.target.value) || 0 })} />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={!formData.hotel_id}>
                    {editingBudget ? 'Update' : 'Create'} Budget
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
              <TableHead>Hotel</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Group RN</TableHead>
              <TableHead className="text-right">Group Revenue</TableHead>
              <TableHead className="text-right">BT RN</TableHead>
              <TableHead className="text-right">BT Revenue</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budgets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  No budgets set. Click "Add Budget" to create one.
                </TableCell>
              </TableRow>
            ) : (
              [...budgets]
                .sort((a, b) => b.year - a.year || b.month - a.month)
                .map((budget) => (
                  <TableRow key={budget.id}>
                    <TableCell className="font-medium">{getHotelName(budget.hotel_id)}</TableCell>
                    <TableCell>{MONTHS[budget.month - 1]} {budget.year}</TableCell>
                    <TableCell className="text-right">{(budget.group_budget_room_nights || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">${(budget.group_budget_revenue || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{(budget.bt_budget_room_nights || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">${(budget.bt_budget_revenue || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(budget)}><Edit className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700"
                          onClick={() => deleteMutation.mutate(budget.id)}><Trash2 className="w-4 h-4" /></Button>
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