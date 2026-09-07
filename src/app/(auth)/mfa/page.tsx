import { redirect } from "next/navigation";
import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";
import { getAuthenticatedUser, requiresMfaVerification } from "@/server/auth";

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ redirect?: string }> }) {
  if (!await getAuthenticatedUser()) redirect("/sign-in");
  if (!await requiresMfaVerification()) redirect("/dashboard");
  const requested = (await searchParams).redirect;
  const destination = requested?.startsWith("/") && !requested.startsWith("//")
    && (requested.startsWith("/dashboard") || requested.startsWith("/admin"))
    ? requested
    : "/dashboard";
  return <MfaChallengeForm destination={destination}/>;
}
