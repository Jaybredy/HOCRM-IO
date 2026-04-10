import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, DollarSign, ArrowRight, Building2, User } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_CONFIG = {
  reached_out: { name: 'Reached Out', color: 'bg-blue-100 text-blue-800', order: 1 },
  in_progress: { name: 'In Progress', color: 'bg-yellow-100 text-yellow-800', order: 2 },
  proposal_sent: { name: 'Proposal Sent', color: 'bg-purple-100 text-purple-800', order: 3 },
  signed_agreement: { name: 'Signed', color: 'bg-green-100 text-green-800', order: 4 },
  closed_lost: { name: 'Closed Lost', color: 'bg-red-100 text-red-800', order: 5 }
};

export default function BDPipeline() {
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: bdLeads = [] } = useQuery({
    queryKey: ['bdLeads'],
    queryFn: () => base44.entities.BDLead.list('-created_date'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.BDLead.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bdLeads'] });
    },
  });

  const handleStatusChange = (lead, newStatus) => {
    updateMutation.mutate({
      id: lead.id,
      data: { ...lead, status: newStatus }
    });
  };

  const getLeadValue = (lead) => {
    return Object.values(lead.service_pricing || {}).reduce((sum, price) => sum + price, 0);
  };

  const filteredLeads = filterStatus === 'all' 
    ? bdLeads 
    : bdLeads.filter(lead => lead.status === filterStatus);

  const stageStats = Object.keys(STATUS_CONFIG).map(status => ({
    status,
    count: bdLeads.filter(l => l.status === status).length,
    value: bdLeads.filter(l => l.status === status).reduce((sum, l) => sum + getLeadValue(l), 0)
  }));

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#00a3e0] to-[#0066cc] bg-clip-text text-transparent flex items-center gap-2">
          <TrendingUp className="w-8 h-8 text-[#00a3e0]" />
          Lead Pipeline
        </h1>
        <p className="text-gray-600 mt-1">Track and manage leads through each stage</p>
      </div>

      {/* Stage Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stageStats.map(({ status, count, value }) => (
          <Card key={status} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setFilterStatus(status)}>
            <CardContent className="p-4">
              <div className="text-xs font-medium text-gray-600 mb-1">
                {STATUS_CONFIG[status].name}
              </div>
              <div className="text-2xl font-bold text-[#00a3e0]">{count}</div>
              <div className="text-xs text-gray-500">${value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterStatus !== 'all' && (
          <Badge variant="outline" onClick={() => setFilterStatus('all')} className="cursor-pointer">
            Clear filter
          </Badge>
        )}
      </div>

      {/* Pipeline Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline ({filteredLeads.length} leads)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="font-medium">{lead.hotel_name}</div>
                        {lead.number_of_rooms && (
                          <div className="text-xs text-gray-500">{lead.number_of_rooms} rooms</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-sm">{lead.contact_person}</div>
                      {lead.contact_email && (
                        <div className="text-xs text-gray-500">{lead.contact_email}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <User className="w-3 h-3 text-gray-400" />
                      {lead.seller_name || '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(lead.services || []).slice(0, 2).map((service, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {service.split('_')[0]}
                        </Badge>
                      ))}
                      {(lead.services || []).length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{(lead.services || []).length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-semibold text-emerald-600">
                      <DollarSign className="w-4 h-4" />
                      {getLeadValue(lead).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={lead.status}
                      onValueChange={(newStatus) => handleStatusChange(lead, newStatus)}
                    >
                      <SelectTrigger className="w-40">
                        <Badge className={STATUS_CONFIG[lead.status]?.color}>
                          {STATUS_CONFIG[lead.status]?.name}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              {config.name}
                              {STATUS_CONFIG[lead.status]?.order < config.order && (
                                <ArrowRight className="w-3 h-3 text-gray-400" />
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {lead.updated_date ? format(new Date(lead.updated_date), 'MMM d, yyyy') : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredLeads.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No leads found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}