import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2, AlertCircle, Loader2, Download } from "lucide-react";

const EXPECTED_COLUMNS = ['company_name', 'first_name', 'last_name', 'title', 'email', 'phone', 'is_primary'];

export default function ImportContactsModal({ open, onClose, onImported, existingClients, hotels = [], rentalProperties = [] }) {
  const hasHotels = hotels.length > 0;
  const hasRentals = rentalProperties.length > 0;
  const defaultType = hasHotels ? 'hotel' : 'rental';

  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [parsedRows, setParsedRows] = useState([]);
  const [results, setResults] = useState({ created: 0, updated: 0, errors: [] });
  const [dragOver, setDragOver] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedPropertyType, setSelectedPropertyType] = useState(defaultType);

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) return;
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z_]/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj = {};
          headers.forEach((h, i) => { obj[h] = values[i] || ''; });
          return obj;
        }).filter(r => r.company_name || r.first_name);
        setParsedRows(rows);
        setStep('preview');
      };
      reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
      alert('Excel files are not supported. Please export your file as CSV and re-upload.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setStep('importing');
    let created = 0, updated = 0;
    const errors = [];

    for (const row of parsedRows) {
      try {
        const companyName = row.company_name?.trim();
        if (!companyName && !row.first_name) continue;

        // Find or create client
        let client = existingClients.find(c =>
          c.company_name?.toLowerCase() === companyName?.toLowerCase()
        );

        if (!client) {
          client = await base44.entities.Client.create({
            company_name: companyName || `${row.first_name} ${row.last_name}`.trim(),
            status: 'new_lead',
            property_id: selectedPropertyId || undefined,
            property_type: selectedPropertyId ? selectedPropertyType : undefined
          });
          created++;
        } else {
          updated++;
        }

        // Create the contact under the client
        if (row.first_name) {
          await base44.entities.Contact.create({
            client_id: client.id,
            first_name: row.first_name || '',
            last_name: row.last_name || '',
            title: row.title || '',
            email: row.email || '',
            phone: row.phone || '',
            is_primary: row.is_primary === 'true' || row.is_primary === '1' || false,
            notes: row.notes || ''
          });
        }
      } catch (err) {
        errors.push(`Row error: ${row.company_name || row.first_name} — ${err.message}`);
      }
    }

    setResults({ created, updated, errors });
    setStep('done');
    onImported();
  };

  const handleClose = () => {
    setStep('upload');
    setParsedRows([]);
    setResults({ created: 0, updated: 0, errors: [] });
    setSelectedPropertyId('');
    setSelectedPropertyType(defaultType);
    onClose();
  };

  const downloadTemplate = () => {
    const header = 'company_name,first_name,last_name,title,email,phone,is_primary';
    const example = 'Acme Corp,John,Doe,Sales Manager,john@acme.com,555-1234,true';
    const blob = new Blob([header + '\n' + example], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Contacts</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-500">
              Upload a CSV or Excel file with your contacts. Contacts will be grouped under their company. If a company already exists, the contact is added to it.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <Label className="text-sm font-medium">Assign to Property (optional)</Label>
              <p className="text-xs text-slate-500">New clients created during this import will be linked to the selected property.</p>
              <div className="grid grid-cols-2 gap-2">
                {/* Only show type selector if user has access to both types */}
                {hasHotels && hasRentals ? (
                  <Select value={selectedPropertyType} onValueChange={(v) => { setSelectedPropertyType(v); setSelectedPropertyId(''); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="rental">Rental</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center px-3 py-2 rounded-md border border-input bg-muted text-sm text-muted-foreground">
                    {defaultType === 'rental' ? 'Rental Property' : 'Hotel'}
                  </div>
                )}
                <Select value={selectedPropertyId || 'none'} onValueChange={(v) => setSelectedPropertyId(v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="No property" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No property</SelectItem>
                    {(selectedPropertyType === 'hotel' ? hotels : rentalProperties).map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <button
              className="text-sm text-blue-600 underline flex items-center gap-1"
              onClick={downloadTemplate}
            >
              <Download className="w-3.5 h-3.5" /> Download CSV Template
            </button>
            <div
              className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-slate-300 hover:border-slate-400'}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('contact-file-input').click()}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-sm text-slate-600">Drag & drop a CSV or Excel file here, or click to browse</p>
              <p className="text-xs text-slate-400 mt-1">.csv supported (export Excel files as CSV first)</p>
              <input
                id="contact-file-input"
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{parsedRows.length} contacts found. Review before importing:</p>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-medium">Company</th>
                    <th className="text-left p-2 font-medium">Name</th>
                    <th className="text-left p-2 font-medium">Title</th>
                    <th className="text-left p-2 font-medium">Email</th>
                    <th className="text-left p-2 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row, i) => (
                    <tr key={i} className="border-t hover:bg-slate-50">
                      <td className="p-2">{row.company_name}</td>
                      <td className="p-2">{row.first_name} {row.last_name}</td>
                      <td className="p-2 text-slate-500">{row.title}</td>
                      <td className="p-2 text-slate-500">{row.email}</td>
                      <td className="p-2 text-slate-500">{row.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleImport} className="gap-2"><Upload className="w-4 h-4" />Import {parsedRows.length} Contacts</Button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-500" />
            <p className="text-slate-600">Importing contacts...</p>
          </div>
        )}

        {step === 'done' && (
          <div className="py-6 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              <div>
                <p className="font-medium">Import Complete</p>
                <p className="text-sm text-slate-500">{results.created} new clients created · {results.updated} existing clients updated</p>
              </div>
            </div>
            {results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium text-red-700 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {results.errors.length} errors</p>
                {results.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            )}
            <Button className="w-full" onClick={handleClose}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}