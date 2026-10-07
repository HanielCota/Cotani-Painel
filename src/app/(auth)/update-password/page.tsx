import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const initialError = error === "policy"
    ? "Essa senha não foi aceita. Escolha outra e tente novamente."
    : error === "retry"
      ? "Não foi possível concluir a alteração. Tente novamente."
      : null;
  return <main id="main-content" tabIndex={-1} className="flex min-h-svh items-center justify-center bg-background p-4 outline-none"><PasswordRecoveryForm mode="update" initialError={initialError} /></main>;
}

