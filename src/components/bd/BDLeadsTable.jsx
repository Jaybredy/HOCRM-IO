import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const STATUS_COLORS = {
  reached_out: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  proposal_sent: 'bg-purple-100 text-purple-800',
  signed_agreement: 'bg-green-100 text-green-800',
  closed_lost: 'bg-red-100 text-red-800'
};

const STATUS_LABELS = {
  reached_out: 'Reached Out',
  in_progress: 'In Progress',
  proposal_sent: 'Proposal Sent',
  signed_agreement: 'Signed Agreement',
  closed_lost: 'Closed Lost'
};

const SERVICE_LABELS = {
  sales: 'Sales',
  revenue_management: 'Revenue Mgmt',
  digital_marketing: 'Digital Mktg',
  tech_stack: 'Tech Stack',
  project_management: 'PM',
  advisory: 'Advisory',
  audit: 'Audit'
};

export default function BDLeadsTable({ data, onEdit, onDelete, onStatusChange }) {
  const [statusFilter, setStatusFilter] = React.useState(null);

  // Sort by status order
  const statusOrder = ['reached_out', 'in_progress', 'proposal_sent', 'signed_agreement', 'closed_lost'];
  const sortedData = [...data]
    .filter(lead => !statusFilter || lead.status === statusFilter)
    .sort((a, b) => {
      return statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    });
  
  const calculateTotalValue = (lead) => {
    if (!lead.service_pricing) return 0;
    return Object.values(lead.service_pricing).reduce((sum, price) => sum + (price || 0), 0);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Business Development Leads</CardTitle>
          <div className="flex gap-2 text-xs">
            <Badge 
              className={`cursor-pointer transition-opacity ${statusFilter === null ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
              onClick={() => setStatusFilter(null)}
            >
              All: {data.length}
            </Badge>
            <Badge 
              className={`cursor-pointer transition-opacity ${statusFilter === 'reached_out' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'}`}
              onClick={() => setStatusFilter('reached_out')}
            >
              Reached Out: {data.filter(l => l.status === 'reached_out').length}
            </Badge>
            <Badge 
              className={`cursor-pointer transition-opacity ${statusFilter === 'in_progress' ? 'bg-yellow-600 text-white' : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'}`}
              onClick={() => setStatusFilter('in_progress')}
            >
              In Progress: {data.filter(l => l.status === 'in_progress').length}
            </Badge>
            <Badge 
              className={`cursor-pointer transition-opacity ${statusFilter === 'proposal_sent' ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-800 hover:bg-purple-200'}`}
              onClick={() => setStatusFilter('proposal_sent')}
            >
              Proposal Sent: {data.filter(l => l.status === 'proposal_sent').length}
            </Badge>
            <Badge 
              className={`cursor-pointer transition-opacity ${statusFilter === 'signed_agreement' ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800 hover:bg-green-200'}`}
              onClick={() => setStatusFilter('signed_agreement')}
            >
              Signed: {data.filter(l => l.status === 'signed_agreement').length}
            </Badge>
            <Badge 
              className={`cursor-pointer transition-opacity ${statusFilter === 'closed_lost' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-800 hover:bg-red-200'}`}
              onClick={() => setStatusFilter('closed_lost')}
            >
              Closed Lost: {data.filter(l => l.status === 'closed_lost').length}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hotel</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Rooms</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Value</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                    No BD leads yet. Add your first lead above.
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((lead) => (
                  <TableRow key={lead.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{lead.hotel_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{lead.contact_person}</div>
                        {lead.contact_email && (
                          <div className="text-gray-500 text-xs">{lead.contact_email}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{lead.number_of_rooms || '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(lead.services || []).map(service => (
                          <Badge key={service} variant="outline" className="text-xs">
                            {SERVICE_LABELS[service] || service}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-auto p-0">
                            <Badge className={STATUS_COLORS[lead.status]}>
                              {STATUS_LABELS[lead.status]}
                            </Badge>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => onStatusChange(lead, 'reached_out')}>
                            Reached Out
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(lead, 'in_progress')}>
                            In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(lead, 'proposal_sent')}>
                            Proposal Sent
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(lead, 'signed_agreement')}>
                            Signed Agreement
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onStatusChange(lead, 'closed_lost')}>
                            Closed Lost
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${calculateTotalValue(lead).toLocaleString()}
                    </TableCell>
                    <TableCell>{lead.seller_name || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => onEdit(lead)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(lead.id)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}