/**
 * Import UMA/GRC XLSX — Bulk import hotel group bookings from Excel
 * Admin only. This is the largest Edge Function (~515 lines in original).
 *
 * POST /import-uma-grc-xlsx
 * Body: { file_url }
 * Returns: { success, created, updated, clients_auto_created, counts_by_record_type, diagnostics }
 *
 * ORIGINAL SOURCE: base44/functions/importUmaGrcXlsx/entry.ts
 * TODO: Port the full XLSX parsing logic from the original file.
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getUserFromRequest } from '../_shared/auth.ts';
// Uncomment when implementing XLSX parsing:
// import * as XLSX from 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const { supabaseAdmin } = getSupabaseClient(req);

    // Get user profile for role check
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

    if (!file_url) {
      return new Response(
        JSON.stringify({ error: 'file_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the file from Supabase Storage
    // The file_url is a public URL from the attachments bucket
    const fileResponse = await fetch(file_url);
    if (!fileResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${fileResponse.statusText}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileBuffer = await fileResponse.arrayBuffer();

    // =========================================================================
    // TODO: Port the full XLSX parsing logic from the original Base44 function.
    //
    // Original file: base44/functions/importUmaGrcXlsx/entry.ts (~515 lines)
    //
    // The original logic:
    // 1. Parse XLSX workbook using SheetJS
    // 2. Detect section headers (Definite, Tentative, Prospect, Actual Pickup)
    // 3. Extract daily rooms, rates, arrival/departure dates per booking
    // 4. Normalize data across multiple sheets
    // 5. Fetch existing ProductionItem records for upsert matching
    // 6. Fetch/create Client records by company name
    // 7. Batch upsert: create new, update existing, delete removed records
    // 8. Return detailed import statistics
    //
    // Key Supabase queries needed:
    //   supabaseAdmin.from('production_items').select('*').eq('hotel_id', hotelId)
    //   supabaseAdmin.from('clients').select('*')
    //   supabaseAdmin.from('production_items').insert(...)
    //   supabaseAdmin.from('production_items').update(...).eq('id', ...)
    //   supabaseAdmin.from('production_items').delete().eq('id', ...)
    //   supabaseAdmin.from('clients').insert(...)
    // =========================================================================

    // Placeholder response — replace with actual import results
    return new Response(
      JSON.stringify({
        success: false,
        error: 'XLSX import not yet implemented. See TODO in source.',
        file_size: fileBuffer.byteLength,
        created: 0,
        updated: 0,
        clients_auto_created: 0,
        counts_by_record_type: {},
        diagnostics: {
          message: 'Port the parsing logic from base44/functions/importUmaGrcXlsx/entry.ts',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
