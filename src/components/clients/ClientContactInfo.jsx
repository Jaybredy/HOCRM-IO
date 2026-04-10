import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, Phone, MapPin, Tag, User, Edit } from "lucide-react";

function InfoRow({ icon: Icon, label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        {href ? (
          <a href={href} className="text-slate-200 hover:text-white">{value}</a>
        ) : (
          <p className="text-slate-200">{value}</p>
        )}
      </div>
    </div>
  );
}

export default function ClientContactInfo({ client, onEdit }) {
  return (
    <Card className="bg-slate-800/60 border-slate-700">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm text-slate-300 font-semibold uppercase tracking-wider">Contact Info</CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-white" onClick={onEdit}>
          <Edit className="w-3.5 h-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <InfoRow icon={User} label="Contact Person" value={client.contact_person} />
        <InfoRow icon={Mail} label="Email" value={client.email} href={`mailto:${client.email}`} />
        <InfoRow icon={Phone} label="Phone" value={client.phone} href={`tel:${client.phone}`} />
        <InfoRow icon={MapPin} label="Address" value={client.address} />
        <InfoRow icon={Tag} label="Industry" value={client.industry} />
        {client.notes && (
          <div className="pt-3 border-t border-slate-700">
            <p className="text-xs text-slate-500 mb-1">Notes</p>
            <p className="text-sm text-slate-300 leading-relaxed">{client.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}