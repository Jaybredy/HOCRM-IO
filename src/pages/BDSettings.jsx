import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings } from 'lucide-react';
import BDGoals from '../components/bd/BDGoals';
import BDBudgetManager from '../components/bd/BDBudgetManager';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import ServicePricingManager from '../components/bd/ServicePricingManager.jsx';

export default function BDSettings() {
  const { data: bdLeads = [] } = useQuery({
    queryKey: ['bdLeads'],
    queryFn: () => base44.entities.BDLead.list(),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
          <Settings className="w-8 h-8 text-[#00a3e0]" />
          BD Settings
        </h1>
        <p className="text-slate-400 mt-1">Configure goals, budgets, and service pricing</p>
      </div>

      <Tabs defaultValue="goals" className="w-full">
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="goals" className="data-[state=active]:bg-[#00a3e0] data-[state=active]:text-white text-slate-400">Goals</TabsTrigger>
          <TabsTrigger value="budget" className="data-[state=active]:bg-[#00a3e0] data-[state=active]:text-white text-slate-400">Budget</TabsTrigger>
          <TabsTrigger value="pricing" className="data-[state=active]:bg-[#00a3e0] data-[state=active]:text-white text-slate-400">Service Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="goals">
          <BDGoals />
        </TabsContent>

        <TabsContent value="budget">
          <BDBudgetManager bdLeads={bdLeads} />
        </TabsContent>

        <TabsContent value="pricing">
          <ServicePricingManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}