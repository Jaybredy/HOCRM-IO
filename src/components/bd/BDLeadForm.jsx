import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus } from 'lucide-react';

export default function BDLeadForm({ lead, onSubmit, onCancel, servicePricing }) {
  const [customService, setCustomService] = useState('');
  const [showCustomService, setShowCustomService] = useState(false);
  const [formData, setFormData] = useState(lead || {
    hotel_name: '',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    number_of_rooms: '',
    services: [],
    service_pricing: {},
    status: 'reached_out',
    seller_name: '',
    notes: ''
  });

  // Get default pricing from servicePricing entity
  const getDefaultPrice = (serviceType) => {
    const pricing = servicePricing.find(p => p.service_type === serviceType);
    return pricing?.price || 0;
  };

  const handleServiceToggle = (serviceValue) => {
    const currentServices = formData.services || [];
    const newServices = currentServices.includes(serviceValue)
      ? currentServices.filter(s => s !== serviceValue)
      : [...currentServices, serviceValue];
    
    // Update pricing if service is newly selected
    const newPricing = { ...formData.service_pricing };
    if (!currentServices.includes(serviceValue)) {
      newPricing[serviceValue] = getDefaultPrice(serviceValue);
    }
    
    setFormData({
      ...formData,
      services: newServices,
      service_pricing: newPricing
    });
  };

  const handlePricingChange = (serviceValue, price) => {
    setFormData({
      ...formData,
      service_pricing: {
        ...formData.service_pricing,
        [serviceValue]: parseFloat(price) || 0
      }
    });
  };

  const handleAddCustomService = () => {
    if (!customService.trim()) return;
    const serviceKey = customService.toLowerCase().replace(/\s+/g, '_');
    handleServiceToggle(serviceKey);
    setCustomService('');
    setShowCustomService(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{lead ? 'Edit BD Lead' : 'Add New BD Lead'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hotel Name *</Label>
              <Input
                required
                value={formData.hotel_name}
                onChange={(e) => setFormData({...formData, hotel_name: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Person *</Label>
              <Input
                required
                value={formData.contact_person}
                onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label>Number of Rooms</Label>
              <Input
                type="number"
                value={formData.number_of_rooms}
                onChange={(e) => setFormData({...formData, number_of_rooms: parseFloat(e.target.value)})}
              />
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(val) => setFormData({...formData, status: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reached_out">Reached Out</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                  <SelectItem value="signed_agreement">Signed Agreement</SelectItem>
                  <SelectItem value="closed_lost">Closed Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Seller Name</Label>
              <Input
                value={formData.seller_name}
                onChange={(e) => setFormData({...formData, seller_name: e.target.value})}
              />
            </div>
          </div>

          {/* Services Selection with Pricing */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Services & Pricing *</Label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm"
                onClick={() => setShowCustomService(!showCustomService)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Custom Service
              </Button>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              {showCustomService && (
                <div className="flex gap-2 pb-3 border-b">
                  <Input
                    placeholder="Custom service name"
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomService())}
                  />
                  <Button type="button" onClick={handleAddCustomService} size="sm">
                    Add
                  </Button>
                </div>
              )}
              {servicePricing.map((service) => {
                const displayName = service.service_type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                const isSelected = (formData.services || []).includes(service.service_type);
                return (
                  <div key={service.service_type} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleServiceToggle(service.service_type)}
                      />
                      <Label className="cursor-pointer">{displayName}</Label>
                      <span className="text-xs text-gray-500">(Default: ${service.price.toLocaleString()})</span>
                    </div>
                    {isSelected && (
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-gray-600">Price ($):</Label>
                        <Input
                          type="number"
                          step="0.01"
                          className="w-32"
                          placeholder={service.price.toString()}
                          value={formData.service_pricing?.[service.service_type] || ''}
                          onChange={(e) => handlePricingChange(service.service_type, e.target.value)}
                          required
                        />
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handlePricingChange(service.service_type, service.price)}
                          className="text-xs"
                        >
                          Use Default
                        </Button>
                      </div>
                    )}
                  </div>
                );
                })}
                {(formData.services || []).filter(s => !servicePricing.find(sp => sp.service_type === s)).map((customSvc) => {
                const displayName = customSvc.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                return (
                  <div key={customSvc} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 flex-1">
                      <Checkbox
                        checked
                        onCheckedChange={() => {
                          const newServices = formData.services.filter(s => s !== customSvc);
                          setFormData({ ...formData, services: newServices });
                        }}
                      />
                      <Label className="cursor-pointer">{displayName}</Label>
                      <span className="text-xs text-blue-600">(Custom)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-gray-600">Custom Price ($):</Label>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-32"
                        placeholder="0.00"
                        value={formData.service_pricing?.[customSvc] || ''}
                        onChange={(e) => handlePricingChange(customSvc, e.target.value)}
                        required
                      />
                    </div>
                  </div>
                );
                })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {lead ? 'Update Lead' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}