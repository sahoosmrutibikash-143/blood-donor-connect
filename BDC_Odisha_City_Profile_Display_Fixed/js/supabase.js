import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://ttiontlcawxgxrjnbxkl.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_X_vpWAw--2x4ElyRiATA5w_tbQMFE-o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
