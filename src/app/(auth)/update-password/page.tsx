import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Criar senha", robots: { index: false, follow: false } };

/**
 * Primeira senha de quem chegou por convite ou checkout. Recuperação de senha
 * tem fluxo próprio (com 2FA) e nunca é tratada aqui.
 */
export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (isRecoverySession(data?.claims)) redirect("/auth/confirm-recovery");

  const { error } = await searchParams;
  const initialError = error === "policy"
    ? "Essa senha não foi aceita. Escolha outra e tente novamente."
    : error === "retry"
      ? "Não foi possível concluir a alteração. Tente novamente."
      : null;
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-svh items-center justify-center bg-background p-4 outline-none">
      <PasswordRecoveryForm mode="update" initialError={initialError} />
    </main>
  );
}
