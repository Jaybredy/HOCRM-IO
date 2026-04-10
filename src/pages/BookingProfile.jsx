import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, Trash2, FileText, Edit, X, Paperclip, Calendar, DollarSign, BedDouble, User, Building2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import ProductionForm from '@/components/crm/ProductionForm';

const STATUS_COLORS = {
  solicitation: 'bg-slate-600/60 text-slate-200 border-slate-500',
  prospect:     'bg-blue-500/20 text-blue-300 border-blue-500/40',
  tentative:    'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  definite:     'bg-green-500/20 text-green-300 border-green-500/40',
  actual:       'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
  lost:         'bg-red-500/20 text-red-300 border-red-500/40',
};

const safeFormat = (dateStr, fmt = 'MMM d, yyyy') => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    return format(d, fmt);
  } catch { return '—'; }
};

export default function BookingProfile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('id');

  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list(),
  });

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => base44.entities.ProductionItem.filter({ id: bookingId }),
    enabled: !!bookingId,
    select: (data) => data[0],
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.ProductionItem.update(bookingId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      setIsEditing(false);
    },
  });

  const getHotelName = (hotelId) => {
    const hotel = hotels.find(h => h.id === hotelId);
    return hotel ? hotel.name : 'Unknown';
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const newDoc = {
      name: file.name,
      url: file_url,
      type: file.type,
      uploaded_at: new Date().toISOString(),
    };
    const updatedDocs = [...(booking.documents || []), newDoc];
    await updateMutation.mutateAsync({ documents: updatedDocs });
    setUploading(false);
  };

  const handleDeleteDoc = async (index) => {
    const updatedDocs = booking.documents.filter((_, i) => i !== index);
    await updateMutation.mutateAsync({ documents: updatedDocs });
  };

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        No booking ID provided.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Loading booking...
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        Booking not found.
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="min-h-screen bg-slate-950 p-6">
        <Button variant="ghost" onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white mb-4">
          <X className="w-4 h-4 mr-2" /> Cancel Edit
        </Button>
        <ProductionForm
          item={booking}
          hotels={hotels}
          onSubmit={(data) => updateMutation.mutate(data)}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('CRM'))} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">{booking.client_name}</h1>
            <p className="text-slate-400 text-sm">{getHotelName(booking.hotel_id)}</p>
          </div>
          <Badge className={`${STATUS_COLORS[booking.status]} border text-sm capitalize ml-2`}>
            {booking.status}
          </Badge>
        </div>
        <Button onClick={() => setIsEditing(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Edit className="w-4 h-4 mr-2" /> Edit Booking
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-100 text-base">Booking Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="flex items-start gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Hotel</p>
                    <p className="text-sm text-slate-100">{getHotelName(booking.hotel_id)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Contact Person</p>
                    <p className="text-sm text-slate-100">{booking.contact_person || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Arrival</p>
                    <p className="text-sm text-slate-100">{safeFormat(booking.arrival_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Departure</p>
                    <p className="text-sm text-slate-100">{safeFormat(booking.departure_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Cutoff Date</p>
                    <p className="text-sm text-slate-100">{safeFormat(booking.cutoff_date)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <BedDouble className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Room Nights</p>
                    <p className="text-sm text-slate-100">{booking.room_nights?.toLocaleString() || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Total Revenue</p>
                    <p className="text-sm text-slate-100">${booking.revenue?.toLocaleString() || '0'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <DollarSign className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-400">Accommodation Revenue</p>
                    <p className="text-sm text-slate-100">${booking.accommodation_revenue?.toLocaleString() || '0'}</p>
                  </div>
                </div>
                {booking.seller_name && (
                  <div className="flex items-start gap-2">
                    <User className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Seller</p>
                      <p className="text-sm text-slate-100">{booking.seller_name}</p>
                    </div>
                  </div>
                )}
                {booking.event_type && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-xs text-slate-400">Event Type</p>
                      <p className="text-sm text-slate-100 capitalize">{booking.event_type}</p>
                    </div>
                  </div>
                )}
              </div>
              {booking.notes && (
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-400 mb-1">Notes</p>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{booking.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Documents */}
        <div>
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-100 text-base flex items-center gap-2">
                  <Paperclip className="w-4 h-4" /> Documents
                  {booking.documents?.length > 0 && (
                    <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded">
                      {booking.documents.length}
                    </span>
                  )}
                </CardTitle>
                <label className="cursor-pointer">
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                  <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-600 text-slate-300 hover:bg-slate-700 text-xs cursor-pointer">
                    <Upload className="w-3 h-3" />
                    {uploading ? 'Uploading...' : 'Upload'}
                  </div>
                </label>
              </div>
            </CardHeader>
            <CardContent>
              {!booking.documents?.length ? (
                <div className="text-center py-8 text-slate-500">
                  <Paperclip className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No documents uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {booking.documents.map((doc, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-800 border border-slate-700 group">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-blue-300 hover:text-blue-200 truncate flex-1">
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </a>
                      <Button variant="ghost" size="icon"
                        onClick={() => handleDeleteDoc(i)}
                        className="w-6 h-6 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 flex-shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}