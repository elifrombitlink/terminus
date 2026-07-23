import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Publishable (anon) key + project URL are safe to ship in the browser bundle.
// They are read from Vite env vars at build time. See .env.example.
const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * The Supabase client, or `null` when the project env is not configured.
 *
 * V1 ships the Command interface on in-browser sample state. Data-plane wiring
 * (objectives, comments, approvals, the Mission Log) lands incrementally on top
 * of this client once the Terminus schema is applied to the project.
 */
export const supabase: SupabaseClient | null =
  url && publishableKey ? createClient(url, publishableKey) : null;

export const isSupabaseConfigured = supabase !== null;
