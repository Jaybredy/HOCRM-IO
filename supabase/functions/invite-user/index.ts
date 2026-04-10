/**
 * Invite User — Creates a Supabase Auth account + users table row.
 * Admin only.
 *
 * POST /invite-user
 * Body: { email, role, full_name? }
 * Returns: { success, user }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getUserFromRequest } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authUser = await getUserFromRequest(req);
    const { supabaseAdmin } = getSupabaseClient(req);

    // Check caller is admin
    const { data: callerProfile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('email', authUser.email)
      .single();

    const callerRole = callerProfile?.role;
    if (callerRole !== 'admin' && callerRole !== 'EPIC_ADMIN' && callerRole !== 'hotel_manager') {
      return new Response(
        JSON.stringify({ error: 'Only admins and hotel managers can invite users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, role = 'user', full_name } = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists in users table
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase Auth user with a temporary password
    // The user will receive an email to set their password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: full_name || '', role },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: `Auth error: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create users table row
    const { data: userRow, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        email,
        full_name: full_name || '',
        role,
        display_name: full_name || email.split('@')[0],
      })
      .select()
      .single();

    if (insertError) {
      // Rollback: delete the auth user if table insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id).catch(() => {});
      return new Response(
        JSON.stringify({ error: `Database error: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a password reset link so the user can set their password
    const { data: resetData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    return new Response(
      JSON.stringify({
        success: true,
        user: userRow,
        magic_link: resetData?.properties?.action_link || null,
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
