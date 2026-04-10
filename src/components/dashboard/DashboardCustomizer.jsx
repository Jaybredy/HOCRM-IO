import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { LayoutGrid, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const AVAILABLE_WIDGETS = [
  { id: 'kpi_cards', name: 'KPI Cards', description: 'Key performance indicators' },
  { id: 'pipeline_chart', name: 'Pipeline Chart', description: 'Pipeline visualization' },
  { id: 'pace_comparison', name: 'Pace Comparison', description: 'Budget vs actual pace' },
  { id: 'production_table', name: 'Production Table', description: 'Production entries' },
  { id: 'tasks_widget', name: 'Tasks Widget', description: 'Active tasks' },
  { id: 'today_snapshot', name: 'Today Snapshot', description: 'Daily summary' },
  { id: 'pipeline_value', name: 'Pipeline Value Chart', description: 'Pipeline value by stage' },
  { id: 'seller_performance', name: 'Seller Performance', description: 'Seller metrics' }
];

export default function DashboardCustomizer() {
  const [showDialog, setShowDialog] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedWidgets, setSelectedWidgets] = useState(
    AVAILABLE_WIDGETS.reduce((acc, w) => ({ ...acc, [w.id]: true }), {})
  );

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const { data: preferences } = useQuery({
    queryKey: ['userPreferences', currentUser?.email],
    queryFn: () => {
      if (!currentUser?.email) return null;
      return base44.entities.UserPreferences.filter({ user_email: currentUser.email }).then(results => results[0]);
    },
    enabled: !!currentUser?.email
  });

  useEffect(() => {
    if (preferences?.dashboard_layout) {
      const layout = preferences.dashboard_layout.reduce((acc, item) => ({
        ...acc,
        [item.widget_id]: item.enabled
      }), selectedWidgets);
      setSelectedWidgets(layout);
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (preferences?.id) {
        return base44.entities.UserPreferences.update(preferences.id, data);
      } else {
        return base44.entities.UserPreferences.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
      setShowDialog(false);
    }
  });

  const handleSave = () => {
    const layout = AVAILABLE_WIDGETS.map((w, idx) => ({
      widget_id: w.id,
      widget_name: w.name,
      enabled: selectedWidgets[w.id] || false,
      position: idx
    }));

    saveMutation.mutate({
      user_email: currentUser.email,
      dashboard_layout: layout
    });
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
          <LayoutGrid className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {AVAILABLE_WIDGETS.map(widget => (
            <div key={widget.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-700 hover:border-slate-600">
              <Checkbox
                id={widget.id}
                checked={selectedWidgets[widget.id] || false}
                onCheckedChange={(checked) => setSelectedWidgets(prev => ({
                  ...prev,
                  [widget.id]: checked
                }))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor={widget.id} className="text-sm font-medium text-white cursor-pointer">
                  {widget.name}
                </Label>
                <p className="text-xs text-slate-400 mt-0.5">{widget.description}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end pt-4 border-t border-slate-700">
          <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}