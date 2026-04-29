import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Download, X } from "lucide-react";
import { startOfYear, endOfYear } from "date-fns";
import { createPageUrl } from "@/utils";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

import KPICards from "../components/crm/KPICards";
import PipelineChart from "../components/crm/PipelineChart";
import ProductionForm from "../components/crm/ProductionForm";
import ProductionTable from "../components/crm/ProductionTable";
import FilterControls from "../components/crm/FilterControls";
import PaceComparison from "../components/crm/PaceComparison";
import UpcomingFollowUps from "../components/crm/UpcomingFollowUps";
import RevenueTrendChart from "../components/crm/RevenueTrendChart";
import ReportUpload from "../components/crm/ReportUpload";

import ActivityLogForm from "../components/crm/ActivityLogForm";
import ActualResultsManager from "../components/crm/ActualResultsManager";
import ConversionFunnel from "../components/reports/ConversionFunnel";
import PipelineValueChart from "../components/reports/PipelineValueChart";
import DealSizeMetrics from "../components/reports/DealSizeMetrics";
import SellerPerformanceTable from "../components/reports/SellerPerformanceTable";
import HotelPerformanceChart from "../components/analytics/HotelPerformanceChart";
import LeadSourceEffectiveness from "../components/analytics/LeadSourceEffectiveness";
import ChurnPrediction from "../components/analytics/ChurnPrediction";
import ForecastAccuracy from "../components/analytics/ForecastAccuracy";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StaleLeadsAlert from "../components/crm/StaleLeadsAlert";
import SidebarPanel from "../components/crm/SidebarPanel";
import TodaySnapshot from "../components/crm/TodaySnapshot";
import CateringEventForm from "../components/crm/CateringEventForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function CRM() {
  const [showForm, setShowForm] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showUploadReport, setShowUploadReport] = useState(false);
  const [showCateringForm, setShowCateringForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [returnToPage, setReturnToPage] = useState(null);
  const [returnToClientId, setReturnToClientId] = useState(null);
  const [selectedHotel, setSelectedHotel] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [dateRange, setDateRange] = useState({
    start: '2020-01-01',
    end: '2030-12-31'
  });
  const [paceView, setPaceView] = useState('budget');
  const [selectedSeller, setSelectedSeller] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('definite');
  const [selectedEventType, setSelectedEventType] = useState('');
  const [searchText, setSearchText] = useState('');
  const [user, setUser] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});

    // Check the URL hash and open the matching form. Runs on initial mount
    // AND on every hashchange so sidebar Hotels -> Add Booking works even
    // when already on /CRM (no remount = the previous useEffect never re-ran).
    // Always close all dialogs first so two clicks in a row don't stack
    // modals (previously: clicking Add Booking then Add Catering left
    // both open).
    const handleHash = () => {
      const hash = window.location.hash;
      const targets = {
        '#add-production': setShowForm,
        '#add-activity': setShowActivityLog,
        '#upload-report': setShowUploadReport,
        '#add-catering': setShowCateringForm,
      };
      if (!(hash in targets)) return;
      // Close all, then open the targeted one. Avoids modal stacking.
      setShowForm(false);
      setShowActivityLog(false);
      setShowUploadReport(false);
      setShowCateringForm(false);
      targets[hash](true);
      window.history.replaceState(null, '', window.location.pathname);
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);

    // Support ?edit=<id> to open a specific item for editing
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    const returnTo = urlParams.get('returnTo');
    const clientId = urlParams.get('clientId');
    if (returnTo) setReturnToPage(returnTo);
    if (clientId) setReturnToClientId(clientId);
    if (editId) {
      base44.entities.ProductionItem.list().then(items => {
        const item = items.find(i => i.id === editId);
        if (item) {
          setEditItem(item);
          setShowForm(true);
        }
      });
      window.history.replaceState(null, '', window.location.pathname);
    }

    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: allProduction = [] } = useQuery({
    queryKey: ['production'],
    queryFn: () => base44.entities.ProductionItem.list('-created_date')
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.list()
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductionItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['production'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProductionItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['production'] })
  });

  const sellers = [...new Set(allProduction.map(p => p.seller_name).filter(Boolean))];

  // Base filter: hotel sales only, exclude actual_pickup
  const baseFiltered = allProduction.filter((item) => {
    if ((item.seller_type || 'hotel_sales') !== 'hotel_sales') return false;
    if (item.record_type === 'actual_pickup') return false;
    return true;
  });

  // Dashboard data: always definite record_type (matches GRC definition), fallback to status if not set
  // Only apply hotel, year, and date range filters (ignore seller, event type, search filters)
  const dashboardProduction = baseFiltered.filter((item) => {
    if (selectedHotel !== 'all' && item.hotel_id !== selectedHotel) return false;
    const arrYear = item.arrival_date ? new Date(item.arrival_date).getFullYear() : null;
    if (arrYear && arrYear !== selectedYear) return false;
    if (item.arrival_date && (item.arrival_date < dateRange.start || item.arrival_date > dateRange.end)) return false;
    return true;
  });

  // Table data: respects user-selected status filter
  const filteredProduction = baseFiltered.filter((item) => {
    if (selectedHotel !== 'all' && item.hotel_id !== selectedHotel) return false;
    // Use activity_date for date range filtering (when booking was logged/confirmed)
    const filterDate = item.activity_date || item.arrival_date;
    if (filterDate && (filterDate < dateRange.start || filterDate > dateRange.end)) return false;
    if (selectedSeller && item.seller_name !== selectedSeller) return false;
    if (selectedStatus && item.status !== selectedStatus) return false;
    if (selectedEventType && item.event_type !== selectedEventType) return false;
    if (searchText && !item.client_name?.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const filteredBudgets = budgets.filter((budget) => {
    if (selectedHotel !== 'all' && budget.hotel_id !== selectedHotel) return false;
    if (budget.year !== selectedYear) return false;
    return true;
  });

  const handleStatusChange = (item, newStatus) => {
    updateMutation.mutate({
      id: item.id,
      data: { ...item, status: newStatus }
    });
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (item) => {
    setEditItem(item);
    setShowForm(true);
  };

  const handleFormSuccess = () => {
    const currentEditItem = editItem;
    setShowForm(false);
    setEditItem(null);
    queryClient.invalidateQueries({ queryKey: ['production'] });
    if (returnToPage) {
      let url = createPageUrl(returnToPage);
      if (returnToPage === 'ClientProfile') {
        const cid = returnToClientId || currentEditItem?.client_id;
        if (cid) url += `?id=${cid}`;
      }
      window.location.href = url;
    }
  };

  const handleCardClick = (card) => {
    setDrilldownData({
      title: card.title,
      items: card.items,
      filterKey: card.filterKey
    });
  };

  const exportToCSV = () => {
    const headers = ['Hotel', 'Client', 'Status', 'Arrival', 'Departure', 'Room Nights', 'Revenue', 'ADR', 'Seller', 'Activity Date'];
    const rows = filteredProduction.map((item) => {
      const hotel = hotels.find((h) => h.id === item.hotel_id);
      const adr = item.room_nights > 0 ? (item.revenue / item.room_nights).toFixed(2) : '0';
      return [
      hotel?.name || '',
      item.client_name,
      item.status,
      item.arrival_date,
      item.departure_date,
      item.room_nights,
      item.revenue,
      adr,
      item.seller_name || '',
      item.activity_date];

    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `production-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="bg-gradient-to-br text-slate-100 p-4 min-h-screen from-slate-900 via-blue-950 to-slate-900 md:p-6">
      {/* Catering Event Modal */}
      <Dialog open={showCateringForm} onOpenChange={open => setShowCateringForm(open)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border-orange-200 text-gray-900 p-0">
          <CateringEventForm
            onSuccess={() => setShowCateringForm(false)}
            onCancel={() => setShowCateringForm(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Activity Log Modal (when triggered via nav) */}
      <Dialog open={showActivityLog && !showForm} onOpenChange={open => setShowActivityLog(open)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <ActivityLogForm
            onSuccess={() => {
              setShowActivityLog(false);
              queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
            }}
            onCancel={() => setShowActivityLog(false)}
          />
        </DialogContent>
      </Dialog>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Show Form Only When Active */}
        {showForm ?
        <ProductionForm
          hotels={hotels}
          onSuccess={handleFormSuccess}
          onCancel={() => {setShowForm(false);setEditItem(null);}}
          editItem={editItem} /> :

        showUploadReport ?
        <div>
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold text-white">Upload Report</h1>
              <Button variant="outline" onClick={() => setShowUploadReport(false)} className="border-slate-600 text-white hover:bg-slate-700">
                <X className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
            <ReportUpload hotels={hotels} onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['production'] });
            setShowUploadReport(false);
          }} />
          </div> :

        <>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  {getGreeting()}{user ? `, ${user.display_name || user.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'there'}` : ''}!
                </h1>
                <p className="text-slate-400 mt-1">Track production and manage your sales pipeline</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-900/30">
                  <Plus className="w-4 h-4" />
                  Add Booking
                </Button>
                <Button variant="outline" onClick={exportToCSV} className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white bg-transparent">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>

              </div>
            </div>

            {/* Filters - Sticky */}
            <div className="sticky top-0 z-40 mb-6 -mx-4 -mt-6 px-4 pt-4 pb-2 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
            <FilterControls
              selectedHotel={selectedHotel}
              setSelectedHotel={setSelectedHotel}
              hotels={hotels}
              dateRange={dateRange}
              setDateRange={setDateRange}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              selectedSeller={selectedSeller}
              setSelectedSeller={setSelectedSeller}
              sellers={sellers}
              selectedStatus={selectedStatus}
              setSelectedStatus={setSelectedStatus}
              selectedEventType={selectedEventType}
              setSelectedEventType={setSelectedEventType}
              searchText={searchText}
              setSearchText={setSearchText}
            />
            </div>


            {/* Stale Leads Alert - moved to top for visibility */}
            <StaleLeadsAlert data={filteredProduction} onEdit={handleEdit} />

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-slate-700 p-1 rounded-xl h-12">
                <TabsTrigger value="overview" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-blue-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-900/40 data-[state=active]:font-semibold text-slate-400 rounded-lg text-sm transition-all">
                  Pipeline Overview
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-900/40 data-[state=active]:font-semibold text-slate-400 rounded-lg text-sm transition-all">
                  Analytics Dashboard
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6 mt-6">
                {/* Today's Snapshot */}
                <TodaySnapshot
                  data={filteredProduction}
                  onDrillDown={(items) => {
                    setDrilldownData({
                      title: 'MTD Breakdown',
                      items,
                      filterKey: 'revenue'
                    });
                  }}
                />

                {/* KPIs */}
                <KPICards 
                  data={filteredProduction} 
                  onCardClick={handleCardClick}
                  onCutoffAlertClick={() => {
                    setSelectedStatus('definite');
                    const today = new Date().toISOString().split('T')[0];
                    const sevensFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                    setDrilldownData({
                      title: '7-Day Cutoff Alerts (Definite Bookings)',
                      items: allProduction.filter(i => {
                        if (i.status !== 'definite' || !i.cutoff_date) return false;
                        const diff = (new Date(i.cutoff_date) - new Date(today)) / (1000 * 60 * 60 * 24);
                        return diff >= 0 && diff <= 7;
                      }),
                      filterKey: 'revenue'
                    });
                  }}
                />

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PipelineChart key={`pipeline-${selectedHotel}-${dateRange.start}-${dateRange.end}`} data={filteredProduction} />
                  <RevenueTrendChart data={filteredProduction} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <PaceComparison
                    key={`pace-${selectedHotel}-${dateRange.start}-${dateRange.end}`}
                    productionData={filteredProduction}
                    budgetData={filteredBudgets}
                    paceView={paceView}
                    setPaceView={setPaceView} />
                  <UpcomingFollowUps data={filteredProduction} onEdit={handleEdit} />
                </div>

                {/* Drilldown Modal */}
                {drilldownData && (
                  <Dialog open={!!drilldownData} onOpenChange={() => setDrilldownData(null)}>
                    <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700 text-slate-100">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-bold text-white">
                          {drilldownData.title} - Breakdown
                        </DialogTitle>
                        <p className="text-slate-400 text-sm">
                          Showing {drilldownData.items.length} definite booking{drilldownData.items.length !== 1 ? 's' : ''}
                        </p>
                      </DialogHeader>
                      <div className="overflow-y-auto max-h-[70vh] mt-4">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-slate-800 border-b border-slate-700">
                            <tr>
                              <th className="text-left p-3 font-semibold text-slate-300">Client</th>
                              <th className="text-left p-3 font-semibold text-slate-300">Arrival</th>
                              <th className="text-left p-3 font-semibold text-slate-300">Departure</th>
                              <th className="text-right p-3 font-semibold text-slate-300">Room Nights</th>
                              <th className="text-right p-3 font-semibold text-slate-300">Revenue</th>
                              <th className="text-right p-3 font-semibold text-slate-300">ADR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {drilldownData.items
                              .sort((a, b) => (b[drilldownData.filterKey === 'adr' ? 'revenue' : drilldownData.filterKey] || 0) - (a[drilldownData.filterKey === 'adr' ? 'revenue' : drilldownData.filterKey] || 0))
                              .map((item, idx) => {
                                const adr = item.room_nights > 0 ? item.revenue / item.room_nights : 0;
                                return (
                                  <tr 
                                    key={item.id || idx} 
                                    className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer transition-colors"
                                    onClick={() => {
                                      setDrilldownData(null);
                                      handleEdit(item);
                                    }}
                                  >
                                    <td className="p-3 text-white font-medium">{item.client_name}</td>
                                    <td className="p-3 text-slate-300">{item.arrival_date || '-'}</td>
                                    <td className="p-3 text-slate-300">{item.departure_date || '-'}</td>
                                    <td className="p-3 text-right text-blue-300 font-semibold">{(item.room_nights || 0).toLocaleString()}</td>
                                    <td className="p-3 text-right text-emerald-300 font-semibold">${(item.revenue || 0).toLocaleString()}</td>
                                    <td className="p-3 text-right text-purple-300 font-semibold">${adr.toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}

                {/* Production Table + Tasks Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <ProductionTable
                      data={filteredProduction}
                      hotels={hotels}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onStatusChange={handleStatusChange}
                    />
                  </div>
                  <div className="h-full">
                    <SidebarPanel />
                  </div>
                </div>



                {/* Actual Results Manager */}
                <ActualResultsManager hotels={hotels} />


              </TabsContent>

              <TabsContent value="analytics" className="space-y-6 mt-6">
                {/* Row 1: Hotel Performance + Lead Source */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <HotelPerformanceChart production={filteredProduction} hotels={hotels} />
                  <LeadSourceEffectiveness production={filteredProduction} />
                </div>

                {/* Row 2: Churn Prediction + Forecast Accuracy */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ChurnPrediction production={filteredProduction} />
                  <ForecastAccuracy production={filteredProduction} budgets={filteredBudgets} />
                </div>

                {/* Row 3: Existing analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ConversionFunnel production={filteredProduction} />
                  <PipelineValueChart production={filteredProduction} hotelId={selectedHotel} dateRange={dateRange} />
                </div>
                <DealSizeMetrics production={filteredProduction} />
                <SellerPerformanceTable production={filteredProduction} />
              </TabsContent>
            </Tabs>
          </>
        }
      </div>
    </div>);

}