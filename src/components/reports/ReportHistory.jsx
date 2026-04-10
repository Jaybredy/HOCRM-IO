import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, Trash2, FileDown, FileSpreadsheet, FileText, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

const TYPE_LABELS = {
  weekly_activity: { label: "Weekly Activity", color: "bg-orange-500/20 text-orange-300 border-orange-500/30" },
  production: { label: "Production", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  seller_performance: { label: "Seller Performance", color: "bg-green-500/20 text-green-300 border-green-500/30" },
  goals: { label: "Goals", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
};

const FORMAT_ICONS = {
  csv: <FileDown className="w-3.5 h-3.5" />,
  excel: <FileSpreadsheet className="w-3.5 h-3.5" />,
  pdf: <FileText className="w-3.5 h-3.5" />,
};

export default function ReportHistory({ onReDownload }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['report_records'],
    queryFn: () => base44.entities.ReportRecord.list('-created_date', 100),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ReportRecord.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report_records'] }),
  });

  const filtered = records.filter(r =>
    r.label?.toLowerCase().includes(search.toLowerCase()) ||
    r.report_type?.toLowerCase().includes(search.toLowerCase()) ||
    r.generated_by?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-white flex items-center gap-2">
            <History className="w-5 h-5 text-blue-400" />
            Report History
          </CardTitle>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <Input
              placeholder="Search reports..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 bg-slate-700 border-slate-600 text-white text-sm h-8"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-slate-400 text-sm text-center py-6">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-8">
            {search ? 'No matching reports found.' : 'No reports generated yet. Export a report above to see it here.'}
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map(record => {
              const typeInfo = TYPE_LABELS[record.report_type] || { label: record.report_type, color: 'bg-slate-600 text-slate-300' };
              return (
                <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50 border border-slate-600/50 hover:bg-slate-700 transition-colors gap-3 cursor-pointer" onClick={() => onReDownload?.(record)}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-slate-300 shrink-0">
                      {FORMAT_ICONS[record.export_format] || <FileDown className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{record.label}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {record.date_from && record.date_to && (
                          <span className="text-slate-400 text-xs">{record.date_from} → {record.date_to}</span>
                        )}
                        {record.row_count != null && (
                          <span className="text-slate-500 text-xs">{record.row_count} rows</span>
                        )}
                        {record.generated_by && (
                          <span className="text-slate-500 text-xs">by {record.generated_by}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={`text-xs border ${typeInfo.color}`}>{typeInfo.label}</Badge>
                    <Badge variant="outline" className="text-xs text-slate-400 border-slate-600 uppercase">{record.export_format}</Badge>
                    <span className="text-slate-500 text-xs hidden md:inline">
                      {record.created_date ? format(new Date(record.created_date), 'MMM d, yyyy h:mm a') : ''}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10"
                      onClick={() => onReDownload?.(record)}
                      title="Re-download this report"
                    >
                      <FileDown className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                      onClick={() => deleteMutation.mutate(record.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}