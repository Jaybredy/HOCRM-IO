import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Package } from 'lucide-react';
import BDPipelineChart from './BDPipelineChart';
import BDPaceAnalysis from './BDPaceAnalysis';
import BDConversionFunnel from './BDConversionFunnel';
import BDDealMetrics from './BDDealMetrics';
import BDServiceMix from './BDServiceMix';

export default function BDAnalyticsTabs({ data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Analytics & Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pipeline" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>

          <TabsContent value="pipeline" className="space-y-6 mt-4">
            <div className="grid md:grid-cols-2 gap-6">
              <BDPipelineChart data={data} />
              <BDPaceAnalysis data={data} />
            </div>
            <BDConversionFunnel data={data} />
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <BDDealMetrics data={data} />
          </TabsContent>

          <TabsContent value="services" className="mt-4">
            <BDServiceMix data={data} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}