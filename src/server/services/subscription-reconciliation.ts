import "server-only";

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getPlanConfig, subscriptionPeriodEnd, syncSubscriptionFromMercadoPago } from "@/server/services/mercado-pago";

export async function reconcileMercadoPagoSubscriptions() {
  const clinics = await prisma.clinic.findMany({
    where: { mercadoPagoSubscriptionId: { not: null }, deletedAt: null },
    select: {
      id: true,
      mercadoPagoSubscriptionId: true,
      subscriptionStatus: true,
      subscriptionPlan: true,
      subscriptionCycle: true,
      pendingSubscriptionPlan: true,
      pendingSubscriptionCycle: true,
      subscriptionExpiresAt: true,
      hasPaidOnce: true,
      cancelAtPeriodEnd: true,
    },
  });

  let reconciled = 0;
  let failed = 0;
  for (const clinic of clinics) {
    try {
      const synced = await syncSubscriptionFromMercadoPago({ mercadoPagoSubscriptionId: clinic.mercadoPagoSubscriptionId! });
      const plan = clinic.pendingSubscriptionPlan ?? clinic.subscriptionPlan;
      const cycle = clinic.pendingSubscriptionCycle ?? clinic.subscriptionCycle;
      if (synced.planId && plan && cycle && synced.planId !== getPlanConfig(plan, cycle).mercadoPagoPlanId) throw new Error("Plano remoto divergente.");
      const canceledWithAccess = synced.status === "CANCELED" && clinic.cancelAtPeriodEnd && clinic.subscriptionExpiresAt && clinic.subscriptionExpiresAt > new Date();
      const approved = synced.status === "ACTIVE";
      const effectiveExpiration = approved ? subscriptionPeriodEnd(cycle, synced.nextPaymentDate) : undefined;
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          subscriptionStatus: canceledWithAccess ? "ACTIVE" : synced.status ?? undefined,
          hasPaidOnce: clinic.hasPaidOnce || synced.hasPaidOnce,
          subscriptionPlan: approved ? plan : undefined,
          subscriptionCycle: approved ? cycle : undefined,
          subscriptionExpiresAt: effectiveExpiration,
          pendingSubscriptionPlan: approved ? null : undefined,
          pendingSubscriptionCycle: approved ? null : undefined,
          mercadoPagoCheckoutUrl: approved ? null : undefined,
          cancelAtPeriodEnd: canceledWithAccess ? true : approved ? false : undefined,
        },
      });
      await prisma.clinic.updateMany({
        where: { billingOwnerId: clinic.id },
        data: {
          subscriptionStatus: canceledWithAccess ? "ACTIVE" : synced.status ?? undefined,
          hasPaidOnce: clinic.hasPaidOnce || synced.hasPaidOnce,
          subscriptionPlan: approved ? plan : undefined,
          subscriptionCycle: approved ? cycle : undefined,
          subscriptionExpiresAt: effectiveExpiration,
          cancelAtPeriodEnd: canceledWithAccess ? true : approved ? false : undefined,
        },
      });
      reconciled += 1;
    } catch (error) {
      failed += 1;
      logger.error("Falha ao reconciliar assinatura Mercado Pago", { clinicId: clinic.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { checked: clinics.length, reconciled, failed };
}
