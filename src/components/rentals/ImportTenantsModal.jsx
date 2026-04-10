import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, CheckCircle2, AlertCircle, FileText } from 'lucide-react';

export default function ImportTenantsModal({ open, onClose, onImported, hotels }) {
  const [step, setStep] = useState('upload'); // upload, preview, importing, complete
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    parseFile(selectedFile);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseFile(droppedFile);
    }
  };

  const parseFile = async (file) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      }).filter(row => Object.values(row).some(v => v));

      setPreview(data.slice(0, 5));
      setStep('preview');
    } catch (err) {
      alert('Error parsing file. Please ensure it\'s a valid CSV file.');
    }
  };

  const handleImport = async () => {
    setLoading(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(l => l.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
          row[header] = values[idx] || '';
        });
        return row;
      }).filter(row => Object.values(row).some(v => v));

      let imported = 0;
      let failed = 0;

      for (const row of data) {
        const hotelId = row.hotel_id || row['hotel'] || row['property'] || (hotels.length > 0 ? hotels[0].id : '');
        
        const unitData = {
          hotel_id: hotelId,
          unit_number: row.unit_number || row['unit'] || row['unit #'] || '',
          unit_type: row.unit_type || row['type'] || 'studio',
          status: row.status || 'rented',
          monthly_rent: parseFloat(row.monthly_rent || row['rent'] || 0) || 0,
          current_resident_id: row.current_resident_id || row['resident'] || '',
          lease_start_date: row.lease_start_date || row['start date'] || '',
          lease_end_date: row.lease_end_date || row['end date'] || '',
          notes: row.notes || ''
        };

        if (unitData.unit_number && unitData.hotel_id) {
          await base44.entities.Unit.create(unitData);
          imported++;
        } else {
          failed++;
        }
      }

      setResult({ imported, failed, total: data.length });
      setStep('complete');
      onImported();
    } catch (err) {
      console.error('Import error:', err);
      alert('Error importing tenants. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = 'hotel_id,unit_number,unit_type,status,monthly_rent,current_resident_id,lease_start_date,lease_end_date,notes';
    const example = 'hotel123,A101,1-bedroom,rented,2500,resident123,2024-01-01,2025-01-01,"Nice unit"';
    const csv = headers + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tenant_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        setStep('upload');
        setFile(null);
        setPreview([]);
        setResult(null);
      }
      onClose();
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Tenants</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() => document.getElementById('file-input').click()}
            >
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">Drop CSV file here or click to browse</p>
              <p className="text-xs text-slate-500 mt-1">Expected columns: hotel_id, unit_number, unit_type, status, monthly_rent, etc.</p>
            </div>
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
              <FileText className="w-4 h-4 mr-2" /> Download CSV Template
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              <p className="font-medium mb-2">Preview (showing first {preview.length} rows)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-200 rounded">
                  <thead className="bg-slate-100">
                    <tr>
                      {Object.keys(preview[0] || {}).map(key => (
                        <th key={key} className="px-2 py-1 text-left font-semibold border-r">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 border-t">
                        {Object.values(row).map((val, idx) => (
                          <td key={idx} className="px-2 py-1 border-r">{val}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleImport} disabled={loading} className="flex-1">
                {loading ? 'Importing...' : 'Import All Tenants'}
              </Button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <div>
              <p className="text-lg font-semibold text-slate-800">Import Complete</p>
              <p className="text-sm text-slate-600 mt-2">
                {result.imported} tenants imported successfully
                {result.failed > 0 && <span>, {result.failed} failed</span>}
              </p>
            </div>
            <Button onClick={() => {
              setStep('upload');
              setFile(null);
              setPreview([]);
              setResult(null);
              onClose();
            }} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}