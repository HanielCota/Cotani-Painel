import type { SupabaseClient } from "@supabase/supabase-js";

export type RecoveryMfaStatus = "required" | "satisfied" | "unavailable";

export interface RecoveryMfaState {
  status: RecoveryMfaStatus;
  /** A conta possui autenticador (TOTP) verificado. */
  enrolled: boolean;
}

/**
 * Consulta o nível de garantia da sessão de recuperação. Só exige o código
 * quando a conta realmente tem 2FA (`nextLevel = aal2`) - nunca pede "se tiver".
 * Falha fechado: erro na consulta vira `unavailable` e bloqueia a troca.
 */
export async function getRecoveryMfaState(supabase: SupabaseClient): Promise<RecoveryMfaState> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data || !data.currentLevel || !data.nextLevel) return { status: "unavailable", enrolled: false };
    const enrolled = data.nextLevel === "aal2";
    return { status: enrolled && data.currentLevel !== "aal2" ? "required" : "satisfied", enrolled };
  } catch {
    return { status: "unavailable", enrolled: false };
  }
}

export async function getRecoveryMfaStatus(supabase: SupabaseClient): Promise<RecoveryMfaStatus> {
  return (await getRecoveryMfaState(supabase)).status;
}
