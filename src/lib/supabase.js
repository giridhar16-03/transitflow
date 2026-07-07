import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = hasSupabase
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        storage: window.sessionStorage,
      },
    })
  : null;

export async function signInWithPassword({ email, password }) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase is not configured yet.") };
  }

  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithPassword({ email, password, options }) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase is not configured yet.") };
  }

  return supabase.auth.signUp({ email, password, options });
}

export async function signInWithGoogle(redirectTo) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase is not configured yet.") };
  }

  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });
}

export async function resolveAuthAccountByEmail(email) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase is not configured yet.") };
  }

  return supabase.rpc("resolve_auth_account_by_email", { p_email: email });
}

export async function updateCurrentUserPassword(password) {
  if (!supabase) {
    return { data: null, error: new Error("Supabase is not configured yet.") };
  }

  return supabase.auth.updateUser({ password });
}
