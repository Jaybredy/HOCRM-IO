import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from 'lucide-react';

export default function BDDateFilter({ value, onChange, onCustomDateChange }) {
  const [showCustom, setShowCustom] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleCustomApply = () => {
    if (startDate && endDate) {
      onCustomDateChange({ startDate, endDate });
      setShowCustom(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg px-4 py-2 border border-gray-200">
      <Calendar className="w-4 h-4 text-gray-500" />
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="border-0 shadow-none focus:ring-0 w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="custom" onSelect={(e) => { e.preventDefault(); setShowCustom(true); }}>
            Customize Date
          </SelectItem>
          <SelectItem value="30">Last 30 Days</SelectItem>
          <SelectItem value="60">Last 60 Days</SelectItem>
          <SelectItem value="90">Last 90 Days</SelectItem>
          <SelectItem value="180">Last 6 Months</SelectItem>
          <SelectItem value="365">Last Year</SelectItem>
        </SelectContent>
      </Select>

      <Dialog open={showCustom} onOpenChange={setShowCustom}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Custom Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input 
                type="date" 
                value={startDate} 
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input 
                type="date" 
                value={endDate} 
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={handleCustomApply} className="w-full">Apply</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}