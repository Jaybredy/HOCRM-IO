import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, Save, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function ServicePricingManager() {
  const queryClient = useQueryClient();
  const [expandedService, setExpandedService] = useState(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDesc, setNewServiceDesc] = useState('');

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

  const createMutation = useMutation({
    mutationFn: (serviceData) => base44.entities.ServicePricing.create(serviceData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicePricing'] });
      toast.success('Service added successfully');
      setShowAddDialog(false);
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDesc('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ServicePricing.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicePricing'] });
      toast.success('Service updated successfully');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServicePricing.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servicePricing'] });
      toast.success('Service deleted successfully');
    },
  });

  const handleAddService = () => {
    if (!newServiceName || !newServicePrice) {
      toast.error('Please fill in service name and price');
      return;
    }
    createMutation.mutate({
      service_type: newServiceName.toLowerCase().replace(/\s+/g, '_'),
      price: parseFloat(newServicePrice),
      description: newServiceDesc
    });
  };

  const handleSave = (service) => {
    updateMutation.mutate({
      id: service.id,
      data: {
        service_type: service.service_type,
        price: parseFloat(pricing[service.service_type]) || 0,
        description: descriptions[service.service_type] || ''
      }
    });
  };

  const handleDelete = (service) => {
    if (confirm(`Delete ${service.service_type}?`)) {
      deleteMutation.mutate(service.id);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Service Pricing Configuration</CardTitle>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-[#00a3e0] hover:bg-[#0088c0]">
                <Plus className="w-4 h-4 mr-2" />
                Add Service
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Service</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Service Name *</Label>
                  <Input
                    placeholder="e.g., Consulting"
                    value={newServiceName}
                    onChange={(e) => setNewServiceName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Price ($) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newServicePrice}
                    onChange={(e) => setNewServicePrice(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Service description..."
                    value={newServiceDesc}
                    onChange={(e) => setNewServiceDesc(e.target.value)}
                    rows={2}
                  />
                </div>
                <Button onClick={handleAddService} className="w-full bg-[#00a3e0] hover:bg-[#0088c0]">
                  Add Service
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {pricingData.map((service) => {
              const isExpanded = expandedService === service.service_type;
              const displayName = service.service_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              return (
                <div key={service.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <button
                    onClick={() => setExpandedService(isExpanded ? null : service.service_type)}
                    className="w-full flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <DollarSign className="w-5 h-5 text-[#00a3e0]" />
                      <span className="font-medium">{displayName}</span>
                      {pricing[service.service_type] && (
                        <span className="text-sm text-gray-500">
                          ${parseFloat(pricing[service.service_type]).toLocaleString()}
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
                          step="0.01"
                          placeholder="0.00"
                          value={pricing[service.service_type] || ''}
                          onChange={(e) => setPricing({ ...pricing, [service.service_type]: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Service description..."
                          value={descriptions[service.service_type] || ''}
                          onChange={(e) => setDescriptions({ ...descriptions, [service.service_type]: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => handleSave(service)} className="flex-1 bg-[#00a3e0] hover:bg-[#0088c0]">
                          <Save className="w-4 h-4 mr-2" />
                          Save
                        </Button>
                        <Button onClick={() => handleDelete(service)} variant="destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
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