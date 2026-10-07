import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export function getSupabaseAuthCookieNames(existingNames: Iterable<string>): string[] {
  const { supabaseUrl } = getPublicSupabaseConfig();
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;
  const names = new Set<string>([storageKey]);

  for (const name of existingNames) {
    if (name === storageKey || (name.startsWith(`${storageKey}.`) && /^\d+$/.test(name.slice(storageKey.length + 1)))) {
      names.add(name);
    }
  }

  // The session may have been created during this request and not be present
  // among the incoming cookies. Supabase SSR splits larger sessions into chunks.
  for (let index = 0; index < 16; index += 1) names.add(`${storageKey}.${index}`);
  return [...names];
}
