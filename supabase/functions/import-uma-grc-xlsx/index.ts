/**
 * Import UMA/GRC XLSX — Bulk import hotel group bookings from Excel.
 * Admin only.
 *
 * POST /import-uma-grc-xlsx
 * Body: { file_url, hotel_id? }
 * Returns: { success, created, updated, clients_auto_created, skipped_rows_count,
 *            blank_name_records_deleted, counts_by_record_type, diagnostics }
 *
 * Ported from base44/functions/importUmaGrcXlsx/entry.ts
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getUserFromRequest } from '../_shared/auth.ts';
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

const DEFAULT_HOTEL_ID = '699773a2a2b93e6ce09fb42c';

function parseNum(val: unknown): number {
  const n = parseFloat(String(val ?? '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function classifySectionHeader(cellVal: unknown): string | null {
  if (!cellVal) return null;
  const u = String(cellVal).trim().toLowerCase().replace(/[\s\/\-]+/g, '');
  if (u === 'definite' || u === 'definites') return 'definite';
  if (u === 'tentative' || u === 'tentatives') return 'tentative';
  if (u === 'prospect' || u === 'prospects') return 'prospect';
  if (
    u === 'actual' || u === 'actuals' || u === 'pickup' || u === 'actualpickup' ||
    u === 'actual/pickup' || u === 'actualpickup(definites)' || u === 'actual/pickup(definites)'
  ) return 'actual_pickup';
  return null;
}

const RECORD_TYPE_STATUS: Record<string, string> = {
  definite: 'definite',
  tentative: 'tentative',
  prospect: 'prospect',
  actual_pickup: 'definite',
};

function mergeDailyRooms(existing: Record<string, number> | null | undefined, incoming: Record<string, number> | null | undefined): Record<string, number> {
  const merged: Record<string, number> = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (typeof v === 'number' && v > 0) merged[k] = v;
  }
  return merged;
}

interface ParsedRow {
  clientName: string;
  recordType: string;
  sourceSection: string;
  normalizedStatus: string;
  arrival_date: string;
  departure_date: string | null;
  cutoff_date: string | null;
  cutoff_text: string | null;
  daily_rooms: Record<string, number>;
  daily_rates: Record<string, number>;
  room_nights: number;
  revenue: number;
  monthStr: string;
  sheetName: string;
}

function parseSheet(sheet: XLSX.WorkSheet, sheetName: string): ParsedRow[] {
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const dataRows: ParsedRow[] = [];
  let currentRecordType: string | null = null;
  let currentSourceSection: string | null = null;
  let dayNumberRow: (number | null)[] | null = null;
  let dayRowIndex = -1;
  let headerColMap: {
    groupNameCol: number;
    arrivalCol: number;
    departureCol: number;
    cutoffCol: number;
    rateCol: number;
    adrCol: number;
  } | null = null;

  const currentYear = new Date().getFullYear();
  let sheetYear = currentYear;
  const yearMatch = sheetName.match(/\b(20\d{2})\b/);
  if (yearMatch) sheetYear = parseInt(yearMatch[1]);

  const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  let sheetMonthIdx = -1;
  const snLower = sheetName.toLowerCase();
  for (let m = 0; m < MONTH_NAMES.length; m++) {
    if (snLower.startsWith(MONTH_NAMES[m]) || snLower.includes(MONTH_NAMES[m])) {
      sheetMonthIdx = m;
      break;
    }
  }

  function findCol(headerRow: any[], ...candidates: string[]): number {
    if (!headerRow) return -1;
    for (let c = 0; c < headerRow.length; c++) {
      const cell = String(headerRow[c] ?? '').trim().toLowerCase();
      for (const cand of candidates) {
        if (cell.includes(cand.toLowerCase())) return c;
      }
    }
    return -1;
  }

  function detectSectionHeader(row: any[]): string | null {
    const nonBlanks = row.filter(c => c !== null && String(c).trim() !== '');
    if (nonBlanks.length === 0 || nonBlanks.length > 4) return null;
    const firstVal = String(row.find(c => c !== null && String(c).trim() !== '') ?? '').trim();
    return classifySectionHeader(firstVal);
  }

  const TOTAL_PATTERNS = /^total(\s+(definites?|tentatives?|prospects?|pick\s*up|pickups?))?$/i;
  function isTotalRow(row: any[]): boolean {
    return row.some(c => {
      const s = String(c ?? '').trim();
      return TOTAL_PATTERNS.test(s) || s.toUpperCase() === 'TOTAL';
    });
  }

  function detectDayNumberRow(row: any[]): (number | null)[] | null {
    const dayNums = row.map(c => {
      const n = parseFloat(String(c ?? '').trim());
      return (!isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 31) ? n : null;
    });
    const count = dayNums.filter(Boolean).length;
    return count >= 10 ? dayNums : null;
  }

  function isWeekdayRow(row: any[]): boolean {
    const days = ['mon','tue','wed','thu','fri','sat','sun'];
    const matches = row.filter(c => {
      const s = String(c ?? '').trim().toLowerCase().substring(0, 3);
      return days.includes(s);
    });
    return matches.length >= 5;
  }

  for (let rowIdx = 0; rowIdx < rawRows.length; rowIdx++) {
    const row = rawRows[rowIdx];
    if (!row || row.every(c => c === null || String(c).trim() === '')) continue;

    const sectionType = detectSectionHeader(row);
    if (sectionType) {
      currentRecordType = sectionType;
      currentSourceSection = String(row.find(c => c !== null && String(c).trim() !== '') ?? '').trim();
      dayNumberRow = null;
      dayRowIndex = -1;
      headerColMap = null;
      continue;
    }

    if (isTotalRow(row)) continue;
    if (isWeekdayRow(row)) continue;

    const dayNums = detectDayNumberRow(row);
    if (dayNums) {
      dayNumberRow = dayNums;
      dayRowIndex = rowIdx;
      let textHeaderRow: any[] | null = null;
      for (let back = 1; back <= 4; back++) {
        const candidate = rawRows[rowIdx - back];
        if (!candidate) continue;
        const hasGroup = candidate.some(c => String(c ?? '').toLowerCase().includes('group'));
        if (hasGroup) { textHeaderRow = candidate; break; }
      }
      if (!textHeaderRow) {
        const nextRow = rawRows[rowIdx + 1];
        if (nextRow && nextRow.some(c => String(c ?? '').toLowerCase().includes('group'))) {
          textHeaderRow = nextRow;
        }
      }
      if (textHeaderRow) {
        headerColMap = {
          groupNameCol: findCol(textHeaderRow, 'group name', 'group'),
          arrivalCol: findCol(textHeaderRow, 'arrival', 'arrive', 'check in'),
          departureCol: findCol(textHeaderRow, 'departure', 'depart', 'check out'),
          cutoffCol: findCol(textHeaderRow, 'cut off', 'cutoff'),
          rateCol: findCol(textHeaderRow, 'rate'),
          adrCol: findCol(textHeaderRow, 'adr'),
        };
      }
      continue;
    }

    if (!currentRecordType) continue;

    let clientName: string | null = null;
    if (headerColMap && headerColMap.groupNameCol >= 0) {
      clientName = String(row[headerColMap.groupNameCol] ?? '').trim();
    } else {
      for (const c of row) {
        const s = String(c ?? '').trim();
        if (s && isNaN(parseFloat(s))) { clientName = s; break; }
      }
    }
    if (!clientName) continue;
    if (classifySectionHeader(clientName) || clientName.toUpperCase().includes('TOTAL')) continue;

    const daily_rooms: Record<string, number> = {};
    const daily_rates: Record<string, number> = {};
    let rate = 0;
    let adr = 0;

    if (headerColMap) {
      rate = parseNum(headerColMap.rateCol >= 0 ? row[headerColMap.rateCol] : null);
      adr = parseNum(headerColMap.adrCol >= 0 ? row[headerColMap.adrCol] : null) || rate;
    }

    if (dayNumberRow && sheetMonthIdx >= 0) {
      for (let c = 0; c < dayNumberRow.length; c++) {
        const dayNum = dayNumberRow[c];
        if (!dayNum) continue;
        const val = parseNum(row[c]);
        if (val > 0) {
          const dateStr = `${sheetYear}-${String(sheetMonthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          daily_rooms[dateStr] = val;
          if (rate > 0) daily_rates[dateStr] = rate;
        }
      }
    }

    let arrivalDate: string | null = null;
    let departureDate: string | null = null;
    if (headerColMap) {
      if (headerColMap.arrivalCol >= 0) arrivalDate = parseDate(row[headerColMap.arrivalCol]);
      if (headerColMap.departureCol >= 0) departureDate = parseDate(row[headerColMap.departureCol]);
    }

    if (!arrivalDate && Object.keys(daily_rooms).length > 0) {
      const dates = Object.keys(daily_rooms).sort();
      arrivalDate = dates[0];
      const lastDate = new Date(dates[dates.length - 1]);
      lastDate.setDate(lastDate.getDate() + 1);
      departureDate = lastDate.toISOString().split('T')[0];
    }

    if (!arrivalDate || Object.keys(daily_rooms).length === 0) continue;

    let cutoffDate: string | null = null;
    let cutoffText: string | null = null;
    if (headerColMap && headerColMap.cutoffCol >= 0) {
      const rawCutoff = row[headerColMap.cutoffCol];
      if (rawCutoff !== null && String(rawCutoff).trim() !== '') {
        cutoffText = String(rawCutoff).trim();
        cutoffDate = parseDate(rawCutoff);
      }
    }

    const monthStr = arrivalDate.substring(0, 7);
    const totalRoomNights = Object.values(daily_rooms).reduce((s, v) => s + v, 0);

    let revenue = 0;
    if (headerColMap) {
      const revenueCol = findCol(rawRows[dayRowIndex - 1] || [], 'revenue', 'rev');
      if (revenueCol >= 0) {
        revenue = parseNum(row[revenueCol]);
      }
    }
    if (revenue === 0 && adr > 0) {
      revenue = Math.round(totalRoomNights * adr);
    }

    const normalizedStatus = RECORD_TYPE_STATUS[currentRecordType] || 'definite';

    dataRows.push({
      clientName,
      recordType: currentRecordType,
      sourceSection: currentSourceSection ?? '',
      normalizedStatus,
      arrival_date: arrivalDate,
      departure_date: departureDate,
      cutoff_date: cutoffDate,
      cutoff_text: cutoffText,
      daily_rooms,
      daily_rates,
      room_nights: totalRoomNights,
      revenue,
      monthStr,
      sheetName,
    });
  }

  return dataRows;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const { supabaseAdmin } = getSupabaseClient(req);

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('email', user.email)
      .single();

    const role = profile?.role || 'CLIENT_VIEWER';
    if (role !== 'admin' && role !== 'EPIC_ADMIN') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { file_url } = body;
    const HOTEL_ID: string = body.hotel_id || DEFAULT_HOTEL_ID;

    if (!file_url) {
      return new Response(
        JSON.stringify({ error: 'file_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${fileResponse.statusText}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const fileBuffer = await fileResponse.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(fileBuffer), { type: 'array' });

    const { data: existingItemsData, error: itemsErr } = await supabaseAdmin
      .from('production_items')
      .select('*')
      .eq('hotel_id', HOTEL_ID);
    if (itemsErr) throw itemsErr;
    const existingItems: any[] = existingItemsData || [];

    const { data: existingClientsData, error: clientsErr } = await supabaseAdmin
      .from('clients')
      .select('id, company_name');
    if (clientsErr) throw clientsErr;
    const clientMap: Record<string, string> = {};
    for (const c of (existingClientsData || [])) {
      if (c.company_name) clientMap[c.company_name.toLowerCase().trim()] = c.id;
    }

    // Guardrail: delete existing records with blank client_name
    const blankNameRecords = existingItems.filter(item =>
      !item.client_name || String(item.client_name).trim() === ''
    );
    for (const item of blankNameRecords) {
      try {
        await supabaseAdmin.from('production_items').delete().eq('id', item.id);
      } catch (_) { /* ignore */ }
    }

    // PASS 1: Parse all sheets → build winner map
    const TOTAL_ROW_PATTERNS = /^total(\s+(definites?|tentatives?|prospects?|pick\s*up|pickups?))?$/i;
    const winnerMap: Record<string, ParsedRow> = {};
    let skipped_rows_count = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = parseSheet(sheet, sheetName);

      for (const row of rows) {
        if (!row.clientName || String(row.clientName).trim() === '') { skipped_rows_count++; continue; }
        if (TOTAL_ROW_PATTERNS.test(String(row.clientName).trim())) { skipped_rows_count++; continue; }
        if (Object.keys(row.daily_rooms).length === 0) { skipped_rows_count++; continue; }

        const key = `${HOTEL_ID}|${row.monthStr}|${row.clientName.toLowerCase()}|${row.recordType}`;

        if (!winnerMap[key]) {
          winnerMap[key] = { ...row };
        } else {
          const existing = winnerMap[key];
          existing.daily_rooms = mergeDailyRooms(existing.daily_rooms, row.daily_rooms);
          existing.daily_rates = mergeDailyRooms(existing.daily_rates, row.daily_rates);
          if (row.arrival_date) existing.arrival_date = row.arrival_date;
          if (row.departure_date) existing.departure_date = row.departure_date;
          if (row.cutoff_date) existing.cutoff_date = row.cutoff_date;
          if (row.cutoff_text) existing.cutoff_text = row.cutoff_text;
          existing.room_nights = Object.values(existing.daily_rooms).reduce((s, v) => s + v, 0);
          if (row.revenue > 0) existing.revenue = row.revenue;
        }
      }
    }

    // PASS 2: Auto-create missing clients
    const clientsBeforeCount = Object.keys(clientMap).length;
    for (const entry of Object.values(winnerMap)) {
      const clientKey = entry.clientName.toLowerCase();
      if (!clientMap[clientKey]) {
        const { data: newClient, error: createErr } = await supabaseAdmin
          .from('clients')
          .insert({ company_name: entry.clientName, status: 'new_lead' })
          .select('id')
          .single();
        if (createErr) throw createErr;
        clientMap[clientKey] = newClient.id;
      }
    }
    const clients_auto_created = Object.keys(clientMap).length - clientsBeforeCount;

    // PASS 3: Upsert
    let created = 0;
    let updated = 0;

    const toCreate: any[] = [];
    const toUpdate: { id: string; payload: Record<string, unknown> }[] = [];
    const toDelete: string[] = [];

    for (const entry of Object.values(winnerMap)) {
      const clientKey = entry.clientName.toLowerCase();

      const dbMatches = existingItems.filter(item =>
        item.hotel_id === HOTEL_ID &&
        item.client_name?.toLowerCase().trim() === clientKey &&
        item.arrival_date?.startsWith(entry.monthStr) &&
        (item.record_type === entry.recordType ||
          (!item.record_type && item.status === entry.normalizedStatus && entry.recordType !== 'actual_pickup'))
      );

      const clientId = clientMap[clientKey] || null;

      const writePayload: Record<string, unknown> = {
        status: entry.normalizedStatus,
        record_type: entry.recordType,
        source_section: entry.sourceSection,
        client_id: clientId,
        daily_rooms: entry.daily_rooms,
        daily_rates: entry.daily_rates,
        room_nights: entry.room_nights,
        revenue: entry.revenue,
        accommodation_revenue: entry.revenue,
        arrival_date: entry.arrival_date,
        departure_date: entry.departure_date,
        cutoff_date: entry.cutoff_date || null,
        notes: `Imported from GRC - ${entry.sheetName} (${entry.recordType})`,
      };
      if (entry.cutoff_text) writePayload.cutoff_text = entry.cutoff_text;

      if (dbMatches.length > 0) {
        toUpdate.push({ id: dbMatches[0].id, payload: writePayload });
        for (let d = 1; d < dbMatches.length; d++) toDelete.push(dbMatches[d].id);
      } else {
        toCreate.push({
          hotel_id: HOTEL_ID,
          client_name: entry.clientName,
          event_type: 'group',
          seller_type: 'hotel_sales',
          activity_date: entry.arrival_date,
          ...writePayload,
        });
      }
    }

    const BATCH = 10;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      const slice = toCreate.slice(i, i + BATCH);
      const { error } = await supabaseAdmin.from('production_items').insert(slice);
      if (error) throw error;
      created += slice.length;
    }
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      const slice = toUpdate.slice(i, i + BATCH);
      await Promise.all(slice.map(({ id, payload }) =>
        supabaseAdmin.from('production_items').update(payload).eq('id', id)
      ));
      updated += slice.length;
    }
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const slice = toDelete.slice(i, i + BATCH);
      await Promise.all(slice.map(id =>
        supabaseAdmin.from('production_items').delete().eq('id', id).then(() => {}, () => {})
      ));
    }

    // PASS 4: Diagnostics
    const touchedMonths = new Set(Object.values(winnerMap).map(e => e.monthStr));
    const { data: allItemsData } = await supabaseAdmin
      .from('production_items')
      .select('id, client_name, arrival_date, record_type')
      .eq('hotel_id', HOTEL_ID);
    const allItems: any[] = allItemsData || [];
    const diagnosticItems = allItems.filter(item =>
      item.arrival_date && touchedMonths.has(item.arrival_date.substring(0, 7))
    );

    const counts_by_record_type: Record<string, number> = {
      definite: 0, tentative: 0, prospect: 0, actual_pickup: 0, unset: 0,
    };
    for (const item of diagnosticItems) {
      const rt = item.record_type || 'unset';
      if (rt in counts_by_record_type) counts_by_record_type[rt]++;
      else counts_by_record_type.unset++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        created,
        updated,
        clients_auto_created,
        skipped_rows_count,
        blank_name_records_deleted: blankNameRecords.length,
        counts_by_record_type,
        diagnostics: {
          touched_months: [...touchedMonths].sort(),
          total_records_in_db_for_months: diagnosticItems.length,
          parsed_entries: Object.keys(winnerMap).length,
          sample_by_record_type: {
            definite: diagnosticItems.filter(i => i.record_type === 'definite').slice(0, 3).map(i => ({ name: i.client_name, arrival: i.arrival_date })),
            actual_pickup: diagnosticItems.filter(i => i.record_type === 'actual_pickup').slice(0, 3).map(i => ({ name: i.client_name, arrival: i.arrival_date })),
            tentative: diagnosticItems.filter(i => i.record_type === 'tentative').slice(0, 3).map(i => ({ name: i.client_name, arrival: i.arrival_date })),
            prospect: diagnosticItems.filter(i => i.record_type === 'prospect').slice(0, 3).map(i => ({ name: i.client_name, arrival: i.arrival_date })),
          },
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message, stack: (error as Error).stack }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
