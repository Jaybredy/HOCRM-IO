/**
 * AI Gateway — EPIC_ADMIN only, rate-limited, audited.
 * POST /ai-gateway
 * Body: { prompt, response_json_schema?, add_context_from_internet?, file_urls? }
 * Returns: { result }
 */

import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient, getUserFromRequest } from '../_shared/auth.ts';

const DAILY_LIMIT = 50;

async function getDailyUsage(supabaseAdmin: any, email: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count } = await supabaseAdmin
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', email)
    .eq('action', 'ai_gateway_call')
    .gte('created_at', `${today}T00:00:00Z`);
  return count ?? 0;
}

function mapLegacyRole(role: string | undefined): string {
  if (!role) return 'CLIENT_VIEWER';
  if (role === 'admin') return 'EPIC_ADMIN';
  if (role === 'user') return 'CLIENT_EDITOR';
  return role;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await getUserFromRequest(req);
    const { supabaseAdmin } = getSupabaseClient(req);
    const email = user.email ?? 'unknown';

    // Get role from users table
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('email', email)
      .single();

    const role = mapLegacyRole(profile?.role);

    // Hard block: only EPIC_ADMIN
    if (role !== 'EPIC_ADMIN') {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_email: email, actor_role: role,
          action: 'AI_CALL_BLOCKED',
          details: `AI access denied for role ${role}`,
          success: false,
        });
      } catch { /* audit log failures must not block the response */ }

      return json({ error: 'AI_USE is restricted to EPIC_ADMIN only' }, 403);
    }

    // Rate limit check (persisted to audit_logs)
    const current = await getDailyUsage(supabaseAdmin, email);
    if (current >= DAILY_LIMIT) {
      try {
        await supabaseAdmin.from('audit_logs').insert({
          actor_email: email, actor_role: role,
          action: 'AI_CALL_BLOCKED',
          details: `Daily AI limit (${DAILY_LIMIT}) exceeded`,
          success: false,
        });
      } catch { /* audit log failures must not block the response */ }

      return json({ error: `Daily AI limit of ${DAILY_LIMIT} calls reached` }, 429);
    }

    const body = await req.json();
    const { prompt, response_json_schema, add_context_from_internet, file_urls } = body;

    if (!prompt) {
      return json({ error: 'prompt is required' }, 400);
    }

    // Record usage for rate limiting. Wrap in try/catch since the
    // Supabase query builder doesn't expose .catch() directly on
    // .insert() — chaining it threw 'catch is not a function' on every
    // call and 500'd the whole AI request.
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_email: email, actor_email: email, actor_role: role,
        action: 'ai_gateway_call',
        success: true,
      });
    } catch { /* audit log failures must not block the AI call */ }

    // Build messages for Anthropic API
    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
    if (!ANTHROPIC_API_KEY) {
      return json({ error: 'AI service not configured' }, 500);
    }

    const systemPrompt = response_json_schema
      ? `You are a helpful assistant. Respond ONLY with valid JSON matching this schema: ${JSON.stringify(response_json_schema)}`
      : 'You are a helpful assistant.';

    const messages = [{ role: 'user', content: prompt }];

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      }),
    });

    const anthropicResult = await anthropicRes.json();

    if (!anthropicRes.ok) {
      throw new Error(anthropicResult.error?.message || 'Anthropic API error');
    }

    const resultText = anthropicResult.content?.[0]?.text || '';

    // Parse JSON if schema was provided
    let result = resultText;
    if (response_json_schema) {
      try {
        result = JSON.parse(resultText);
      } catch {
        result = resultText; // Return raw text if JSON parse fails
      }
    }

    // Audit successful call
    try {
      await supabaseAdmin.from('audit_logs').insert({
        actor_email: email, actor_role: role,
        action: 'AI_CALL',
        details: `Prompt: ${prompt.slice(0, 100)}...`,
        success: true,
      });
    } catch { /* audit log failures must not block the response */ }

    return json({ result });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
});
