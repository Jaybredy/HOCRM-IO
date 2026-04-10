import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as XLSX from 'npm:xlsx@0.18.5';

const HOTEL_ID = '699773a2a2b93e6ce09fb42c';

function parseNum(val) {
  const n = parseFloat(String(val || '').replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseDate(val) {
  if (!val) return null;
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

// Classify a cell value as a section header, returns recordType or null
function classifySectionHeader(cellVal) {
  if (!cellVal) return null;
  const u = String(cellVal).trim().toLowerCase().replace(/[\s\/\-]+/g, '');
  if (u === 'definite' || u === 'definites') return 'definite';
  if (u === 'tentative' || u === 'tentatives') return 'tentative';
  if (u === 'prospect' || u === 'prospects') return 'prospect';
  if (u === 'actual' || u === 'actuals' || u === 'pickup' || u === 'actualpickup' || u === 'actualpickup' || u === 'actual/pickup' || u === 'actualpickup(definites)' || u === 'actual/pickup(definites)') return 'actual_pickup';
  return null;
}

const RECORD_TYPE_STATUS = {
  definite: 'definite',
  tentative: 'tentative',
  prospect: 'prospect',
  actual_pickup: 'definite',
};

function mergeDailyRooms(existing, incoming) {
  const merged = { ...(existing || {}) };
  for (const [k, v] of Object.entries(incoming || {})) {
    if (typeof v === 'number' && v > 0) merged[k] = v;
  }
  return merged;
}

// Parse a section-based sheet. Returns array of data rows with { clientName, recordType, sourceSection, arrival_date, departure_date, cutoff_date, cutoff_text, daily_rooms, daily_rates, room_nights, revenue }
function parseSheet(sheet, sheetName) {
  // Get raw rows as arrays (no header parsing yet)
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  const dataRows = [];
  let currentRecordType = null;
  let currentSourceSection = null;
  let dayNumberRow = null; // array of day numbers mapping col index -> day number
  let dayRowIndex = -1;   // row index of the day-number header row
  let headerColMap = null; // { groupNameCol, arrivalCol, departureCol, cutoffCol, rateCol, adrCol }

  // Try to detect the sheet's year from sheet name (e.g. "Jan 2026", "January 2026", or just "Jan")
  const currentYear = new Date().getFullYear();
  let sheetYear = currentYear;
  const yearMatch = sheetName.match(/\b(20\d{2})\b/);
  if (yearMatch) sheetYear = parseInt(yearMatch[1]);

  // Detect month from sheet name
  const MONTH_NAMES = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  let sheetMonthIdx = -1;
  const snLower = sheetName.toLowerCase();
  for (let m = 0; m < MONTH_NAMES.length; m++) {
    if (snLower.startsWith(MONTH_NAMES[m]) || snLower.includes(MONTH_NAMES[m])) {
      sheetMonthIdx = m;
      break;
    }
  }

  // Helper: find column index by header text (case-insensitive partial match)
  function findCol(headerRow, ...candidates) {
    if (!headerRow) return -1;
    for (let c = 0; c < headerRow.length; c++) {
      const cell = String(headerRow[c] || '').trim().toLowerCase();
      for (const cand of candidates) {
        if (cell.includes(cand.toLowerCase())) return c;
      }
    }
    return -1;
  }

  // Detect if a row is a section header: majority of cells are blank and first non-blank cell matches a section keyword
  function detectSectionHeader(row) {
    const nonBlanks = row.filter(c => c !== null && String(c).trim() !== '');
    if (nonBlanks.length === 0 || nonBlanks.length > 4) return null;
    // Check first non-blank value
    const firstVal = String(row.find(c => c !== null && String(c).trim() !== '') || '').trim();
    return classifySectionHeader(firstVal);
  }

  // Detect if a row is a "TOTAL" summary row to skip
  const TOTAL_PATTERNS = /^total(\s+(definites?|tentatives?|prospects?|pick\s*up|pickups?))?$/i;
  function isTotalRow(row) {
    return row.some(c => {
      const s = String(c || '').trim();
      return TOTAL_PATTERNS.test(s) || s.toUpperCase() === 'TOTAL';
    });
  }

  // Detect if a row looks like a day-number header (contains multiple small integers 1-31)
  function detectDayNumberRow(row) {
    const dayNums = row.map(c => {
      const n = parseFloat(String(c || '').trim());
      return (!isNaN(n) && Number.isInteger(n) && n >= 1 && n <= 31) ? n : null;
    });
    const count = dayNums.filter(Boolean).length;
    return count >= 10 ? dayNums : null; // must have at least 10 day columns
  }

  // Detect if a row looks like the weekday name header (contains Thu, Fri, etc.)
  function isWeekdayRow(row) {
    const days = ['mon','tue','wed','thu','fri','sat','sun'];
    const matches = row.filter(c => {
      const s = String(c || '').trim().toLowerCase().substring(0, 3);
      return days.includes(s);
    });
    return matches.length >= 5;
  }

  for (let rowIdx = 0; rowIdx < rawRows.length; rowIdx++) {
    const row = rawRows[rowIdx];
    if (!row || row.every(c => c === null || String(c).trim() === '')) continue;

    // Check for section header
    const sectionType = detectSectionHeader(row);
    if (sectionType) {
      currentRecordType = sectionType;
      currentSourceSection = String(row.find(c => c !== null && String(c).trim() !== '') || '').trim();
      // Reset header detection so we re-find headers after each section
      dayNumberRow = null;
      dayRowIndex = -1;
      headerColMap = null;
      continue;
    }

    // Skip total rows
    if (isTotalRow(row)) continue;

    // Skip weekday header rows
    if (isWeekdayRow(row)) continue;

    // Check if this is a day-number row (header row with 1..31)
    const dayNums = detectDayNumberRow(row);
    if (dayNums) {
      dayNumberRow = dayNums;
      dayRowIndex = rowIdx;
      // Also detect text column positions from this row or the previous row
      // Look back up to 3 rows for a row with 'Group Name' etc.
      let textHeaderRow = null;
      for (let back = 1; back <= 4; back++) {
        const candidate = rawRows[rowIdx - back];
        if (!candidate) continue;
        const hasGroup = candidate.some(c => String(c || '').toLowerCase().includes('group'));
        if (hasGroup) { textHeaderRow = candidate; break; }
      }
      if (!textHeaderRow) {
        // Try this row itself or next row for text headers
        const nextRow = rawRows[rowIdx + 1];
        if (nextRow && nextRow.some(c => String(c || '').toLowerCase().includes('group'))) {
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

    // If we have no current section, skip
    if (!currentRecordType) continue;

    // Determine group name
    let clientName = null;
    if (headerColMap && headerColMap.groupNameCol >= 0) {
      clientName = String(row[headerColMap.groupNameCol] || '').trim();
    } else {
      // Fallback: first non-blank string cell
      for (const c of row) {
        const s = String(c || '').trim();
        if (s && isNaN(parseFloat(s))) { clientName = s; break; }
      }
    }
    if (!clientName) continue;
    // Skip if group name looks like a section header or total
    if (classifySectionHeader(clientName) || clientName.toUpperCase().includes('TOTAL')) continue;

    // Build daily_rooms from day column positions
    const daily_rooms = {};
    const daily_rates = {};
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

    // Arrival / departure
    let arrivalDate = null;
    let departureDate = null;
    if (headerColMap) {
      if (headerColMap.arrivalCol >= 0) arrivalDate = parseDate(row[headerColMap.arrivalCol]);
      if (headerColMap.departureCol >= 0) departureDate = parseDate(row[headerColMap.departureCol]);
    }

    // Infer arrival/departure from daily_rooms if not found
    if (!arrivalDate && Object.keys(daily_rooms).length > 0) {
      const dates = Object.keys(daily_rooms).sort();
      arrivalDate = dates[0];
      // departure = last date + 1 day
      const lastDate = new Date(dates[dates.length - 1]);
      lastDate.setDate(lastDate.getDate() + 1);
      departureDate = lastDate.toISOString().split('T')[0];
    }

    if (!arrivalDate || Object.keys(daily_rooms).length === 0) continue;

    // Cutoff — always store raw text; only populate cutoff_date if parsing succeeds
    let cutoffDate = null;
    let cutoffText = null;
    if (headerColMap && headerColMap.cutoffCol >= 0) {
      const rawCutoff = row[headerColMap.cutoffCol];
      if (rawCutoff !== null && String(rawCutoff).trim() !== '') {
        cutoffText = String(rawCutoff).trim();
        cutoffDate = parseDate(rawCutoff); // may be null if unparseable — that's fine
      }
    }

    const monthStr = arrivalDate.substring(0, 7);
    const totalRoomNights = Object.values(daily_rooms).reduce((s, v) => s + v, 0);
    
    // Try to get revenue directly from the spreadsheet
    let revenue = 0;
    if (headerColMap) {
      const revenueCol = findCol(rawRows[dayRowIndex - 1] || [], 'revenue', 'rev');
      if (revenueCol >= 0) {
        revenue = parseNum(row[revenueCol]);
      }
    }
    // Fallback to ADR calculation if no revenue column found
    if (revenue === 0 && adr > 0) {
      revenue = Math.round(totalRoomNights * adr);
    }
    
    const normalizedStatus = RECORD_TYPE_STATUS[currentRecordType] || 'definite';

    dataRows.push({
      clientName,
      recordType: currentRecordType,
      sourceSection: currentSourceSection,
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
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const fileUrl = body.file_url;
    if (!fileUrl) {
      return Response.json({ error: 'file_url required' }, { status: 400 });
    }

    const fileResp = await fetch(fileUrl);
    if (!fileResp.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: 500 });
    }
    const fileBuffer = await fileResp.arrayBuffer();
    const workbook = XLSX.read(fileBuffer, { type: 'array' });

    // Pre-load existing records and clients
    const existingItems = await base44.asServiceRole.entities.ProductionItem.filter({ hotel_id: HOTEL_ID });
    const existingClients = await base44.asServiceRole.entities.Client.list();
    const clientMap = {};
    for (const c of existingClients) {
      if (c.company_name) clientMap[c.company_name.toLowerCase().trim()] = c.id;
    }

    // -------------------------------------------------------
    // GUARDRAIL: Delete existing records with blank/null client_name
    // -------------------------------------------------------
    const blankNameRecords = existingItems.filter(item =>
      !item.client_name || String(item.client_name).trim() === ''
    );
    for (const item of blankNameRecords) {
      try { await base44.asServiceRole.entities.ProductionItem.delete(item.id); } catch (_) {}
    }

    // -------------------------------------------------------
    // PASS 1: Parse all sheets → build winner map
    // Key = HOTEL_ID|YYYY-MM|clientNameLower|recordType
    // -------------------------------------------------------
    const TOTAL_ROW_PATTERNS = /^total(\s+(definites?|tentatives?|prospects?|pick\s*up|pickups?))?$/i;

    const winnerMap = {};
    let skipped_rows_count = 0;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = parseSheet(sheet, sheetName);

      for (const row of rows) {
        // Guardrail 1: skip blank group name
        if (!row.clientName || String(row.clientName).trim() === '') {
          skipped_rows_count++;
          continue;
        }
        // Guardrail 2: skip TOTAL rows
        if (TOTAL_ROW_PATTERNS.test(String(row.clientName).trim())) {
          skipped_rows_count++;
          continue;
        }
        if (Object.keys(row.daily_rooms).length === 0) {
          skipped_rows_count++;
          continue;
        }

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
          // Use the revenue from the most recent row (last occurrence wins)
          if (row.revenue > 0) existing.revenue = row.revenue;
        }
      }
    }

    // -------------------------------------------------------
    // PASS 2: Auto-create missing clients
    // -------------------------------------------------------
    const clientsBeforeCount = Object.keys(clientMap).length;
    for (const entry of Object.values(winnerMap)) {
      const clientKey = entry.clientName.toLowerCase();
      if (!clientMap[clientKey]) {
        const newClient = await base44.asServiceRole.entities.Client.create({
          company_name: entry.clientName,
          status: 'new_lead',
        });
        clientMap[clientKey] = newClient.id;
      }
    }
    const clients_auto_created = Object.keys(clientMap).length - clientsBeforeCount;

    // -------------------------------------------------------
    // PASS 3: Upsert to DB (batched)
    // -------------------------------------------------------
    let created = 0;
    let updated = 0;

    const toCreate = [];
    const toUpdate = []; // { id, payload }
    const toDelete = []; // ids

    for (const [_key, entry] of Object.entries(winnerMap)) {
      const clientKey = entry.clientName.toLowerCase();

      const dbMatches = existingItems.filter(item =>
        item.hotel_id === HOTEL_ID &&
        item.client_name?.toLowerCase().trim() === clientKey &&
        item.arrival_date?.startsWith(entry.monthStr) &&
        (item.record_type === entry.recordType ||
          (!item.record_type && item.status === entry.normalizedStatus && entry.recordType !== 'actual_pickup'))
      );

      const clientId = clientMap[clientKey] || null;

      const writePayload = {
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

    // Execute in parallel batches of 10
    const BATCH = 10;
    for (let i = 0; i < toCreate.length; i += BATCH) {
      await Promise.all(toCreate.slice(i, i + BATCH).map(p =>
        base44.asServiceRole.entities.ProductionItem.create(p)
      ));
      created += Math.min(BATCH, toCreate.length - i);
    }
    for (let i = 0; i < toUpdate.length; i += BATCH) {
      await Promise.all(toUpdate.slice(i, i + BATCH).map(({ id, payload }) =>
        base44.asServiceRole.entities.ProductionItem.update(id, payload)
      ));
      updated += Math.min(BATCH, toUpdate.length - i);
    }
    for (let i = 0; i < toDelete.length; i += BATCH) {
      await Promise.all(toDelete.slice(i, i + BATCH).map(id =>
        base44.asServiceRole.entities.ProductionItem.delete(id).catch(() => {})
      ));
    }

    // -------------------------------------------------------
    // PASS 4: Diagnostics
    // -------------------------------------------------------
    const touchedMonths = new Set(Object.values(winnerMap).map(e => e.monthStr));
    const allItems = await base44.asServiceRole.entities.ProductionItem.filter({ hotel_id: HOTEL_ID });
    const diagnosticItems = allItems.filter(item =>
      item.arrival_date && touchedMonths.has(item.arrival_date.substring(0, 7))
    );

    const counts_by_record_type = { definite: 0, tentative: 0, prospect: 0, actual_pickup: 0, unset: 0 };
    for (const item of diagnosticItems) {
      const rt = item.record_type || 'unset';
      if (rt in counts_by_record_type) counts_by_record_type[rt]++;
      else counts_by_record_type.unset++;
    }

    return Response.json({
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
    });

  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});