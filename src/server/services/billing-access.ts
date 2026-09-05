import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getPlanEntitlements } from "@/config/subscription-plans";
import type { SubscriptionPlan } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

export async function assertPlanFits(tx: Prisma.TransactionClient, clinicId: string, plan: SubscriptionPlan) {
  const limits = getPlanEntitlements(plan);
  if (!limits.multipleLocations && await tx.clinic.count({ where: { billingOwnerId: clinicId, deletedAt: null } })) {
    throw new Error("O plano escolhido permite somente uma unidade. Ajuste as unidades vinculadas antes de mudar de plano.");
  }
  if (limits.maxProfessionals !== null && await tx.professional.count({ where: { clinicId, isActive: true } }) > limits.maxProfessionals) {
    throw new Error(`O plano escolhido permite até ${limits.maxProfessionals} profissionais ativos. Desative os excedentes antes de mudar de plano.`);
  }
}

export interface PlanFitIssue {
  kind: "units" | "professionals";
  message: string;
  href: string;
}

export async function getPlanFitIssues(clinicId: string, plan: SubscriptionPlan): Promise<PlanFitIssue[]> {
  const limits = getPlanEntitlements(plan);
  const [units, professionals] = await Promise.all([
    limits.multipleLocations ? Promise.resolve(0) : prisma.clinic.count({ where: { billingOwnerId: clinicId, deletedAt: null } }),
    limits.maxProfessionals === null ? Promise.resolve(0) : prisma.professional.count({ where: { clinicId, isActive: true } }),
  ]);
  const issues: PlanFitIssue[] = [];
  if (units > 0) issues.push({ kind: "units", message: `Arquive ${units} unidade${units === 1 ? "" : "s"} vinculada${units === 1 ? "" : "s"}.`, href: "/dashboard/negocio/unidades" });
  if (limits.maxProfessionals !== null && professionals > limits.maxProfessionals) {
    issues.push({ kind: "professionals", message: `Desative ${professionals - limits.maxProfessionals} profissional${professionals - limits.maxProfessionals === 1 ? "" : "is"} excedente${professionals - limits.maxProfessionals === 1 ? "" : "s"}.`, href: "/dashboard/negocio/profissionais" });
  }
  return issues;
}
