const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://hocrm-io.vercel.app';

export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
