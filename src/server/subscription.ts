import { SubscriptionStatus } from "@/generated/prisma/enums";

export const SUBSCRIPTION_INACTIVE_MESSAGE =
  "Sua assinatura não está ativa. Renove o plano para continuar usando esta funcionalidade.";

interface SubscriptionAccessState {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: Date | null;
  subscriptionExpiresAt?: Date | null;
}

export function isSubscriptionActive(
  clinic: SubscriptionAccessState,
  now = new Date(),
): boolean {
  if (clinic.subscriptionStatus === SubscriptionStatus.ACTIVE) {
    return clinic.subscriptionExpiresAt != null && clinic.subscriptionExpiresAt > now;
  }
  return clinic.subscriptionStatus === SubscriptionStatus.TRIALING
    && clinic.trialEndsAt != null
    && clinic.trialEndsAt > now;
}

export function requireActiveSubscription<T extends SubscriptionAccessState>(
  clinic: T,
): T {
  if (!isSubscriptionActive(clinic)) {
    throw new Error(SUBSCRIPTION_INACTIVE_MESSAGE);
  }

  return clinic;
}
