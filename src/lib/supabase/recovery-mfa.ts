import type { SupabaseClient } from "@supabase/supabase-js";

export async function getRecoveryMfaStatus(supabase: SupabaseClient): Promise<"required" | "satisfied" | "unavailable"> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data || !data.currentLevel || !data.nextLevel) return "unavailable";
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2" ? "required" : "satisfied";
  } catch {
    return "unavailable";
  }
}
