import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import BDLeadForm from '../components/bd/BDLeadForm';
import { toast } from 'sonner';

export default function BDAddLead() {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: servicePricing = [] } = useQuery({
    queryKey: ['servicePricing'],
    queryFn: () => base44.entities.ServicePricing.list(),
  });

  const createMutation = useMutation({
    mutationFn: (leadData) => base44.entities.BDLead.create(leadData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdLeads'] });
      toast.success('BD Lead created successfully');
      window.location.href = createPageUrl('BusinessDevelopment');
    },
  });

  const handleSubmit = (leadData) => {
    // Pre-fill seller name if not provided
    const finalData = {
      ...leadData,
      seller_name: leadData.seller_name || user?.full_name || ''
    };
    createMutation.mutate(finalData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link to={createPageUrl('BusinessDevelopment')}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
            <Plus className="w-8 h-8 text-[#00a3e0]" />
            Add New BD Lead
          </h1>
          <p className="text-slate-400 mt-1">Create a new business development opportunity</p>
        </div>
      </div>

      {/* Quick Tips */}
      <Card className="bg-[#00a3e0]/10 border-[#00a3e0]/30 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-semibold text-[#00a3e0]">💡 Tip:</span>
              <p className="text-slate-300 mt-1">Select multiple services to create a comprehensive proposal</p>
            </div>
            <div>
              <span className="font-semibold text-[#00a3e0]">💰 Pricing:</span>
              <p className="text-slate-300 mt-1">Default prices are shown - customize per lead as needed</p>
            </div>
            <div>
              <span className="font-semibold text-[#00a3e0]">📊 Status:</span>
              <p className="text-slate-300 mt-1">Start with "Reached Out" and update as you progress</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <BDLeadForm
        servicePricing={servicePricing}
        onSubmit={handleSubmit}
        onCancel={() => window.location.href = createPageUrl('BusinessDevelopment')}
      />
    </div>
  );
}