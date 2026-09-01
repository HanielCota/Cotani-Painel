import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";

export default function UpdatePasswordPage() {
  return <main id="main-content" tabIndex={-1} className="flex min-h-svh items-center justify-center bg-background p-4 outline-none"><PasswordRecoveryForm mode="update" /></main>;
}

