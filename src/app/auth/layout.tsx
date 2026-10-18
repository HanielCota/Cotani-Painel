import { AuthShell } from "@/components/auth/auth-shell";

/** Telas de confirmação/recuperação fora do grupo (auth) usam a mesma moldura. */
export default function AuthFlowLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
