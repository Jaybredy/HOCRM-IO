import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Target } from "lucide-react";

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function SalesTargetManager({ hotels }) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState({
    hotel_id: '',
    year: currentYear,
    period_type: 'monthly',
    period_value: new Date().getMonth() + 1,
    target_room_nights: '',
    target_revenue: '',
    target_definite_room_nights: '',
    target_definite_revenue: '',
    notes: ''
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['sales_targets'],
    queryFn: () => base44.entities.SalesTarget.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SalesTarget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales_targets'] });
      setForm({ ...form, target_room_nights: '', target_revenue: '', target_definite_room_nights: '', target_definite_revenue: '', notes: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SalesTarget.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sales_targets'] })
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      year: Number(form.year),
      period_value: Number(form.period_value),
      target_room_nights: form.target_room_nights ? Number(form.target_room_nights) : undefined,
      target_revenue: form.target_revenue ? Number(form.target_revenue) : undefined,
      target_definite_room_nights: form.target_definite_room_nights ? Number(form.target_definite_room_nights) : undefined,
      target_definite_revenue: form.target_definite_revenue ? Number(form.target_definite_revenue) : undefined,
    });
  };

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || 'Unknown';
  const getPeriodLabel = (t) => {
    if (t.period_type === 'monthly') return MONTHS[(t.period_value || 1) - 1];
    return `Q${t.period_value}`;
  };

  return (
    <div className="space-y-6">
      {/* Add Target Form */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-400" />
            Add Sales Target
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-slate-300 mb-1 block">Hotel</Label>
              <Select value={form.hotel_id} onValueChange={(v) => setForm({ ...form, hotel_id: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Select hotel" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {hotels.map(h => (
                    <SelectItem key={h.id} value={h.id} className="text-white">{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Year</Label>
              <Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Period Type</Label>
              <Select value={form.period_type} onValueChange={(v) => setForm({ ...form, period_type: v, period_value: 1 })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  <SelectItem value="monthly" className="text-white">Monthly</SelectItem>
                  <SelectItem value="quarterly" className="text-white">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">{form.period_type === 'monthly' ? 'Month' : 'Quarter'}</Label>
              <Select value={String(form.period_value)} onValueChange={(v) => setForm({ ...form, period_value: Number(v) })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {form.period_type === 'monthly'
                    ? MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)} className="text-white">{m}</SelectItem>)
                    : [1,2,3,4].map(q => <SelectItem key={q} value={String(q)} className="text-white">Q{q}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Target Room Nights</Label>
              <Input type="number" placeholder="0" value={form.target_room_nights}
                onChange={(e) => setForm({ ...form, target_room_nights: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Target Revenue ($)</Label>
              <Input type="number" placeholder="0" value={form.target_revenue}
                onChange={(e) => setForm({ ...form, target_revenue: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Target Definite RN</Label>
              <Input type="number" placeholder="0" value={form.target_definite_room_nights}
                onChange={(e) => setForm({ ...form, target_definite_room_nights: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div>
              <Label className="text-slate-300 mb-1 block">Target Definite Revenue ($)</Label>
              <Input type="number" placeholder="0" value={form.target_definite_revenue}
                onChange={(e) => setForm({ ...form, target_definite_revenue: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white" />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={!form.hotel_id || createMutation.isPending}
                className="w-full bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Target
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Targets */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Existing Targets</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-slate-300">Hotel</TableHead>
                <TableHead className="text-slate-300">Period</TableHead>
                <TableHead className="text-right text-slate-300">Target RN</TableHead>
                <TableHead className="text-right text-slate-300">Target Revenue</TableHead>
                <TableHead className="text-right text-slate-300">Def. RN</TableHead>
                <TableHead className="text-right text-slate-300">Def. Revenue</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-400 py-8">No targets set yet</TableCell>
                </TableRow>
              )}
              {targets.map(t => (
                <TableRow key={t.id} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-white font-medium">{getHotelName(t.hotel_id)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-blue-500 text-blue-400">
                      {getPeriodLabel(t)} {t.year}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-slate-300">{(t.target_room_nights || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">${(t.target_revenue || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">{(t.target_definite_room_nights || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-slate-300">${(t.target_definite_revenue || 0).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(t.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}