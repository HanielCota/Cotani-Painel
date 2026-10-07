import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { getRecoveryMfaStatus } from "@/lib/supabase/recovery-mfa";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Confirmar recuperação de senha | Cotani",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function RecoveryMfaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !isRecoverySession(data?.claims)) redirect("/auth/confirm-recovery?error=invalid");
  const status = await getRecoveryMfaStatus(supabase);
  if (status === "satisfied") redirect("/auth/confirm-recovery");
  if (status === "unavailable") redirect("/auth/confirm-recovery?error=mfa_unavailable");
  return <MfaChallengeForm destination="/auth/confirm-recovery" recovery />;
}
