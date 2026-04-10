/**
 * Link Past Bookings to Clients
 * Matches production_items without client_id to clients by normalized company_name.
 * Admin only.
 *
 * POST /link-past-bookings-to-clients
 * Returns: { success, total_bookings_checked, linked, not_found, not_found_details }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getUserFromRequest } from '../_shared/auth.ts';

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
    const resolvedRole = role === 'admin' ? 'EPIC_ADMIN' : role;

    if (resolvedRole !== 'EPIC_ADMIN' && role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all bookings created by ayesha@epic-rev.com
    const { data: allBookings, error: bookingsError } = await supabaseAdmin
      .from('production_items')
      .select('id, client_id, client_name, arrival_date')
      .eq('created_by', 'ayesha@epic-rev.com');

    if (bookingsError) throw bookingsError;

    const bookingsWithoutClientId = (allBookings || []).filter(b => !b.client_id);

    // Get all clients
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, company_name');

    if (clientsError) throw clientsError;

    // Build normalized name → id map
    const clientMap = new Map<string, string>();
    (clients || []).forEach(client => {
      const normalized = client.company_name?.toLowerCase().trim();
      if (normalized) {
        clientMap.set(normalized, client.id);
      }
    });

    let linked = 0;
    const notFound: Array<{ booking_id: string; client_name: string; arrival_date: string }> = [];

    // Link bookings to clients by name match
    for (const booking of bookingsWithoutClientId) {
      const bookingClientName = booking.client_name?.toLowerCase().trim();

      if (bookingClientName && clientMap.has(bookingClientName)) {
        const clientId = clientMap.get(bookingClientName)!;
        const { error: updateError } = await supabaseAdmin
          .from('production_items')
          .update({ client_id: clientId })
          .eq('id', booking.id);

        if (!updateError) {
          linked++;
        }
      } else if (bookingClientName) {
        notFound.push({
          booking_id: booking.id,
          client_name: booking.client_name,
          arrival_date: booking.arrival_date,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_bookings_checked: bookingsWithoutClientId.length,
        linked,
        not_found: notFound.length,
        not_found_details: notFound,
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
