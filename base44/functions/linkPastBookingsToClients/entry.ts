import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all bookings from ayesha@epic-rev.com that don't have a client_id
    const bookings = await base44.asServiceRole.entities.ProductionItem.filter({
      created_by: 'ayesha@epic-rev.com',
    });

    const bookingsWithoutClientId = bookings.filter(b => !b.client_id);

    // Get all clients
    const clients = await base44.asServiceRole.entities.Client.list();

    // Create a map of client names (normalized) to client IDs
    const clientMap = new Map();
    clients.forEach(client => {
      const normalized = client.company_name?.toLowerCase().trim();
      if (normalized) {
        clientMap.set(normalized, client.id);
      }
    });

    let linked = 0;
    let notFound = [];

    // Link bookings to clients based on client_name match
    for (const booking of bookingsWithoutClientId) {
      const bookingClientName = booking.client_name?.toLowerCase().trim();
      
      if (bookingClientName && clientMap.has(bookingClientName)) {
        const clientId = clientMap.get(bookingClientName);
        await base44.asServiceRole.entities.ProductionItem.update(booking.id, {
          client_id: clientId
        });
        linked++;
      } else if (bookingClientName) {
        notFound.push({
          booking_id: booking.id,
          client_name: booking.client_name,
          arrival_date: booking.arrival_date
        });
      }
    }

    return Response.json({
      success: true,
      total_bookings_checked: bookingsWithoutClientId.length,
      linked: linked,
      not_found: notFound.length,
      not_found_details: notFound
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});