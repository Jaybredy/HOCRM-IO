import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase adapter — drop-in replacement for the Base44 SDK
// Exports `base44` with the identical API surface so 62 component files
// need zero changes.
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Disable Supabase auth-js Web Locks. Web Locks can zombie out across tab/HMR
// reloads (lock held by a dead frame, no waiter queued, no release event),
// which deadlocks every auth-gated call: getSession(), functions.invoke(),
// any RLS-tagged REST request. Falling back to an in-memory no-op lock
// trades weaker cross-tab refresh-token coordination — acceptable here —
// for predictable per-tab behavior.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    lock: async (_name, _acquireTimeout, fn) => fn(),
    lockAcquireTimeout: 1000,
  },
});

// ---------------------------------------------------------------------------
// Entity name  ->  Supabase table name mapping
// ---------------------------------------------------------------------------
const TABLE_MAP = {
  User: 'users',
  ActivityLog: 'activity_logs',
  Task: 'tasks',
  UserPropertyAccess: 'user_property_access',
  Client: 'clients',
  Contact: 'contacts',
  Hotel: 'hotels',
  Property: 'properties',
  ProductionItem: 'production_items',
  Unit: 'units',
  CateringEvent: 'catering_events',
  ActivityGoal: 'activity_goals',
  Goal: 'goals',
  BDLead: 'bd_leads',
  BDTeamMember: 'bd_team_members',
  BDBudget: 'bd_budgets',
  Budget: 'budgets',
  SalesTarget: 'sales_targets',
  ActualResults: 'actual_results',
  LeaseRenewal: 'lease_renewals',
  ReportRecord: 'report_records',
  RFP: 'rfps',
  TeamNote: 'team_notes',
  ServicePricing: 'service_pricing',
  UserPreferences: 'user_preferences',
  AuditLog: 'audit_logs',
};

/** Convert PascalCase to snake_case as a fallback when the entity is not in TABLE_MAP */
function toSnakeCase(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function resolveTable(entityName) {
  return TABLE_MAP[entityName] || toSnakeCase(entityName);
}

// ---------------------------------------------------------------------------
// Helper: throw on Supabase errors
// ---------------------------------------------------------------------------
function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

// Tables that require hotel_id at insert time. Frontend doesn't always
// know the user's hotel, so the adapter auto-resolves it from
// user_property_access (cached via resolveCallerHotelId, defined below).
// Closes the transitional "hotel_id IS NULL" escape hatches in the
// clients_insert / tasks_insert / goals_insert RLS policies.
const HOTEL_SCOPED_TABLES = new Set([
  'clients', 'tasks', 'goals', 'bd_leads',
  'bd_team_members', 'bd_budgets',
  'budgets', 'sales_targets',
  'team_notes', 'service_pricing',
  'catering_events', 'rfps', 'activity_logs',
  'actual_results',
]);

async function injectHotelIdIfMissing(table, data) {
  if (!HOTEL_SCOPED_TABLES.has(table)) return data;
  if (data && data.hotel_id) return data;
  const hotelId = await resolveCallerHotelId();
  if (!hotelId) return data; // admin without hotel context — pass through; RLS will allow via is_admin()
  return { ...data, hotel_id: hotelId };
}

// Convert empty strings (and undefined) to null on every field of the
// payload. Postgres rejects "" for UUID / DATE / ENUM / NUMERIC columns
// (codes 22P02 / 22007 / PGRST204) — and for TEXT columns, "" and null
// are functionally equivalent (both mean "no value"). Doing this at the
// adapter level instead of per-form-handler eliminates ~80% of the
// "form silently fails" bugs across the app.
function sanitizeEmptyStrings(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = (v === '' || v === undefined) ? null : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Entity handler — returned by the Proxy for each entity name
// ---------------------------------------------------------------------------
function createEntityHandler(entityName) {
  const table = resolveTable(entityName);

  return {
    /**
     * list(orderBy?, limit?)
     * orderBy: "-field_name" for descending, "field_name" for ascending
     */
    async list(orderBy, limit) {
      let query = supabase.from(table).select('*');

      if (orderBy) {
        const descending = orderBy.startsWith('-');
        const column = descending ? orderBy.slice(1) : orderBy;
        query = query.order(column, { ascending: !descending });
      }

      if (limit) {
        query = query.limit(limit);
      }

      return unwrap(await query);
    },

    /**
     * filter(filterObj)
     * { field: value }  ->  .eq(field, value)
     * { field: [v1,v2]} ->  .in(field, [v1,v2])
     */
    async filter(filterObj) {
      let query = supabase.from(table).select('*');

      for (const [key, value] of Object.entries(filterObj)) {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      }

      return unwrap(await query);
    },

    /** create(data) — insert a single record, return it */
    async create(data) {
      const enriched = await injectHotelIdIfMissing(table, sanitizeEmptyStrings(data));
      const result = unwrap(await supabase.from(table).insert(enriched).select());
      return result[0];
    },

    /** update(id, data) — update by id, return updated record */
    async update(id, data) {
      const result = unwrap(
        await supabase.from(table).update(sanitizeEmptyStrings(data)).eq('id', id).select()
      );
      return result[0];
    },

    /** delete(id) — delete a record by id */
    async delete(id) {
      unwrap(await supabase.from(table).delete().eq('id', id));
    },

    /** bulkCreate(items) — insert multiple records, return them */
    async bulkCreate(items) {
      const enriched = await Promise.all(items.map((i) =>
        injectHotelIdIfMissing(table, sanitizeEmptyStrings(i))
      ));
      return unwrap(await supabase.from(table).insert(enriched).select());
    },
  };
}

// ---------------------------------------------------------------------------
// entities proxy — base44.entities.AnyEntityName returns the handler
// ---------------------------------------------------------------------------
const entitiesProxy = new Proxy(
  {},
  {
    get(_target, entityName) {
      return createEntityHandler(entityName);
    },
  }
);

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------
const auth = {
  /** Return the current user object with id, email, full_name, role */
  async me() {
    const {
      data: { user },
      error: sessionError,
    } = await supabase.auth.getUser();

    if (sessionError) throw sessionError;
    if (!user) return null;

    const email = user.email;

    // Look up the application-level user record
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (userError) throw userError;

    const userRow = users?.[0] || {};

    return {
      id: userRow.id || user.id,
      email,
      full_name: userRow.full_name || user.user_metadata?.full_name || '',
      role: userRow.role || 'user',
      ...userRow,
    };
  },

  /** Sign out and optionally redirect */
  async logout(redirectUrl) {
    await supabase.auth.signOut();
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  /** Redirect the browser to the login page with an optional returnTo */
  redirectToLogin(redirectUrl) {
    const params = redirectUrl
      ? `?returnTo=${encodeURIComponent(redirectUrl)}`
      : '';
    window.location.href = `/login${params}`;
  },
};

// ---------------------------------------------------------------------------
// integrations
// ---------------------------------------------------------------------------
// Resolve the caller's primary hotel via user_property_access. Cached per
// session to avoid re-querying on every UploadFile call.
let _cachedHotelId = null;
async function resolveCallerHotelId() {
  if (_cachedHotelId) return _cachedHotelId;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data } = await supabase
    .from('user_property_access')
    .select('properties!inner(hotel_id)')
    .eq('user_email', user.email)
    .eq('is_active', true)
    .limit(1);
  _cachedHotelId = data?.[0]?.properties?.hotel_id ?? null;
  return _cachedHotelId;
}

const integrations = {
  Core: {
    /**
     * Upload a file to the 'attachments' storage bucket scoped to a hotel.
     * Path: hotels/<hotel_id>/<timestamp>_<filename>. Returns a 1-hour signed URL.
     *
     * If hotelId isn't passed, the caller's primary hotel (from
     * user_property_access) is auto-resolved. Admins without any hotel
     * access fall back to a `legacy/` prefix that's accessible only via
     * is_admin() RLS.
     */
    async UploadFile({ file, hotelId }) {
      const timestamp = Date.now();
      const resolvedHotelId = hotelId ?? (await resolveCallerHotelId());

      const filePath = resolvedHotelId
        ? `hotels/${resolvedHotelId}/${timestamp}_${file.name}`
        : `legacy/${timestamp}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Bucket is private; return a short-TTL signed URL (1 hour).
      const { data, error: signErr } = await supabase.storage
        .from('attachments')
        .createSignedUrl(filePath, 3600);

      if (signErr) throw signErr;

      return { file_url: data.signedUrl, file_path: filePath };
    },

    /** Send an email via the 'send-email' edge function */
    async SendEmail({ to, subject, body }) {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, body },
        headers,
      });
      if (error) throw error;
      return data;
    },

    /** Invoke an LLM via the 'ai-gateway' edge function */
    async InvokeLLM(params) {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: params,
        headers,
      });
      if (error) throw error;
      return data;
    },
  },
};

// ---------------------------------------------------------------------------
// functions
// ---------------------------------------------------------------------------
const functions = {
  async invoke(functionName, body) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
      headers,
    });
    if (error) throw error;
    return data;
  },
};

// ---------------------------------------------------------------------------
// appLogs — analytics, no-op in Supabase migration
// ---------------------------------------------------------------------------
const appLogs = {
  logUserInApp() {},
};

// ---------------------------------------------------------------------------
// Export the adapter with the same name used across 62 files
// ---------------------------------------------------------------------------
export const base44 = {
  entities: entitiesProxy,
  auth,
  integrations,
  functions,
  appLogs,
  // User management — inviteUser via Edge Function
  users: {
    async inviteUser(email, role, fullName, hotelId) {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const body = { email, role, full_name: fullName || '', hotel_id: hotelId ?? null };
      // Use raw fetch (not supabase-js .invoke) so we can surface error response
      // bodies. .invoke() wraps non-2xx responses in FunctionsHttpError and hides
      // the JSON body, which makes debugging the invite-user flow painful.
      const url = `${SUPABASE_URL}/functions/v1/invite-user`;
      const rawRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          ...headers,
        },
        body: JSON.stringify(body),
      });
      const rawText = await rawRes.text();
      let data = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch { data = { raw: rawText }; }
      const error = rawRes.ok ? null : { message: data?.error || `HTTP ${rawRes.status}`, status: rawRes.status, details: data };
      if (error) {
        // Try to extract message from the error
        const msg = typeof error === 'object' ? (error.message || JSON.stringify(error)) : String(error);
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },

    async updateUserRole(userId, newRole) {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const url = `${SUPABASE_URL}/functions/v1/update-user-role`;
      const rawRes = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ user_id: userId, new_role: newRole }),
      });
      const rawText = await rawRes.text();
      let data = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch { data = { raw: rawText }; }
      if (!rawRes.ok) throw new Error(data?.error || `HTTP ${rawRes.status}`);
      if (data?.error) throw new Error(data.error);
      return data;
    },
  },
};

// Also export the raw Supabase client for any direct usage needs
export { supabase };
