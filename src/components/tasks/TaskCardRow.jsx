import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Circle, CheckCircle2, Clock, AlertTriangle, Bell, Edit, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function TaskCardRow({ task, getDueDateAlert, toggleStatus, handleEdit, deleteMutation, statusColors, priorityColors }) {
  const alert = getDueDateAlert(task);

  return (
    <Card className={`border transition-all ${
      alert?.icon === 'overdue' ? 'bg-red-950/40 border-red-700' :
      alert?.icon === 'today' ? 'bg-orange-950/40 border-orange-700' :
      alert?.icon === 'soon' ? 'bg-yellow-950/30 border-yellow-700' :
      'bg-blue-950/30 border-blue-700 hover:bg-blue-950/50'}`
    }>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <button onClick={() => toggleStatus(task)} className="mt-1">
            {task.status === 'completed' ?
              <CheckCircle2 className="w-5 h-5 text-green-500" /> :
              <Circle className="w-5 h-5 text-gray-400" />
            }
          </button>
          <div className="flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className={`font-semibold ${task.status === 'completed' ? 'line-through text-slate-500' : 'text-white'}`}>
                {task.title}
              </h3>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={() => handleEdit(task)}>
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-400" onClick={() => deleteMutation.mutate(task.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            {task.description &&
              <p className="text-sm text-slate-400 mt-1">{task.description}</p>
            }
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className={statusColors[task.status]}>{task.status.replace('_', ' ')}</Badge>
              <Badge className={priorityColors[task.priority]}>{task.priority}</Badge>
              {task.due_date &&
                <Badge className="bg-slate-700 text-slate-200 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(parseISO(task.due_date), 'MMM d, yyyy')}
                </Badge>
              }
              {alert &&
                <Badge className={`flex items-center gap-1 ${alert.color}`}>
                  {alert.icon === 'overdue' && <AlertTriangle className="w-3 h-3" />}
                  {alert.icon === 'today' && <Bell className="w-3 h-3" />}
                  {alert.icon === 'soon' && <Clock className="w-3 h-3" />}
                  {alert.label}
                </Badge>
              }
              {task.assigned_to &&
                <Badge className="bg-slate-700 text-slate-300">Assigned: {task.assigned_to}</Badge>
              }
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}