import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function getSupabaseClient(req: Request) {
  const authHeader = req.headers.get('Authorization');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Client with user's JWT for RLS
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader ?? '' } },
  });

  // Service role client for admin operations (bypasses RLS)
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  return { supabaseUser, supabaseAdmin };
}

export async function getUserFromRequest(req: Request) {
  const { supabaseUser } = getSupabaseClient(req);
  const { data: { user }, error } = await supabaseUser.auth.getUser();
  if (error || !user) throw new Error('Unauthorized');
  return user;
}
