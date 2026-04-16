import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2, DollarSign, Target, ChevronDown, Users, Mail, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import BudgetManager from "../components/performance/BudgetManager";
import ActivityGoalsSettings from "../components/activities/ActivityGoalsSettings";
import SellerActivityTargets from "../components/performance/SellerActivityTargets";

export default function Settings() {
  const [showHotelForm, setShowHotelForm] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [hotelForm, setHotelForm] = useState({ name: '', location: '', total_rooms: '', is_active: true, hotel_type: 'hotel' });
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('all');
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');

  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list()
  });

  const inviteMutation = useMutation({
    mutationFn: (data) => base44.users.inviteUser(data.email, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('user');
    },
    onError: (error) => alert(`Error inviting user: ${error.message}`)
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  const { data: hotels = [] } = useQuery({
    queryKey: ['hotels'],
    queryFn: () => base44.entities.Hotel.list()
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => base44.entities.Budget.list()
  });

  const createHotel = useMutation({
    mutationFn: (data) => base44.entities.Hotel.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      setShowHotelForm(false);
      resetHotelForm();
    }
  });

  const updateHotel = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Hotel.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotels'] });
      setShowHotelForm(false);
      setEditingHotel(null);
      resetHotelForm();
    }
  });

  const deleteHotel = useMutation({
    mutationFn: (id) => base44.entities.Hotel.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hotels'] })
  });

  const resetHotelForm = () => setHotelForm({ name: '', location: '', total_rooms: '', is_active: true, hotel_type: 'hotel' });

  const handleHotelEdit = (hotel) => {
    setEditingHotel(hotel);
    setHotelForm({ name: hotel.name, location: hotel.location || '', total_rooms: hotel.total_rooms || '', is_active: hotel.is_active !== false, hotel_type: hotel.hotel_type || 'hotel' });
    setShowHotelForm(true);
  };

  const handleHotelSubmit = (e) => {
    e.preventDefault();
    const data = { ...hotelForm, total_rooms: parseInt(hotelForm.total_rooms) || 0 };
    if (editingHotel) {
      updateHotel.mutate({ id: editingHotel.id, data });
    } else {
      createHotel.mutate(data);
    }
  };

  const filteredHotels = propertyTypeFilter === 'all' 
    ? hotels 
    : hotels.filter(h => (h.hotel_type || 'hotel') === propertyTypeFilter);

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage hotels and budgets</p>
      </div>

      {/* Hotels Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <CardTitle>Hotels & Rentals</CardTitle>
              </div>
            <Dialog open={showHotelForm} onOpenChange={(open) => {
              setShowHotelForm(open);
              if (!open) { setEditingHotel(null); resetHotelForm(); }
            }}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-1" /> Add Property
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingHotel ? 'Edit Property' : 'Add Property'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleHotelSubmit} className="space-y-4">
                  <div>
                    <Label>Hotel Name *</Label>
                    <Input
                      value={hotelForm.name}
                      onChange={(e) => setHotelForm({ ...hotelForm, name: e.target.value })}
                      required
                      placeholder="e.g. Grand Hyatt Downtown"
                    />
                  </div>
                  <div>
                    <Label>Location</Label>
                    <Input
                      value={hotelForm.location}
                      onChange={(e) => setHotelForm({ ...hotelForm, location: e.target.value })}
                      placeholder="e.g. New York, NY"
                    />
                  </div>
                  <div>
                    <Label>Total Rooms</Label>
                    <Input
                      type="number"
                      value={hotelForm.total_rooms}
                      onChange={(e) => setHotelForm({ ...hotelForm, total_rooms: e.target.value })}
                      placeholder="e.g. 250"
                    />
                  </div>
                  <div>
                    <Label>Property Type</Label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hotel_type"
                          value="hotel"
                          checked={hotelForm.hotel_type === 'hotel'}
                          onChange={(e) => setHotelForm({ ...hotelForm, hotel_type: e.target.value })}
                          className="rounded"
                        />
                        <span className="text-sm">Hotel</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="hotel_type"
                          value="apartment"
                          checked={hotelForm.hotel_type === 'apartment'}
                          onChange={(e) => setHotelForm({ ...hotelForm, hotel_type: e.target.value })}
                          className="rounded"
                        />
                        <span className="text-sm">Rental</span>
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={hotelForm.is_active}
                      onChange={(e) => setHotelForm({ ...hotelForm, is_active: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingHotel ? 'Update' : 'Create'} Property
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowHotelForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </div>
            <div className="flex gap-2">
            <Button
              variant={propertyTypeFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setPropertyTypeFilter('all')}
              className={propertyTypeFilter === 'all' ? 'bg-blue-600' : ''}
            >
              All Properties
            </Button>
            <Button
              variant={propertyTypeFilter === 'hotel' ? 'default' : 'outline'}
              onClick={() => setPropertyTypeFilter('hotel')}
              className={propertyTypeFilter === 'hotel' ? 'bg-blue-600' : ''}
            >
              Hotels
            </Button>
            <Button
              variant={propertyTypeFilter === 'apartment' ? 'default' : 'outline'}
              onClick={() => setPropertyTypeFilter('apartment')}
              className={propertyTypeFilter === 'apartment' ? 'bg-blue-600' : ''}
            >
              Rentals
            </Button>
            </div>
            </div>
            </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Rooms</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHotels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500">No properties found.</TableCell>
                </TableRow>
              ) : (
                filteredHotels.map(hotel => (
                  <TableRow key={hotel.id}>
                    <TableCell className="font-medium">{hotel.name}</TableCell>
                    <TableCell>{hotel.location || '—'}</TableCell>
                    <TableCell className="text-right">{hotel.total_rooms || '—'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${hotel.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {hotel.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => handleHotelEdit(hotel)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Select value={hotel.hotel_type || 'hotel'} onValueChange={(value) => updateHotel.mutate({ id: hotel.id, data: { ...hotel, hotel_type: value } })}>
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="select">Select</SelectItem>
                            <SelectItem value="hotel">Hotel</SelectItem>
                            <SelectItem value="apartment">Rental</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => deleteHotel.mutate(hotel.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Budget Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Budget Management</h2>
        </div>
        <BudgetManager hotels={hotels} budgets={budgets} />
      </div>

      {/* Seller Activity Targets */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-800">Seller Activity Targets</h2>
          <span className="text-sm text-gray-500">(solicitations, proposals, contracts, etc.)</span>
        </div>
        <SellerActivityTargets />
      </div>

      {/* Activity Goals */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-800">Activity Goals</h2>
          <span className="text-sm text-gray-500">(monthly targets for solicitations, site inspections, tradeshows, etc.)</span>
        </div>
        <ActivityGoalsSettings />
      </div>

      {/* User Management Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <CardTitle>User Management</CardTitle>
            </div>
            <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-1" /> Invite User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite User</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <Label>Email Address</Label>
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="user@example.com"
                      required
                    />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? 'Inviting...' : 'Send Invite'}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500">No users found.</TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      {user.full_name}
                    </TableCell>
                    <TableCell className="text-gray-600">{user.email}</TableCell>
                    <TableCell>
                      <Badge className={['admin', 'EPIC_ADMIN'].includes(user.role) ? 'bg-red-500 text-white' : 'bg-blue-100 text-blue-800'}>
                        {['admin', 'EPIC_ADMIN'].includes(user.role) ? 'Administrator' : 'User'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500 text-sm">
                      {new Date(user.created_date).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}