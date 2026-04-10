/**
 * AI Gateway - Hard enforces AI_USE capability (EPIC_ADMIN only).
 * Wraps InvokeLLM and logs every call + failed attempt.
 *
 * POST /aiGateway
 * Body: { prompt, response_json_schema?, add_context_from_internet?, file_urls? }
 * Returns: LLM response or 403
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Simple in-memory daily rate limiter (resets on cold start)
const dailyUsage = new Map();

function getTodayKey(email) {
  return `${email}_${new Date().toISOString().slice(0, 10)}`;
}

const DAILY_LIMIT = 50; // calls per EPIC_ADMIN per day

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const rawRole = user.role || 'CLIENT_VIEWER';
    const role = rawRole === 'admin' ? 'EPIC_ADMIN' : rawRole === 'user' ? 'CLIENT_EDITOR' : rawRole;

    // Hard block: only EPIC_ADMIN
    if (role !== 'EPIC_ADMIN') {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_role: role,
        action: 'AI_CALL_BLOCKED',
        details: `AI access denied for role ${role}`,
        success: false,
      });
      return Response.json({ error: 'AI_USE is restricted to EPIC_ADMIN only' }, { status: 403 });
    }

    // Rate limit check
    const dayKey = getTodayKey(user.email);
    const current = dailyUsage.get(dayKey) || 0;
    if (current >= DAILY_LIMIT) {
      await base44.asServiceRole.entities.AuditLog.create({
        actor_email: user.email,
        actor_role: role,
        action: 'AI_CALL_BLOCKED',
        details: `Daily AI limit (${DAILY_LIMIT}) exceeded`,
        success: false,
      });
      return Response.json({ error: `Daily AI limit of ${DAILY_LIMIT} calls reached` }, { status: 429 });
    }

    const body = await req.json();
    const { prompt, response_json_schema, add_context_from_internet, file_urls } = body;

    if (!prompt) {
      return Response.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Increment usage
    dailyUsage.set(dayKey, current + 1);

    // Call LLM via integration
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: response_json_schema || null,
      add_context_from_internet: add_context_from_internet || false,
      file_urls: file_urls || null,
    });

    // Audit successful call
    await base44.asServiceRole.entities.AuditLog.create({
      actor_email: user.email,
      actor_role: role,
      action: 'AI_CALL',
      details: `Prompt: ${prompt.slice(0, 100)}...`,
      success: true,
    });

    return Response.json({ result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});