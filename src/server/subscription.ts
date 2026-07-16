import { SubscriptionStatus } from "@/generated/prisma/enums";
import type { ClinicModel } from "@/generated/prisma/models/Clinic";

export const SUBSCRIPTION_INACTIVE_MESSAGE =
  "Sua assinatura não está ativa. Renove o plano para continuar usando esta funcionalidade.";

export function isSubscriptionActive(clinic: Pick<ClinicModel, "subscriptionStatus">): boolean {
  return clinic.subscriptionStatus === SubscriptionStatus.ACTIVE;
}

export function requireActiveSubscription<T extends Pick<ClinicModel, "subscriptionStatus">>(
  clinic: T,
): T {
  if (!isSubscriptionActive(clinic)) {
    throw new Error(SUBSCRIPTION_INACTIVE_MESSAGE);
  }

  return clinic;
}
