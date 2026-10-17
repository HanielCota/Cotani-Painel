import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getAuthenticatedUser, requiresMfaVerification } from "@/server/auth";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  if (!await getAuthenticatedUser()) redirect("/sign-in");
  if (!await requiresMfaVerification()) redirect("/dashboard");
  // Depois do 2FA só faz sentido voltar ao painel ou à administração.
  const requested = safeRedirectPath((await searchParams).redirect);
  const destination = requested.startsWith("/dashboard") || requested.startsWith("/admin") ? requested : "/dashboard";
  return <MfaChallengeForm destination={destination}/>;
}
