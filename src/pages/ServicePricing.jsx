import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const SERVICE_OPTIONS = [
  { value: 'sales', label: 'Sales' },
  { value: 'revenue_management', label: 'Revenue Management' },
  { value: 'digital_marketing', label: 'Digital Marketing' },
  { value: 'tech_stack', label: 'Tech Stack' },
  { value: 'project_management', label: 'Project Management' },
  { value: 'advisory', label: 'Advisory' },
  { value: 'audit', label: 'Audit' }
];

export default function ServicePricing() {
  const queryClient = useQueryClient();
  const [expandedService, setExpandedService] = useState(null);

  const { data: pricingData = [] } = useQuery({
    queryKey: ['servicePricing'],
    queryFn: () => base44.entities.ServicePricing.list(),
  });

  const [pricing, setPricing] = useState({});
  const [descriptions, setDescriptions] = useState({});

  React.useEffect(() => {
    const priceMap = {};
    const descMap = {};
    pricingData.forEach(p => {
      priceMap[p.service_type] = p.price;
      descMap[p.service_type] = p.description || '';
    });
    setPricing(priceMap);
    setDescriptions(descMap);
  }, [pricingData]);

  const upsertMutation = useMutation({
    mutationFn: async (serviceData) => {
      const existing = pricingData.find(p => p.service_type === serviceData.service_type);
      if (existing) {
        return base44.entities.ServicePricing.update(existing.id, serviceData);
      } else {
        return base44.entities.ServicePricing.create(serviceData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicePricing'] });
      toast.success('Pricing updated successfully');
    },
  });

  const handleSaveAll = async () => {
    for (const service of SERVICE_OPTIONS) {
      await upsertMutation.mutateAsync({
        service_type: service.value,
        price: parseFloat(pricing[service.value]) || 0,
        description: descriptions[service.value] || ''
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Service Pricing</h1>
          <p className="text-gray-600 mt-1">Manage default pricing for business development services</p>
        </div>
        <Button onClick={handleSaveAll} className="bg-blue-600 hover:bg-blue-700">
          <Save className="w-4 h-4 mr-2" />
          Save All
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {SERVICE_OPTIONS.map((service) => {
              const isExpanded = expandedService === service.value;
              return (
                <div key={service.value} className="p-4 hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => setExpandedService(isExpanded ? null : service.value)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-blue-600" />
                      <span className="font-medium">{service.label}</span>
                      {pricing[service.value] && (
                        <span className="text-sm text-gray-500">
                          ${parseFloat(pricing[service.value]).toLocaleString()}
                        </span>
                      )}
                    </div>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                  
                  {isExpanded && (
                    <div className="mt-4 space-y-4 pl-8">
                      <div className="space-y-2">
                        <Label>Default Price ($)</Label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={pricing[service.value] || ''}
                          onChange={(e) => setPricing({ ...pricing, [service.value]: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Service description..."
                          value={descriptions[service.value] || ''}
                          onChange={(e) => setDescriptions({ ...descriptions, [service.value]: e.target.value })}
                          rows={2}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}