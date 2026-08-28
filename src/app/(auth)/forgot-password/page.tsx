import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default function ForgotPasswordPage() {
  return <main className="flex min-h-svh items-center justify-center bg-background p-4"><PasswordRecoveryForm mode="request" /></main>;
}

