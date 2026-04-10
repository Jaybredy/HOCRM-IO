import React from 'react';
import { Phone, Send, RotateCcw, FileText, Star, Eye } from 'lucide-react';

const NEXT_ACTIONS = {
  new_lead:         { label: 'Schedule Call',    icon: Phone,      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  reached_out:      { label: 'Follow Up',        icon: RotateCcw,  color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  solicitation_call:{ label: 'Send Proposal',    icon: Send,       color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  sent_proposal:    { label: 'Follow Up',        icon: RotateCcw,  color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  follow_up:        { label: 'Close / Decide',   icon: Star,       color: 'text-pink-400 bg-pink-500/10 border-pink-500/30' },
  prospect:         { label: 'Send Contract',    icon: FileText,   color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' },
  tentative:        { label: 'Confirm Definite', icon: FileText,   color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  definite:         { label: 'Monitor & Upsell', icon: Eye,        color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  active:           { label: 'Nurture',          icon: Star,       color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  vip:              { label: 'VIP Care',         icon: Star,       color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  lost:             { label: 'Re-engage',        icon: RotateCcw,  color: 'text-red-400 bg-red-500/10 border-red-500/30' },
  inactive:         { label: 'Re-activate',      icon: RotateCcw,  color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
};

export default function NextActionBadge({ status }) {
  const action = NEXT_ACTIONS[status];
  if (!action) return null;
  const Icon = action.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${action.color}`}>
      <Icon className="w-3 h-3" />
      {action.label}
    </span>
  );
}