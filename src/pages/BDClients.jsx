import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building2, Search, DollarSign, Calendar, User, Phone, Mail, MapPin } from 'lucide-react';
import { format } from 'date-fns';

export default function BDClients() {
  const [searchTerm, setSearchTerm] = useState('');

  const { data: bdLeads = [] } = useQuery({
    queryKey: ['bdLeads'],
    queryFn: () => base44.entities.BDLead.list('-updated_date'),
  });

  const activeClients = bdLeads.filter(lead => lead.status === 'signed_agreement');

  const filteredClients = activeClients.filter(client =>
    client.hotel_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.contact_person?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getClientValue = (client) => {
    return Object.values(client.service_pricing || {}).reduce((sum, price) => sum + price, 0);
  };

  const totalValue = activeClients.reduce((sum, client) => sum + getClientValue(client), 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00a3e0] to-[#0066cc] bg-clip-text text-transparent flex items-center gap-2">
          <Building2 className="w-8 h-8 text-[#00a3e0]" />
          Active Clients
        </h1>
        <p className="text-gray-600 mt-1">Hotels with signed agreements</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#00a3e0]">{activeClients.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">${totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg. Contract Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${activeClients.length > 0 ? Math.round(totalValue / activeClients.length).toLocaleString() : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <Input
          placeholder="Search clients by name or contact..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Client Cards */}
      <div className="grid md:grid-cols-2 gap-4">
        {filteredClients.map((client) => (
          <Card key={client.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{client.hotel_name}</CardTitle>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      {getClientValue(client).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2 text-sm">
                {client.contact_person && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4" />
                    {client.contact_person}
                  </div>
                )}
                {client.contact_email && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="w-4 h-4" />
                    {client.contact_email}
                  </div>
                )}
                {client.contact_phone && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="w-4 h-4" />
                    {client.contact_phone}
                  </div>
                )}
                {client.address && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    {client.address}
                  </div>
                )}
                {client.number_of_rooms && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="w-4 h-4" />
                    {client.number_of_rooms} rooms
                  </div>
                )}
              </div>

              <div className="pt-3 border-t">
                <div className="text-xs font-semibold text-gray-700 mb-2">Services Provided:</div>
                <div className="flex flex-wrap gap-1">
                  {(client.services || []).map((service, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {service.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              {client.seller_name && (
                <div className="pt-2 text-xs text-gray-500">
                  Account Manager: {client.seller_name}
                </div>
              )}

              {client.updated_date && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  Last updated: {format(new Date(client.updated_date), 'MMM d, yyyy')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClients.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-gray-500">
            {searchTerm ? 'No clients found matching your search' : 'No active clients yet'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}