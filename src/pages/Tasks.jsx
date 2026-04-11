import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CheckCircle2, Circle, Clock, AlertTriangle, Bell, Trash2, Edit, List, CalendarDays } from "lucide-react";
import TaskCardRow from "@/components/tasks/TaskCardRow";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger } from
"@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInDays, isPast, isToday, isTomorrow, parseISO } from "date-fns";
import NotificationPreferences, { loadPrefs } from "@/components/tasks/NotificationPreferences";
import TaskCalendarView from "@/components/tasks/TaskCalendarView";

export default function Tasks() {
  const [showDialog, setShowDialog] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigned_to: '',
    due_date: '',
    priority: 'medium',
    status: 'todo',
    related_production_id: '',
    related_client_id: ''
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash === '#add-task') {
      setShowDialog(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => base44.entities.Task.list('-created_date')
  });

  const { data: production = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list()
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: () => base44.entities.Client.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Task.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowDialog(false);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] })
  });

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      assigned_to: '',
      due_date: '',
      priority: 'medium',
      status: 'todo',
      related_production_id: '',
      related_client_id: ''
    });
    setEditTask(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editTask) {
      updateMutation.mutate({ id: editTask.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (task) => {
    setEditTask(task);
    setFormData(task);
    setShowDialog(true);
  };

  const toggleStatus = (task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    updateMutation.mutate({ id: task.id, data: { ...task, status: newStatus } });
  };

  const today = new Date().toISOString().split('T')[0];

  // Send email reminders based on user preferences
  useEffect(() => {
    if (!tasks.length) return;
    const prefs = loadPrefs();
    const lastSentKey = 'task_reminders_sent';
    let lastSent = {};
    try { lastSent = JSON.parse(localStorage.getItem(lastSentKey) || '{}'); } catch {}

    const todayStr = today;
    tasks.forEach((task) => {
      if (!task.due_date || !task.assigned_to || task.status === 'completed' || task.status === 'cancelled') return;
      const days = differenceInDays(parseISO(task.due_date), new Date());
      const sentKey = `${task.id}_${todayStr}`;

      const shouldSend = (
        (prefs.onOverdue && days < 0) ||
        (prefs.onDueDate && days === 0) ||
        (prefs.oneDayBefore && days === 1) ||
        (prefs.threeDaysBefore && days === 3)
      );

      if (shouldSend && !lastSent[sentKey]) {
        const label = days < 0 ? `overdue by ${Math.abs(days)} day(s)` :
                      days === 0 ? 'due today' :
                      `due in ${days} day(s)`;
        base44.integrations.Core.SendEmail({
          to: task.assigned_to,
          subject: `Task Reminder: "${task.title}" is ${label}`,
          body: `Hi,\n\nThis is a reminder that your task "${task.title}" is ${label} (due: ${task.due_date}).\n\nPriority: ${task.priority}\n${task.description ? `\nDetails: ${task.description}\n` : ''}\nPlease take action soon.\n\n— GBSales-CRM CRM`
        }).catch(() => {});
        lastSent[sentKey] = true;
      }
    });

    localStorage.setItem(lastSentKey, JSON.stringify(lastSent));
  }, [tasks, today]);

  const filteredTasks = tasks.
  filter((task) => filterStatus === 'all' || task.status === filterStatus).
  sort((a, b) => {
    // Sort: overdue first, then by due date ascending
    const aOverdue = a.due_date < today && a.status !== 'completed' && a.status !== 'cancelled';
    const bOverdue = b.due_date < today && b.status !== 'completed' && b.status !== 'cancelled';
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    return (a.due_date || '').localeCompare(b.due_date || '');
  });

  // Group tasks by date sections
  const groupTasksByDate = (tasks) => {
    const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endOfWeek = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const groups = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDueDate: []
    };

    tasks.forEach(task => {
      if (!task.due_date) {
        groups.noDueDate.push(task);
      } else if (task.due_date < today) {
        groups.overdue.push(task);
      } else if (task.due_date === today) {
        groups.today.push(task);
      } else if (task.due_date === tomorrow) {
        groups.tomorrow.push(task);
      } else if (task.due_date < endOfWeek) {
        groups.thisWeek.push(task);
      } else {
        groups.later.push(task);
      }
    });

    return groups;
  };

  const groupedTasks = groupTasksByDate(filteredTasks);

  // Compute alert counts
  const overdueTasks = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'completed' && t.status !== 'cancelled');
  const dueTodayTasks = tasks.filter((t) => t.due_date === today && t.status !== 'completed' && t.status !== 'cancelled');
  const dueSoonTasks = tasks.filter((t) => {
    if (!t.due_date || t.status === 'completed' || t.status === 'cancelled') return false;
    const days = differenceInDays(parseISO(t.due_date), new Date());
    return days > 0 && days <= 3;
  });

  const getDueDateAlert = (task) => {
    if (task.status === 'completed' || task.status === 'cancelled') return null;
    if (!task.due_date) return null;
    const days = differenceInDays(parseISO(task.due_date), new Date());
    if (task.due_date < today) return { label: `${Math.abs(days)}d overdue`, color: 'bg-red-100 text-red-800 border border-red-300', icon: 'overdue' };
    if (days === 0) return { label: 'Due today!', color: 'bg-orange-100 text-orange-800 border border-orange-300', icon: 'today' };
    if (days === 1) return { label: 'Due tomorrow', color: 'bg-yellow-100 text-yellow-800 border border-yellow-300', icon: 'soon' };
    if (days <= 3) return { label: `Due in ${days} days`, color: 'bg-yellow-50 text-yellow-700 border border-yellow-200', icon: 'soon' };
    return null;
  };

  const statusColors = {
    todo: 'bg-slate-700 text-slate-200 border border-slate-600',
    in_progress: 'bg-blue-700 text-blue-100 border border-blue-600',
    completed: 'bg-green-700 text-green-100 border border-green-600',
    cancelled: 'bg-red-800 text-red-200 border border-red-700'
  };

  const priorityColors = {
    low: 'bg-slate-700 text-slate-300 border border-slate-600',
    medium: 'bg-yellow-600 text-yellow-100 border border-yellow-500',
    high: 'bg-orange-600 text-orange-100 border border-orange-500',
    urgent: 'bg-red-700 text-red-100 border border-red-600'
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
              <CheckCircle2 className="w-8 h-8 text-blue-400" />
              Task Management
            </h1>
            <p className="text-slate-400 mt-1">Track and manage your sales tasks</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5">
              <Button
                size="sm"
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                className={`h-8 px-3 ${viewMode !== 'list' ? 'text-slate-400 hover:text-white' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <List className="w-4 h-4 mr-1" /> List
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                className={`h-8 px-3 ${viewMode !== 'calendar' ? 'text-slate-400 hover:text-white' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                <CalendarDays className="w-4 h-4 mr-1" /> Calendar
              </Button>
            </div>
            <NotificationPreferences />
            <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-900/30">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editTask ? 'Edit' : 'Add'} Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Assigned To</Label>
                      <Input value={formData.assigned_to} onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Due Date *</Label>
                      <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formData.priority} onValueChange={(val) => setFormData({ ...formData, priority: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Related Production</Label>
                      <Select value={formData.related_production_id} onValueChange={(val) => setFormData({ ...formData, related_production_id: val })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>None</SelectItem>
                          {production.map((p) => <SelectItem key={p.id} value={p.id}>{p.client_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Related Client</Label>
                      <Select value={formData.related_client_id} onValueChange={(val) => setFormData({ ...formData, related_client_id: val })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={null}>None</SelectItem>
                          {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    {editTask ? 'Update' : 'Create'} Task
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

          {/* Alert Banners */}
          {(overdueTasks.length > 0 || dueTodayTasks.length > 0 || dueSoonTasks.length > 0) &&
        <div className="space-y-2">
              {overdueTasks.length > 0 &&
          <div className="bg-rose-700 px-4 py-3 rounded-lg flex items-center gap-3 border border-red-500">
                  <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                  <span className="text-red-200 font-semibold">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}:</span>
                  <span className="text-red-300 text-sm font-semibold truncate">{overdueTasks.map((t) => t.title).join(', ')}</span>
                </div>
          }
              {dueTodayTasks.length > 0 &&
          <div className="flex items-center gap-3 bg-orange-900/60 border border-orange-500 rounded-lg px-4 py-3">
                  <Bell className="text-orange-200 lucide lucide-bell w-5 h-5 shrink-0" />
                  <span className="text-orange-200 font-semibold">{dueTodayTasks.length} task{dueTodayTasks.length > 1 ? 's' : ''} due today:</span>
                  <span className="text-orange-200 text-sm font-semibold truncate">{dueTodayTasks.map((t) => t.title).join(', ')}</span>
                </div>
          }
              {dueSoonTasks.length > 0 &&
          <div className="flex items-center gap-3 bg-yellow-900/40 border border-yellow-600 rounded-lg px-4 py-3">
                  <Clock className="w-5 h-5 text-yellow-400 shrink-0" />
                  <span className="text-yellow-200 font-semibold">{dueSoonTasks.length} task{dueSoonTasks.length > 1 ? 's' : ''} due within 3 days</span>
                </div>
          }
            </div>
        }

        {viewMode === 'calendar' ? (
          <Card className="bg-slate-900/50 border-indigo-700/50 backdrop-blur-sm">
            <CardContent className="p-4 md:p-6">
              <TaskCalendarView tasks={tasks} onEditTask={handleEdit} />
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-slate-900/50 border-indigo-700/50 backdrop-blur-sm">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Button variant={filterStatus === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('all')} className={filterStatus !== 'all' ? 'bg-slate-700 text-white border-slate-600 hover:bg-slate-600' : ''}>All</Button>
              <Button variant={filterStatus === 'todo' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('todo')} className={filterStatus !== 'todo' ? 'bg-slate-700 text-white border-slate-600 hover:bg-slate-600' : ''}>To Do</Button>
              <Button variant={filterStatus === 'in_progress' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('in_progress')} className={filterStatus !== 'in_progress' ? 'bg-slate-700 text-white border-slate-600 hover:bg-slate-600' : ''}>In Progress</Button>
              <Button variant={filterStatus === 'completed' ? 'default' : 'outline'} size="sm" onClick={() => setFilterStatus('completed')} className={filterStatus !== 'completed' ? 'bg-slate-700 text-white border-slate-600 hover:bg-slate-600' : ''}>Completed</Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredTasks.length === 0 ? (
              <p className="text-center text-slate-400 py-8">No tasks found</p>
            ) : (
              <div className="space-y-6">
                {/* Overdue Section */}
                {groupedTasks.overdue.length > 0 && (
                  <div>
                    <h3 className="text-red-400 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Overdue ({groupedTasks.overdue.length})
                    </h3>
                    <div className="space-y-3">
                      {groupedTasks.overdue.map((task) => (
                        <TaskCardRow key={task.id} task={task} getDueDateAlert={getDueDateAlert} toggleStatus={toggleStatus} handleEdit={handleEdit} deleteMutation={deleteMutation} statusColors={statusColors} priorityColors={priorityColors} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Today Section */}
                {groupedTasks.today.length > 0 && (
                  <div>
                    <h3 className="text-orange-400 font-semibold text-sm uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      Today ({groupedTasks.today.length})
                    </h3>
                    <div className="space-y-3">
                      {groupedTasks.today.map((task) => (
                        <TaskCardRow key={task.id} task={task} getDueDateAlert={getDueDateAlert} toggleStatus={toggleStatus} handleEdit={handleEdit} deleteMutation={deleteMutation} statusColors={statusColors} priorityColors={priorityColors} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tomorrow Section */}
                {groupedTasks.tomorrow.length > 0 && (
                  <div>
                    <h3 className="text-yellow-400 font-semibold text-sm uppercase tracking-wide mb-3">
                      Tomorrow ({groupedTasks.tomorrow.length})
                    </h3>
                    <div className="space-y-3">
                      {groupedTasks.tomorrow.map((task) => (
                        <TaskCardRow key={task.id} task={task} getDueDateAlert={getDueDateAlert} toggleStatus={toggleStatus} handleEdit={handleEdit} deleteMutation={deleteMutation} statusColors={statusColors} priorityColors={priorityColors} />
                      ))}
                    </div>
                  </div>
                )}

                {/* This Week Section */}
                {groupedTasks.thisWeek.length > 0 && (
                  <div>
                    <h3 className="text-blue-400 font-semibold text-sm uppercase tracking-wide mb-3">
                      This Week ({groupedTasks.thisWeek.length})
                    </h3>
                    <div className="space-y-3">
                      {groupedTasks.thisWeek.map((task) => (
                        <TaskCardRow key={task.id} task={task} getDueDateAlert={getDueDateAlert} toggleStatus={toggleStatus} handleEdit={handleEdit} deleteMutation={deleteMutation} statusColors={statusColors} priorityColors={priorityColors} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Later Section */}
                {groupedTasks.later.length > 0 && (
                  <div>
                    <h3 className="text-slate-400 font-semibold text-sm uppercase tracking-wide mb-3">
                      Later ({groupedTasks.later.length})
                    </h3>
                    <div className="space-y-3">
                      {groupedTasks.later.map((task) => (
                        <TaskCardRow key={task.id} task={task} getDueDateAlert={getDueDateAlert} toggleStatus={toggleStatus} handleEdit={handleEdit} deleteMutation={deleteMutation} statusColors={statusColors} priorityColors={priorityColors} />
                      ))}
                    </div>
                  </div>
                )}

                {/* No Due Date Section */}
                {groupedTasks.noDueDate.length > 0 && (
                  <div>
                    <h3 className="text-slate-500 font-semibold text-sm uppercase tracking-wide mb-3">
                      No Due Date ({groupedTasks.noDueDate.length})
                    </h3>
                    <div className="space-y-3">
                      {groupedTasks.noDueDate.map((task) => (
                        <TaskCardRow key={task.id} task={task} getDueDateAlert={getDueDateAlert} toggleStatus={toggleStatus} handleEdit={handleEdit} deleteMutation={deleteMutation} statusColors={statusColors} priorityColors={priorityColors} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>
    </div>);

}