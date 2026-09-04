import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPlanEntitlements } from "@/config/subscription-plans";
import type { SubscriptionPlan } from "@/generated/prisma/enums";

export async function assertPlanFits(tx: Prisma.TransactionClient, clinicId: string, plan: SubscriptionPlan) {
  const limits = getPlanEntitlements(plan);
  if (!limits.multipleLocations && await tx.clinic.count({ where: { billingOwnerId: clinicId, deletedAt: null } })) {
    throw new Error("O plano escolhido permite somente uma unidade. Ajuste as unidades vinculadas antes de mudar de plano.");
  }
  if (limits.maxProfessionals !== null && await tx.professional.count({ where: { clinicId, isActive: true } }) > limits.maxProfessionals) {
    throw new Error(`O plano escolhido permite até ${limits.maxProfessionals} profissionais ativos. Desative os excedentes antes de mudar de plano.`);
  }
}
