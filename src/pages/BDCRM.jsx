import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BDLeadForm from '../components/bd/BDLeadForm';
import BDLeadsTable from '../components/bd/BDLeadsTable';
import BDKPICards from '../components/bd/BDKPICards';
import BDPipelineChart from '../components/bd/BDPipelineChart';
import BDInsightsSummary from '../components/bd/BDInsightsSummary';
import BDDateFilter from '../components/bd/BDDateFilter';
import BDAnalyticsTabs from '../components/bd/BDAnalyticsTabs';
import BDTimeline from '../components/bd/BDTimeline';

export default function BDCRM() {
  const [showForm, setShowForm] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [user, setUser] = useState(null);
  const [dateFilter, setDateFilter] = useState('all');
  const [customDateRange, setCustomDateRange] = useState(null);

  const queryClient = useQueryClient();
  const location = useLocation();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // useLocation re-fires on every Link nav; window.hashchange does not.
  useEffect(() => {
    if (location.hash === '#add-lead') {
      setShowForm(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [location.hash, location.key]);

  const { data: bdLeads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ['bdLeads'],
    queryFn: () => base44.entities.BDLead.list(),
  });

  const { data: servicePricing = [] } = useQuery({
    queryKey: ['servicePricing'],
    queryFn: () => base44.entities.ServicePricing.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BDLead.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdLeads'] });
      setShowForm(false);
      setEditingLead(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BDLead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdLeads'] });
      setShowForm(false);
      setEditingLead(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BDLead.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdLeads'] });
    },
  });

  const handleSubmit = async (leadData) => {
    if (editingLead) {
      updateMutation.mutate({ id: editingLead.id, data: leadData });
    } else {
      createMutation.mutate(leadData);
    }
  };

  const handleEdit = (lead) => {
    setEditingLead(lead);
    setShowForm(true);
  };

  const handleStatusChange = async (lead, newStatus) => {
    updateMutation.mutate({
      id: lead.id,
      data: { ...lead, status: newStatus }
    });
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const filterByDate = (leads) => {
    if (dateFilter === 'all') return leads;
    if (dateFilter === 'custom' && customDateRange) {
      return leads.filter(lead => {
        if (!lead.created_date) return false;
        const leadDate = new Date(lead.created_date);
        return leadDate >= new Date(customDateRange.startDate) && leadDate <= new Date(customDateRange.endDate);
      });
    }
    const days = parseInt(dateFilter);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return leads.filter(lead => {
      if (!lead.created_date) return false;
      return new Date(lead.created_date) >= cutoffDate;
    });
  };

  const exportToCSV = () => {
    const headers = ['Hotel Name', 'Contact Person', 'Email', 'Status', 'Services', 'Created Date', 'Seller'];
    const rows = filteredLeads.map(lead => [
      lead.hotel_name,
      lead.contact_person,
      lead.contact_email || '',
      lead.status,
      (lead.services || []).join('; '),
      lead.created_date,
      lead.seller_name || ''
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bd-leads.csv';
    a.click();
  };

  const filteredLeads = filterByDate(bdLeads);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 p-6 space-y-6">
      {showForm ? (
        <BDLeadForm
          lead={editingLead}
          onSubmit={handleSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingLead(null);
          }}
          servicePricing={servicePricing}
        />
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold text-white">
                Business Development CRM
              </h1>
              <p className="text-cyan-200 mt-1 text-lg">{greeting()}, {user?.full_name || 'there'}! Track your BD pipeline and manage leads.</p>
            </div>
            <div className="flex gap-3 items-center">
              <BDDateFilter 
                value={dateFilter} 
                onChange={setDateFilter}
                onCustomDateChange={(range) => {
                  setCustomDateRange(range);
                  setDateFilter('custom');
                }}
              />
              <Button variant="outline" onClick={exportToCSV} className="bg-cyan-900/50 border-cyan-700 text-cyan-100 hover:bg-cyan-800">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => { setEditingLead(null); setShowForm(true); }} className="bg-cyan-600 hover:bg-cyan-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                Add BD Lead
              </Button>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-slate-900/50 border border-slate-800">
              <TabsTrigger value="overview" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
                Pipeline Overview
              </TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white text-slate-300">
                Analytics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <BDInsightsSummary data={filteredLeads} />
              <BDKPICards data={filteredLeads} />
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BDPipelineChart data={filteredLeads} />
              </div>

              <BDTimeline data={filteredLeads} />

              <BDLeadsTable
                data={filteredLeads}
                onEdit={handleEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onStatusChange={handleStatusChange}
              />
            </TabsContent>

            <TabsContent value="analytics">
              <BDAnalyticsTabs data={filteredLeads} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}