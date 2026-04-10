import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, Settings } from "lucide-react";

const PREFS_KEY = 'task_notification_prefs';

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { onDueDate: true, oneDayBefore: true, threeDaysBefore: false, onOverdue: true };
}

export default function NotificationPreferences() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState(loadPrefs());

  const save = () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    setOpen(false);
  };

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700">
          <Bell className="w-4 h-4 mr-2" />
          Reminder Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" />
            Email Reminder Preferences
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500">Choose when to receive email reminders for your tasks. Reminders are sent to the email of the assigned user.</p>
        <div className="space-y-4 mt-2">
          {[
            { key: 'threeDaysBefore', label: '3 days before due date', desc: 'Get an early heads-up' },
            { key: 'oneDayBefore', label: '1 day before due date', desc: 'Reminder the day before' },
            { key: 'onDueDate', label: 'On the due date', desc: 'Reminder on the day itself' },
            { key: 'onOverdue', label: 'When overdue', desc: 'Alert when task is past due' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-sm">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <Switch checked={!!prefs[key]} onCheckedChange={() => toggle(key)} />
            </div>
          ))}
        </div>
        <Button onClick={save} className="w-full mt-2">Save Preferences</Button>
      </DialogContent>
    </Dialog>
  );
}