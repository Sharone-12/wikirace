import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client, used only for Realtime (broadcast + presence).
// It holds the publishable key, which has no access to any game table.
let client: SupabaseClient | null = null;

export function realtime(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}
