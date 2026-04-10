import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns";

export default function DateFilters({ dateRange, setDateRange }) {
  const [pendingStart, setPendingStart] = useState(dateRange.start);
  const [pendingEnd, setPendingEnd] = useState(dateRange.end);

  const applyQuick = (range) => {
    setPendingStart(range.start);
    setPendingEnd(range.end);
    setDateRange(range);
  };

  const setThisMonth = () => {
    const today = new Date();
    applyQuick({
      start: startOfMonth(today).toISOString().split('T')[0],
      end: endOfMonth(today).toISOString().split('T')[0]
    });
  };

  const setNext30Days = () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 30);
    applyQuick({ start: today.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
  };

  const setNext60Days = () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 60);
    applyQuick({ start: today.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
  };

  const setNext90Days = () => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(today.getDate() + 90);
    applyQuick({ start: today.toISOString().split('T')[0], end: end.toISOString().split('T')[0] });
  };

  const setThisYear = () => {
    const today = new Date();
    applyQuick({
      start: startOfYear(today).toISOString().split('T')[0],
      end: endOfYear(today).toISOString().split('T')[0]
    });
  };

  return (
    <Card className="border-2 border-slate-300 rounded-2xl" style={{ backgroundColor: '#e1f5f5' }}>
      <CardContent className="p-6 space-y-4">
        <div>
          <Label className="mb-3 block text-slate-900 font-bold text-sm">Quick Date Filters</Label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Button 
             size="sm"
             className="bg-slate-800 text-white hover:bg-slate-700 font-semibold rounded-lg border-0"
             onClick={setThisMonth}
            >
             This Month
            </Button>
            <Button 
             size="sm"
             className="bg-slate-800 text-white hover:bg-slate-700 font-semibold rounded-lg border-0"
             onClick={setNext30Days}
            >
             Next 30 Days
            </Button>
            <Button 
             size="sm"
             className="bg-slate-800 text-white hover:bg-slate-700 font-semibold rounded-lg border-0"
             onClick={setNext60Days}
            >
             Next 60 Days
            </Button>
            <Button 
             size="sm"
             className="bg-slate-800 text-white hover:bg-slate-700 font-semibold rounded-lg border-0"
             onClick={setNext90Days}
            >
             Next 90 Days
            </Button>
            <Button 
             size="sm"
             className="bg-slate-800 text-white hover:bg-slate-700 font-semibold rounded-lg border-0"
             onClick={setThisYear}
            >
             This Year
            </Button>
          </div>
        </div>

        <div className="space-y-2 mb-2">
          <div className="flex justify-between text-slate-900 font-bold text-sm">
            <span>Start Date</span>
            <span>End Date</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-end">
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button className="w-full justify-start text-left font-normal bg-slate-900 border-0 text-white hover:bg-slate-800 rounded-lg">
                  <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400" />
                  {pendingStart}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                <Calendar
                  mode="single"
                  selected={new Date(pendingStart)}
                  onSelect={(date) => date && setPendingStart(date.toISOString().split('T')[0])}
                  className="text-white"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Popover>
              <PopoverTrigger asChild>
                <Button className="w-full justify-start text-left font-normal bg-slate-900 border-0 text-white hover:bg-slate-800 rounded-lg">
                  <CalendarIcon className="mr-2 h-4 w-4 text-cyan-400" />
                  {pendingEnd}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-slate-800 border-slate-700">
                <Calendar
                  mode="single"
                  selected={new Date(pendingEnd)}
                  onSelect={(date) => date && setPendingEnd(date.toISOString().split('T')[0])}
                  className="text-white"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => setDateRange({ start: pendingStart, end: pendingEnd })}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 rounded-lg"
          >
            Search
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}