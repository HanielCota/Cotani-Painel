import type { Metadata } from "next";

import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export const metadata: Metadata = { title: "Recuperar senha" };

const errorMessages: Record<string, string> = {
  link: "O link de redefinição expirou, já foi usado ou foi aberto em outro navegador. Peça um novo abaixo e abra-o neste navegador.",
};

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-svh items-center justify-center bg-background p-4 outline-none">
      <PasswordRecoveryForm mode="request" initialError={error ? errorMessages[error] ?? null : null} />
    </main>
  );
}
