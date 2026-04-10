import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Bell, FileText, Send, CheckCircle2, Clock } from 'lucide-react';
import RenewalProposalForm from '../components/rentals/RenewalProposalForm';
import RenewalStatusBadge from '../components/rentals/RenewalStatusBadge';

export default function LeaseRenewals() {
  const [user, setUser] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [selectedRenewal, setSelectedRenewal] = useState(null);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const [reminderDaysBeforeExpiry, setReminderDaysBeforeExpiry] = useState(60);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Fetch hotels
  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels-renewals'],
    queryFn: async () => {
      const allHotels = await base44.entities.Hotel.list();
      return user ? allHotels.filter(h => h.created_by === user.email) : [];
    },
    enabled: !!user
  });

  // Fetch units
  const { data: units = [] } = useQuery({
    queryKey: ['units-renewals', hotels],
    queryFn: async () => {
      const allUnits = await base44.entities.Unit.list();
      const hotelIds = hotels.map(h => h.id);
      return allUnits.filter(u => hotelIds.includes(u.hotel_id));
    },
    enabled: hotels.length > 0
  });

  // Fetch lease renewals
  const { data: renewals = [] } = useQuery({
    queryKey: ['lease-renewals'],
    queryFn: () => base44.entities.LeaseRenewal.list(),
  });

  // Fetch clients for tenant info
  const { data: clients = [] } = useQuery({
    queryKey: ['clients-renewals'],
    queryFn: () => base44.entities.Client.list(),
  });

  // Create/Update renewal mutation
  const renewalMutation = useMutation({
    mutationFn: async (data) => {
      if (selectedRenewal?.id) {
        return base44.entities.LeaseRenewal.update(selectedRenewal.id, data);
      } else {
        return base44.entities.LeaseRenewal.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lease-renewals'] });
      setShowProposalForm(false);
      setSelectedRenewal(null);
    }
  });

  // Send email mutation
  const emailMutation = useMutation({
    mutationFn: async ({ renewal, subject, body }) => {
      if (renewal.tenant_email) {
        await base44.integrations.Core.SendEmail({
          to: renewal.tenant_email,
          subject: subject,
          body: body
        });
        // Update renewal status
        await base44.entities.LeaseRenewal.update(renewal.id, {
          renewal_status: 'sent',
          proposal_sent_date: new Date().toISOString().split('T')[0]
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lease-renewals'] });
    }
  });

  // Auto-send reminders
  const sendAutoReminders = async () => {
    setIsLoadingReminders(true);
    try {
      const today = new Date();
      const thresholdDate = new Date(today.getTime() + reminderDaysBeforeExpiry * 24 * 60 * 60 * 1000);

      const unitsNeedingRenewal = units.filter(u => {
        const leaseEndDate = new Date(u.lease_end_date);
        const hasRenewal = renewals.find(r => r.unit_id === u.id && r.renewal_status !== 'rejected');
        return leaseEndDate <= thresholdDate && leaseEndDate >= today && !hasRenewal;
      });

      for (const unit of unitsNeedingRenewal) {
        const client = clients.find(c => c.id === unit.current_resident_id);
        if (client && client.email) {
          const subject = `Lease Renewal Reminder - Unit ${unit.unit_number}`;
          const body = `Dear ${client.company_name},\n\nThis is a reminder that your lease for Unit ${unit.unit_number} expires on ${unit.lease_end_date}.\n\nPlease contact us soon to discuss renewal options.\n\nBest regards,\nProperty Management`;

          const newRenewal = await base44.entities.LeaseRenewal.create({
            unit_id: unit.id,
            tenant_name: client.company_name,
            tenant_email: client.email,
            current_lease_end_date: unit.lease_end_date,
            current_monthly_rent: unit.monthly_rent,
            renewal_status: 'sent',
            auto_reminder_sent: true,
            reminder_sent_date: new Date().toISOString().split('T')[0]
          });

          await base44.integrations.Core.SendEmail({
            to: client.email,
            subject: subject,
            body: body
          });
        }
      }

      setShowReminderDialog(false);
      queryClient.invalidateQueries({ queryKey: ['lease-renewals'] });
    } finally {
      setIsLoadingReminders(false);
    }
  };

  const handleGenerateProposal = async (formData) => {
    try {
      const renewalData = {
        unit_id: selectedRenewal.unit_id,
        tenant_name: selectedRenewal.tenant_name,
        tenant_email: selectedRenewal.tenant_email,
        current_lease_end_date: selectedRenewal.current_lease_end_date,
        current_monthly_rent: selectedRenewal.current_monthly_rent,
        ...formData,
        renewal_status: 'sent',
        proposal_sent_date: new Date().toISOString().split('T')[0]
      };

      await renewalMutation.mutateAsync(renewalData);

      // Send proposal email
      const proposalBody = `Dear ${selectedRenewal.tenant_name},\n\nWe are pleased to offer you a renewal of your lease. Please review the proposed terms below:\n\nCurrent Rent: $${selectedRenewal.current_monthly_rent}/month\nProposed Rent: $${formData.proposed_monthly_rent}/month\nNew Lease Period: ${formData.proposed_lease_start_date} to ${formData.proposed_lease_end_date}\n\nAdditional Notes:\n${formData.renewal_notes}\n\nPlease reply to confirm your acceptance of these terms.\n\nBest regards,\nProperty Management`;

      await emailMutation.mutateAsync({
        renewal: renewalData,
        subject: `Lease Renewal Proposal - Unit`,
        body: proposalBody
      });
    } catch (error) {
      console.error('Error generating proposal:', error);
    }
  };

  // Identify units with upcoming expiries
  const upcomingExpiringUnits = units.filter(u => {
    const leaseEnd = new Date(u.lease_end_date);
    const daysUntilExpiry = Math.ceil((leaseEnd - new Date()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry > 0 && daysUntilExpiry <= 90 && !renewals.find(r => r.unit_id === u.id && r.renewal_status !== 'rejected');
  });

  const filteredRenewals = renewals.filter(r =>
    r.tenant_name?.toLowerCase().includes(searchText.toLowerCase()) ||
    searchText.toLowerCase().includes(r.renewal_status)
  );

  const firstName = user?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Lease Renewals</h1>
            <p className="text-slate-400 text-sm mt-0.5">Manage tenant lease renewals and proposals</p>
          </div>
          <Button onClick={() => setShowReminderDialog(true)} className="bg-blue-600 hover:bg-blue-700">
            <Bell className="w-4 h-4 mr-2" />
            Send Auto Reminders
          </Button>
        </div>

        {/* Alerts */}
        {upcomingExpiringUnits.length > 0 && (
          <Card className="bg-amber-600/10 border-amber-700/50">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-200 font-semibold">{upcomingExpiringUnits.length} leases expiring within 90 days</p>
                <p className="text-amber-300/80 text-sm">Click "Send Auto Reminders" to initiate renewal process</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Pending Renewals</p>
              <p className="text-2xl font-bold text-white">{renewals.filter(r => r.renewal_status === 'pending').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Proposals Sent</p>
              <p className="text-2xl font-bold text-blue-400">{renewals.filter(r => r.renewal_status === 'sent').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Accepted</p>
              <p className="text-2xl font-bold text-green-400">{renewals.filter(r => r.renewal_status === 'accepted').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-4">
              <p className="text-slate-400 text-sm">Rejected</p>
              <p className="text-2xl font-bold text-red-400">{renewals.filter(r => r.renewal_status === 'rejected').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="space-y-2">
          <Label className="text-slate-300">Search Renewals</Label>
          <Input
            placeholder="Search by tenant name or status..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>

        {/* Renewals Table */}
        <Card className="bg-slate-800/60 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Renewal Proposals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredRenewals.length === 0 ? (
                <p className="text-slate-400 text-center py-4">No renewals found</p>
              ) : (
                filteredRenewals.map(renewal => (
                  <div key={renewal.id} className="border border-slate-700 rounded-lg p-4 bg-slate-900/50">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-white font-semibold">{renewal.tenant_name}</h3>
                          <RenewalStatusBadge status={renewal.renewal_status} />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-slate-400">Current Lease Ends</p>
                            <p className="text-white">{renewal.current_lease_end_date}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Current Rent</p>
                            <p className="text-white">${renewal.current_monthly_rent}</p>
                          </div>
                          {renewal.proposed_monthly_rent && (
                            <div>
                              <p className="text-slate-400">Proposed Rent</p>
                              <p className="text-white">${renewal.proposed_monthly_rent}</p>
                            </div>
                          )}
                          {renewal.proposal_sent_date && (
                            <div>
                              <p className="text-slate-400">Sent Date</p>
                              <p className="text-white">{renewal.proposal_sent_date}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {renewal.renewal_status === 'pending' && (
                          <Button
                            onClick={() => {
                              setSelectedRenewal(renewal);
                              setShowProposalForm(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Generate Proposal
                          </Button>
                        )}
                        {renewal.renewal_status === 'sent' && (
                          <Button variant="outline" className="border-slate-600 text-slate-300">
                            <Send className="w-4 h-4 mr-2" />
                            Resend
                          </Button>
                        )}
                        {renewal.renewal_status === 'accepted' && (
                          <Button variant="outline" className="border-green-600/50 text-green-300">
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Accepted
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Proposal Form Dialog */}
        {showProposalForm && selectedRenewal && (
          <RenewalProposalForm
            renewal={selectedRenewal}
            onSubmit={handleGenerateProposal}
            onClose={() => setShowProposalForm(false)}
            isLoading={renewalMutation.isPending || emailMutation.isPending}
          />
        )}

        {/* Auto Reminder Dialog */}
        <Dialog open={showReminderDialog} onOpenChange={setShowReminderDialog}>
          <DialogContent className="bg-slate-900 border-slate-700">
            <DialogHeader>
              <DialogTitle className="text-white">Send Automated Renewal Reminders</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-slate-300 text-sm">
                Send renewal reminders to tenants with leases expiring within:
              </p>
              <div className="space-y-2">
                <Label className="text-slate-300">Days Before Expiry</Label>
                <Input
                  type="number"
                  value={reminderDaysBeforeExpiry}
                  onChange={(e) => setReminderDaysBeforeExpiry(parseInt(e.target.value))}
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
              <div className="bg-blue-900/20 border border-blue-700/30 rounded p-3">
                <p className="text-blue-300 text-sm">
                  This will automatically create renewal records and send reminder emails to tenants with upcoming lease expirations.
                </p>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowReminderDialog(false)} className="border-slate-600">
                Cancel
              </Button>
              <Button
                onClick={sendAutoReminders}
                disabled={isLoadingReminders}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoadingReminders ? 'Sending...' : 'Send Reminders'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}