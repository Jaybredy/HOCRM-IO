// Legacy app-params module — Base44 params replaced by Supabase Auth
// This file is kept for any remaining imports but is effectively a no-op

export const appParams = {
  appId: null,
  token: null,
  fromUrl: window.location.href,
  functionsVersion: null,
  appBaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
};
