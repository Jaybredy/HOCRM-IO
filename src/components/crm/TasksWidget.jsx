import React from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, AlertTriangle, Clock, ListTodo } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

export default function TasksWidget() {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const overdue = activeTasks.filter(t => t.due_date && t.due_date < today);
  const dueToday = activeTasks.filter(t => t.due_date === today);
  const upcoming = activeTasks.filter(t => {
    if (!t.due_date || t.due_date <= today) return false;
    return differenceInDays(parseISO(t.due_date), new Date()) <= 7;
  });

  const displayTasks = [
    ...overdue,
    ...dueToday,
    ...upcoming
  ].slice(0, 5);

  const priorityColors = {
    urgent: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-slate-100 text-slate-700'
  };

  const getDueBadge = (task) => {
    if (!task.due_date) return null;
    if (task.due_date < today) {
      const days = differenceInDays(new Date(), parseISO(task.due_date));
      return <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{days}d overdue</span>;
    }
    if (task.due_date === today) return <span className="text-xs text-orange-400 font-semibold">Due today</span>;
    const days = differenceInDays(parseISO(task.due_date), new Date());
    return <span className="text-xs text-slate-400">{format(parseISO(task.due_date), 'MMM d')}</span>;
  };

  return (
    <Card className="bg-slate-800/60 border border-indigo-700/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-blue-400" />
          My Tasks
          {activeTasks.length > 0 && (
            <span className="bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">{activeTasks.length}</span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30">
              {overdue.length} overdue
            </span>
          )}
          <Link to={createPageUrl('Tasks')}>
            <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white h-7 px-2">View all</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {displayTasks.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">No urgent tasks — you're all caught up! 🎉</p>
        ) : (
          <div className="space-y-2">
            {displayTasks.map(task => (
              <div key={task.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/40 hover:bg-slate-900/60 transition-colors">
                <button
                  onClick={() => updateMutation.mutate({ id: task.id, data: { ...task, status: 'completed' } })}
                  className="mt-0.5 shrink-0"
                  title="Mark complete"
                >
                  <Circle className="w-4 h-4 text-slate-500 hover:text-green-400 transition-colors" />
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getDueBadge(task)}
                    {task.priority && task.priority !== 'medium' && (
                      <Badge className={`text-xs py-0 px-1.5 h-4 ${priorityColors[task.priority]}`}>{task.priority}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}