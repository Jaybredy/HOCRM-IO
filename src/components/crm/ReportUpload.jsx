import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function ReportUpload({ hotels, selectedHotelId, onSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);

    try {
      // Step 1: Upload the file to get a URL
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Step 2: Call the GRC-specific import function
      const response = await base44.functions.invoke('import-uma-grc-xlsx', { file_url, hotel_id: selectedHotelId });
      const data = response.data;

      if (data?.success) {
        setResult(data);
        setFile(null);
        if (onSuccess) onSuccess();
      } else {
        setError(data?.error || 'Import failed. Please check the file format.');
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5" />
          Import GRC Excel
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Upload your GRC Excel workbook. Each sheet (Jan, Feb, etc.) will be parsed automatically — Definites, Tentatives, Prospects, and Actuals sections are all supported.
          </p>
          <div className="flex gap-2">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(null); }}
              disabled={uploading}
            />
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
              ) : (
                <><Upload className="w-4 h-4 mr-2" />Import</>
              )}
            </Button>
          </div>

          {result && (
            <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-semibold">Import successful!</div>
                <div>Created: {result.created} &nbsp;|&nbsp; Updated: {result.updated}</div>
                {result.counts_by_record_type && (
                  <div className="text-xs mt-1 text-green-700">
                    Definites: {result.counts_by_record_type.definite} &nbsp;|&nbsp;
                    Tentatives: {result.counts_by_record_type.tentative} &nbsp;|&nbsp;
                    Prospects: {result.counts_by_record_type.prospect} &nbsp;|&nbsp;
                    Actuals: {result.counts_by_record_type.actual_pickup}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div><div className="font-semibold">Import failed</div><div>{error}</div></div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}