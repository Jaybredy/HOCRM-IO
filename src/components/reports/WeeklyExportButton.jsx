import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from 'xlsx';
import { format, startOfWeek, endOfWeek, addWeeks, isWithinInterval, parseISO } from 'date-fns';

// XLSX style helpers — requires xlsx with full style support (write with bookType xlsx)
const COLORS = {
  // Hotel header banner
  hotelBg: '1E3A5F',       // dark navy
  hotelFg: 'FFFFFF',

  // Section headers
  groupsBg: '1D4ED8',      // blue
  rfpBg: '7C3AED',         // purple
  activityBg: '065F46',    // green
  taskBg: '92400E',        // amber/brown
  sectionFg: 'FFFFFF',

  // Column headers
  colHeaderBg: 'CBD5E1',   // slate-300
  colHeaderFg: '0F172A',

  // Summary row
  summaryBg: 'F1F5F9',
  summaryFg: '1E293B',

  // Alternating rows
  rowAlt: 'F8FAFC',
  rowNormal: 'FFFFFF',

  // Status colors (text)
  definite: '16A34A',
  tentative: 'D97706',
  prospect: '7C3AED',
  solicitation: '2563EB',
  actual: '059669',
  lost: 'DC2626',
};

const cell = (v, bold = false, bg = null, fg = '000000', italic = false, align = 'left', border = true) => {
  const style = {
    font: { bold, italic, color: { rgb: fg }, sz: 10 },
    alignment: { horizontal: align, vertical: 'center', wrapText: true },
  };
  if (bg) style.fill = { fgColor: { rgb: bg }, patternType: 'solid' };
  if (border) {
    style.border = {
      top: { style: 'thin', color: { rgb: 'CBD5E1' } },
      bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
      left: { style: 'thin', color: { rgb: 'CBD5E1' } },
      right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    };
  }
  return { v, t: typeof v === 'number' ? 'n' : 's', s: style };
};

const emptyCell = () => cell('', false, null, '000000', false, 'left', false);

const STATUS_FG = {
  definite: COLORS.definite,
  tentative: COLORS.tentative,
  prospect: COLORS.prospect,
  solicitation: COLORS.solicitation,
  actual: COLORS.actual,
  lost: COLORS.lost,
};

function buildHotelSheet(hotelName, weekLabel, production, rfps, activityLogs) {
  const rows = [];
  const colWidths = [22, 16, 14, 10, 12, 18, 30]; // client, status, event/type, rn, revenue, seller, notes

  // ── Title row ──────────────────────────────────────────────
  rows.push([
    cell(`🏨  ${hotelName}`, true, COLORS.hotelBg, COLORS.hotelFg, false, 'left'),
    cell('', false, COLORS.hotelBg, COLORS.hotelFg, false, 'left', false),
    cell('', false, COLORS.hotelBg, COLORS.hotelFg, false, 'left', false),
    cell('', false, COLORS.hotelBg, COLORS.hotelFg, false, 'left', false),
    cell('', false, COLORS.hotelBg, COLORS.hotelFg, false, 'left', false),
    cell(`Week: ${weekLabel}`, false, COLORS.hotelBg, COLORS.hotelFg, true, 'right', false),
    cell('', false, COLORS.hotelBg, COLORS.hotelFg, false, 'left', false),
  ]);
  rows.push(Array(7).fill(emptyCell())); // spacer

  // ── GROUP BOOKINGS ─────────────────────────────────────────
  const totalRN = production.reduce((s, p) => s + (p.room_nights || 0), 0);
  const totalRev = production.reduce((s, p) => s + (p.revenue || 0), 0);
  const definiteRev = production.filter(p => ['definite','actual'].includes(p.status)).reduce((s, p) => s + (p.revenue || 0), 0);

  rows.push([
    cell(`GROUP BOOKINGS  (${production.length} records)`, true, COLORS.groupsBg, COLORS.sectionFg, false, 'left'),
    cell('', false, COLORS.groupsBg, COLORS.sectionFg, false, 'left', false),
    cell('', false, COLORS.groupsBg, COLORS.sectionFg, false, 'left', false),
    cell('', false, COLORS.groupsBg, COLORS.sectionFg, false, 'left', false),
    cell('', false, COLORS.groupsBg, COLORS.sectionFg, false, 'left', false),
    cell('', false, COLORS.groupsBg, COLORS.sectionFg, false, 'left', false),
    cell('', false, COLORS.groupsBg, COLORS.sectionFg, false, 'left', false),
  ]);

  rows.push([
    cell('Client', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Status', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Event Type', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Room Nights', true, COLORS.colHeaderBg, COLORS.colHeaderFg, false, 'right'),
    cell('Revenue ($)', true, COLORS.colHeaderBg, COLORS.colHeaderFg, false, 'right'),
    cell('Seller', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Notes', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
  ]);

  if (production.length === 0) {
    rows.push([cell('No group bookings this week', false, null, '94A3B8', true, 'left', false), ...Array(6).fill(emptyCell())]);
  } else {
    production.forEach((p, i) => {
      const bg = i % 2 === 0 ? COLORS.rowNormal : COLORS.rowAlt;
      const statusFg = STATUS_FG[p.status] || '334155';
      rows.push([
        cell(p.client_name || '', false, bg),
        cell((p.status || '').replace(/_/g, ' '), true, bg, statusFg),
        cell(p.event_type || '—', false, bg),
        cell(p.room_nights || 0, false, bg, '000000', false, 'right'),
        cell(p.revenue || 0, false, bg, '000000', false, 'right'),
        cell(p.seller_name || '—', false, bg),
        cell(p.notes || '', false, bg),
      ]);
    });
    // Summary row
    rows.push([
      cell('TOTAL', true, COLORS.summaryBg, COLORS.summaryFg, false, 'right'),
      cell('', false, COLORS.summaryBg),
      cell('', false, COLORS.summaryBg),
      cell(totalRN, true, COLORS.summaryBg, COLORS.summaryFg, false, 'right'),
      cell(totalRev, true, COLORS.summaryBg, COLORS.summaryFg, false, 'right'),
      cell(`Definite Rev: $${definiteRev.toLocaleString()}`, false, COLORS.summaryBg, COLORS.summaryFg, true),
      cell('', false, COLORS.summaryBg),
    ]);
  }

  rows.push(Array(7).fill(emptyCell())); // spacer

  // ── RFPs ────────────────────────────────────────────────────
  rows.push([
    cell(`RFPs  (${rfps.length} records)`, true, COLORS.rfpBg, COLORS.sectionFg, false, 'left'),
    ...Array(6).fill(cell('', false, COLORS.rfpBg, COLORS.sectionFg, false, 'left', false)),
  ]);
  rows.push([
    cell('Company', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Status', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Potential RN', true, COLORS.colHeaderBg, COLORS.colHeaderFg, false, 'right'),
    cell('Seller', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Submitted', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Notes', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('', false, COLORS.colHeaderBg),
  ]);

  if (rfps.length === 0) {
    rows.push([cell('No RFPs this week', false, null, '94A3B8', true, 'left', false), ...Array(6).fill(emptyCell())]);
  } else {
    rfps.forEach((r, i) => {
      const bg = i % 2 === 0 ? COLORS.rowNormal : COLORS.rowAlt;
      rows.push([
        cell(r.company_name || '', false, bg),
        cell((r.status || '').replace(/_/g, ' '), false, bg),
        cell(r.potential_room_nights || 0, false, bg, '000000', false, 'right'),
        cell(r.seller_name || '—', false, bg),
        cell(r.submission_date || '—', false, bg),
        cell(r.notes || '', false, bg),
        cell('', false, bg),
      ]);
    });
  }

  rows.push(Array(7).fill(emptyCell())); // spacer

  // ── ACTIVITY LOGS ───────────────────────────────────────────
  rows.push([
    cell(`ACTIVITY LOGS  (${activityLogs.length} records)`, true, COLORS.activityBg, COLORS.sectionFg, false, 'left'),
    ...Array(6).fill(cell('', false, COLORS.activityBg, COLORS.sectionFg, false, 'left', false)),
  ]);
  rows.push([
    cell('Client', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Activity Type', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Date', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Seller', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Notes', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('', false, COLORS.colHeaderBg),
    cell('', false, COLORS.colHeaderBg),
  ]);

  if (activityLogs.length === 0) {
    rows.push([cell('No activity logs this week', false, null, '94A3B8', true, 'left', false), ...Array(6).fill(emptyCell())]);
  } else {
    activityLogs.forEach((a, i) => {
      const bg = i % 2 === 0 ? COLORS.rowNormal : COLORS.rowAlt;
      rows.push([
        cell(a.client_name || '', false, bg),
        cell((a.status || '').replace(/_/g, ' '), false, bg),
        cell(a.activity_date || '', false, bg),
        cell(a.seller_name || '—', false, bg),
        cell(a.notes || '', false, bg),
        cell('', false, bg),
        cell('', false, bg),
      ]);
    });
  }

  // Build worksheet from array of arrays of cell objects
  const wsData = rows;
  const ws = XLSX.utils.aoa_to_sheet(wsData.map(row => row.map(c => c.v)));

  // Apply styles cell by cell
  wsData.forEach((row, ri) => {
    row.forEach((c, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
      if (!ws[addr]) ws[addr] = {};
      ws[addr].s = c.s;
      ws[addr].t = c.t;
    });
  });

  // Column widths
  ws['!cols'] = colWidths.map(w => ({ wch: w }));

  // Merge title row across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },   // hotel name spans 5 cols
    { s: { r: 0, c: 5 }, e: { r: 0, c: 6 } },    // week label spans 2 cols
  ];

  return ws;
}

function buildSummarySheet(weekLabel, hotelNames, allProduction, allRFPs, allActivityLogs, getHotelName) {
  const rows = [];

  rows.push([
    cell('WEEKLY ACTIVITY SUMMARY', true, COLORS.hotelBg, COLORS.hotelFg, false, 'left'),
    cell('', false, COLORS.hotelBg, COLORS.hotelFg, false, 'left', false),
    cell('', false, COLORS.hotelBg, COLORS.hotelFg, false, 'left', false),
    cell(weekLabel, false, COLORS.hotelBg, COLORS.hotelFg, true, 'right', false),
  ]);
  rows.push(Array(4).fill(emptyCell()));

  // Header
  rows.push([
    cell('Hotel', true, COLORS.colHeaderBg, COLORS.colHeaderFg),
    cell('Group Bookings', true, COLORS.colHeaderBg, COLORS.colHeaderFg, false, 'right'),
    cell('Room Nights', true, COLORS.colHeaderBg, COLORS.colHeaderFg, false, 'right'),
    cell('Revenue ($)', true, COLORS.colHeaderBg, COLORS.colHeaderFg, false, 'right'),
  ]);

  let grandRN = 0, grandRev = 0, grandBookings = 0;

  hotelNames.forEach((hName, i) => {
    const bg = i % 2 === 0 ? COLORS.rowNormal : COLORS.rowAlt;
    const hp = allProduction.filter(p => getHotelName(p.hotel_id) === hName);
    const rn = hp.reduce((s, p) => s + (p.room_nights || 0), 0);
    const rev = hp.reduce((s, p) => s + (p.revenue || 0), 0);
    grandRN += rn; grandRev += rev; grandBookings += hp.length;
    rows.push([
      cell(hName, false, bg),
      cell(hp.length, false, bg, '000000', false, 'right'),
      cell(rn, false, bg, '000000', false, 'right'),
      cell(rev, false, bg, '000000', false, 'right'),
    ]);
  });

  rows.push([
    cell('GRAND TOTAL', true, COLORS.summaryBg, COLORS.summaryFg),
    cell(grandBookings, true, COLORS.summaryBg, COLORS.summaryFg, false, 'right'),
    cell(grandRN, true, COLORS.summaryBg, COLORS.summaryFg, false, 'right'),
    cell(grandRev, true, COLORS.summaryBg, COLORS.summaryFg, false, 'right'),
  ]);

  rows.push(Array(4).fill(emptyCell()));

  // RFP summary
  rows.push([
    cell(`Total RFPs This Week: ${allRFPs.length}`, false, null, COLORS.rfpBg, true),
    cell('', false), cell(''), cell(''),
  ]);
  rows.push([
    cell(`Total Activity Logs: ${allActivityLogs.length}`, false, null, COLORS.activityBg, true),
    cell(''), cell(''), cell(''),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(c => c.v)));
  rows.forEach((row, ri) => {
    row.forEach((c, ci) => {
      const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
      if (!ws[addr]) ws[addr] = {};
      ws[addr].s = c.s;
      ws[addr].t = c.t;
    });
  });
  ws['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 16 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
  ];
  return ws;
}

export default function WeeklyExportButton({ weekOffset = 0, hotels = [], allProduction = [], allRFPs = [], allActivityLogs = [] }) {
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`;

  const inWeek = (dateStr) => {
    if (!dateStr) return false;
    try { return isWithinInterval(parseISO(dateStr), { start: weekStart, end: weekEnd }); }
    catch { return false; }
  };

  const getHotelName = (id) => hotels.find(h => h.id === id)?.name || 'Unknown';

  const handleExport = () => {
    setLoading(true);
    setTimeout(() => {
      const weekProduction = allProduction.filter(p => inWeek(p.activity_date));
      const weekRFPs = allRFPs.filter(r => inWeek(r.created_date) || inWeek(r.submission_date));
      const weekActivityLogs = allActivityLogs.filter(a => inWeek(a.activity_date));

      // Group by hotel
      const hotelIds = [...new Set([
        ...weekProduction.map(p => p.hotel_id),
        ...weekRFPs.map(r => r.hotel_id),
        ...weekActivityLogs.map(a => a.hotel_id),
      ])].filter(Boolean);

      const hotelNames = hotelIds.map(id => getHotelName(id));

      const wb = XLSX.utils.book_new();

      // Summary sheet first
      const summaryWs = buildSummarySheet(weekLabel, hotelNames, weekProduction, weekRFPs, weekActivityLogs, getHotelName);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // One sheet per hotel
      hotelIds.forEach((hotelId) => {
        const hName = getHotelName(hotelId);
        const hp = weekProduction.filter(p => p.hotel_id === hotelId);
        const hr = weekRFPs.filter(r => r.hotel_id === hotelId);
        const ha = weekActivityLogs.filter(a => a.hotel_id === hotelId);
        const sheetName = hName.substring(0, 31).replace(/[\\/?*[\]]/g, '');
        const ws = buildHotelSheet(hName, weekLabel, hp, hr, ha);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });

      XLSX.writeFile(wb, `weekly-report-${format(weekStart, 'yyyy-MM-dd')}.xlsx`, { cellStyles: true });
      setLoading(false);
    }, 100);
  };

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md"
    >
      {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
      Export Weekly Report (.xlsx)
    </Button>
  );
}