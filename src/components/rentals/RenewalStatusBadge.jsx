import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Clock, Send, Eye, CheckCircle2, XCircle, Zap } from 'lucide-react';

const statusConfig = {
  pending: { bg: 'bg-slate-600/30', text: 'text-slate-300', icon: Clock, label: 'Pending' },
  sent: { bg: 'bg-blue-600/30', text: 'text-blue-300', icon: Send, label: 'Sent' },
  viewed: { bg: 'bg-amber-600/30', text: 'text-amber-300', icon: Eye, label: 'Viewed' },
  accepted: { bg: 'bg-green-600/30', text: 'text-green-300', icon: CheckCircle2, label: 'Accepted' },
  rejected: { bg: 'bg-red-600/30', text: 'text-red-300', icon: XCircle, label: 'Rejected' },
  completed: { bg: 'bg-emerald-600/30', text: 'text-emerald-300', icon: Zap, label: 'Completed' }
};

export default function RenewalStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge className={`${config.bg} ${config.text} border-0 flex items-center gap-1 w-fit`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}