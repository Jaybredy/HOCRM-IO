import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, AlertTriangle, Clock, ListTodo, Activity } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";

const today = new Date().toISOString().split('T')[0];

const STATUS_COLORS = {
  solicitation_call: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
  sent_proposal:     'bg-purple-500/20 text-purple-300 border border-purple-500/30',
  follow_up:         'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  site_visit:        'bg-green-500/20 text-green-300 border border-green-500/30',
  tentative:         'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  definite:          'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
  lost:              'bg-red-500/20 text-red-300 border border-red-500/30',
};

const PRIORITY_COLORS = {
  urgent: 'bg-red-500/20 text-red-300 border border-red-500/30',
  high:   'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  low:    'bg-slate-600/40 text-slate-400 border border-slate-600',
};

function TasksTab() {
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const overdue   = activeTasks.filter(t => t.due_date && t.due_date < today);
  const dueToday  = activeTasks.filter(t => t.due_date === today);
  const upcoming  = activeTasks.filter(t => {
    if (!t.due_date || t.due_date <= today) return false;
    return differenceInDays(parseISO(t.due_date), new Date()) <= 7;
  });

  const displayTasks = [...overdue, ...dueToday, ...upcoming].slice(0, 7);

  const getDueBadge = (task) => {
    if (!task.due_date) return null;
    if (task.due_date < today) {
      const days = differenceInDays(new Date(), parseISO(task.due_date));
      return <span className="text-xs text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{days}d overdue</span>;
    }
    if (task.due_date === today) return <span className="text-xs text-orange-400 font-semibold">Due today</span>;
    return <span className="text-xs text-slate-400">{format(parseISO(task.due_date), 'MMM d')}</span>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/30">
              {overdue.length} overdue
            </span>
          )}
          <span className="text-xs text-slate-500">{activeTasks.length} active</span>
        </div>
        <Link to={createPageUrl('Tasks')}>
          <Button variant="ghost" size="sm" className="text-xs text-slate-400 hover:text-white h-6 px-2">View all</Button>
        </Link>
      </div>

      {displayTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-8 text-slate-500">
          <CheckCircle2 className="w-8 h-8 mb-2 text-green-500/40" />
          <p className="text-sm">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {displayTasks.map(task => (
            <div key={task.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/50 hover:bg-slate-800/60 transition-colors group">
              <button
                onClick={() => updateMutation.mutate({ id: task.id, data: { ...task, status: 'completed' } })}
                className="mt-0.5 shrink-0"
                title="Mark complete"
              >
                <Circle className="w-4 h-4 text-slate-600 group-hover:text-green-400 transition-colors" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-100 font-medium truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {getDueBadge(task)}
                  {task.priority && task.priority !== 'medium' && (
                    <span className={`text-xs px-1.5 py-0 rounded-full ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityTab() {
  const { data: activities = [] } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-activity_date', 10)
  });

  return (
    <div className="flex flex-col h-full">
      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 py-8 text-slate-500">
          <Activity className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No activity logged yet</p>
        </div>
      ) : (
        <div className="space-y-1 overflow-y-auto flex-1">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start justify-between gap-2 p-2.5 rounded-lg hover:bg-slate-800/40 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{activity.client_name}</p>
                <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-1 ${STATUS_COLORS[activity.status] || 'bg-slate-700/50 text-slate-400'}`}>
                  {activity.status.replace(/_/g, ' ')}
                </span>
              </div>
              <span className="text-xs text-slate-500 shrink-0 mt-0.5">
                {format(new Date(activity.activity_date), 'MMM d')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SidebarPanel() {
  const [activeTab, setActiveTab] = useState('tasks');

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date')
  });

  const overdueCount = tasks.filter(t =>
    t.status !== 'completed' && t.status !== 'cancelled' && t.due_date && t.due_date < today
  ).length;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 backdrop-blur overflow-hidden flex flex-col h-full" style={{ minHeight: '480px' }}>
      {/* Tab Bar */}
      <div className="flex border-b border-slate-700 bg-slate-800/50">
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'tasks'
              ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
              : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          My Tasks
          {overdueCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {overdueCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'activity'
              ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
              : 'text-slate-400 hover:text-slate-200 border-b-2 border-transparent'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Activity
        </button>
      </div>

      {/* Tab Content */}
      <div className="p-3 flex-1 overflow-hidden flex flex-col">
        {activeTab === 'tasks' ? <TasksTab /> : <ActivityTab />}
      </div>
    </div>
  );
}