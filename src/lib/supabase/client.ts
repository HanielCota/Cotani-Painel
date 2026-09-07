"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  const { supabaseUrl, supabasePublishableKey } = getPublicSupabaseConfig();
  browserClient ??= createBrowserClient(supabaseUrl, supabasePublishableKey);
  return browserClient;
}

export function createPasswordVerificationClient(): SupabaseClient {
  const { supabaseUrl, supabasePublishableKey } = getPublicSupabaseConfig();

  return createSupabaseClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
