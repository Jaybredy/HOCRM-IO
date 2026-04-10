import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Supabase adapter — drop-in replacement for the Base44 SDK
// Exports `base44` with the identical API surface so 62 component files
// need zero changes.
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://akyprqkrxbqlyrhgeubg.supabase.co';

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
      const result = unwrap(await supabase.from(table).insert(data).select());
      return result[0];
    },

    /** update(id, data) — update by id, return updated record */
    async update(id, data) {
      const result = unwrap(
        await supabase.from(table).update(data).eq('id', id).select()
      );
      return result[0];
    },

    /** delete(id) — delete a record by id */
    async delete(id) {
      unwrap(await supabase.from(table).delete().eq('id', id));
    },

    /** bulkCreate(items) — insert multiple records, return them */
    async bulkCreate(items) {
      return unwrap(await supabase.from(table).insert(items).select());
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
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;
    if (!session?.user) return null;

    const email = session.user.email;

    // Look up the application-level user record
    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .limit(1);

    if (userError) throw userError;

    const userRow = users?.[0] || {};

    return {
      id: userRow.id || session.user.id,
      email,
      full_name: userRow.full_name || session.user.user_metadata?.full_name || '',
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
const integrations = {
  Core: {
    /** Upload a file to the 'attachments' storage bucket, return { file_url } */
    async UploadFile({ file }) {
      const timestamp = Date.now();
      const filePath = `${timestamp}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      return { file_url: data.publicUrl };
    },

    /** Send an email via the 'send-email' edge function */
    async SendEmail({ to, subject, body }) {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: { to, subject, body },
      });
      if (error) throw error;
      return data;
    },

    /** Invoke an LLM via the 'ai-gateway' edge function */
    async InvokeLLM(params) {
      const { data, error } = await supabase.functions.invoke('ai-gateway', {
        body: params,
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
    const { data, error } = await supabase.functions.invoke(functionName, {
      body,
    });
    if (error) throw error;
    return data;
  },
};

// ---------------------------------------------------------------------------
// appLogs — analytics, no-op in Supabase migration
// ---------------------------------------------------------------------------
const appLogs = {
  logUserInApp(pageName) {
    console.debug('[appLogs] logUserInApp:', pageName);
  },
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
    async inviteUser(email, role, fullName) {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, role, full_name: fullName || '' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  },
};

// Also export the raw Supabase client for any direct usage needs
export { supabase };
