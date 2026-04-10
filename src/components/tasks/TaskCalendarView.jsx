import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, parseISO, isToday, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

const priorityDot = {
  low: 'bg-slate-400',
  medium: 'bg-yellow-400',
  high: 'bg-orange-400',
  urgent: 'bg-red-500',
};

const statusBg = {
  todo: 'bg-blue-500/70',
  in_progress: 'bg-indigo-500/70',
  completed: 'bg-green-600/70',
  cancelled: 'bg-slate-500/50 line-through opacity-60',
};

export default function TaskCalendarView({ tasks, onEditTask }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // pad front to align with week start (Sunday=0)
  const startPad = getDay(monthStart);
  const todayStr = new Date().toISOString().split('T')[0];

  const tasksByDate = {};
  tasks.forEach((t) => {
    if (t.due_date) {
      if (!tasksByDate[t.due_date]) tasksByDate[t.due_date] = [];
      tasksByDate[t.due_date].push(t);
    }
  });

  const selectedDateStr = selectedDay ? format(selectedDay, 'yyyy-MM-dd') : null;
  const selectedTasks = selectedDateStr ? (tasksByDate[selectedDateStr] || []) : [];

  return (
    <div className="space-y-4">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" className="text-slate-200 hover:text-white hover:bg-slate-600/60" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h2 className="text-xl font-bold text-slate-100">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" className="text-slate-200 hover:text-white hover:bg-slate-600/60" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-px mb-0">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-semibold text-white py-2 bg-blue-700/70">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-600/40 rounded-xl overflow-hidden border border-slate-600/50">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="bg-slate-800/40 min-h-[90px]" />
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDate[dateStr] || [];
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const isCurrentDay = isToday(day);
          const isOverdue = dateStr < todayStr && dayTasks.some(t => t.status !== 'completed' && t.status !== 'cancelled');

          return (
            <div
              key={dateStr}
              onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
              className={`min-h-[90px] p-1.5 cursor-pointer transition-colors ${
                isSelected ? 'bg-blue-700/40' :
                isCurrentDay ? 'bg-slate-700/60' :
                'bg-slate-800/50 hover:bg-slate-700/40'
              }`}
            >
              <div className={`text-xs font-bold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                isCurrentDay ? 'bg-blue-400 text-white' : 'text-slate-200'
              }`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    onClick={(e) => { e.stopPropagation(); onEditTask(task); }}
                    className={`text-xs px-1 py-0.5 rounded truncate text-white cursor-pointer hover:opacity-80 transition-opacity ${statusBg[task.status]}`}
                    title={task.title}
                  >
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${priorityDot[task.priority]}`} />
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-xs text-slate-300 px-1">+{dayTasks.length - 3} more</div>
                )}
              </div>
              {isOverdue && (
                <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Task Panel */}
      {selectedDay && (
        <div className="bg-slate-800/50 border border-slate-600/50 rounded-xl p-4">
          <h3 className="text-slate-100 font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Tasks for {format(selectedDay, 'MMMM d, yyyy')}
            <span className="text-slate-400 font-normal text-sm">({selectedTasks.length} task{selectedTasks.length !== 1 ? 's' : ''})</span>
          </h3>
          {selectedTasks.length === 0 ? (
            <p className="text-slate-400 text-sm">No tasks due on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedTasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => onEditTask(task)}
                  className="flex items-center justify-between bg-slate-700/40 hover:bg-slate-600/50 rounded-lg px-3 py-2 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${priorityDot[task.priority]}`} />
                    <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-white'}`}>
                      {task.title}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${statusBg[task.status]} text-white`}>
                      {task.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{task.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-400 pt-1">
        <span className="font-semibold text-slate-200">Priority:</span>
        {Object.entries(priorityDot).map(([p, cls]) => (
          <span key={p} className="flex items-center gap-1 capitalize">
            <span className={`w-2 h-2 rounded-full ${cls}`} />{p}
          </span>
        ))}
        <span className="ml-4 font-semibold text-slate-200">Status:</span>
        {Object.entries({ todo: 'To Do', in_progress: 'In Progress', completed: 'Completed' }).map(([s, label]) => (
          <span key={s} className={`px-2 py-0.5 rounded text-white ${statusBg[s]}`}>{label}</span>
        ))}
      </div>
    </div>
  );
}