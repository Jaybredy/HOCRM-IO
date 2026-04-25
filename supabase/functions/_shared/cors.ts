// CORS helpers.
//
// Set the ALLOWED_ORIGIN secret to a comma-separated list of origins, e.g.
//   ALLOWED_ORIGIN=https://hocrm-io.vercel.app,http://localhost:5173
// The helper echoes back whichever configured origin matches the incoming
// request's Origin header. If nothing matches, it falls back to the first
// entry (so preflight still succeeds for the primary origin).

const RAW = Deno.env.get('ALLOWED_ORIGIN') || 'https://hocrm-io.vercel.app';
const ALLOWED_ORIGINS = RAW.split(',').map((s) => s.trim()).filter(Boolean);

function resolveOrigin(req?: Request): string {
  const incoming = req?.headers.get('Origin') ?? null;
  if (incoming && ALLOWED_ORIGINS.includes(incoming)) return incoming;
  return ALLOWED_ORIGINS[0];
}

// Static form — used by existing call sites that don't pass the request in.
// This returns headers keyed to the primary origin; preflight still works
// because we echo the matched origin back from corsHeadersFor(req) below.
export const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0],
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Preferred form — pass the request to get headers that echo the matched origin.
export function corsHeadersFor(req: Request) {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(req),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}
