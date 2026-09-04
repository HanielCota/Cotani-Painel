"use server";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { getTenantContext, requireRole } from "@/server/tenant";
import type { ActionResult } from "@/types";
import { cancelMercadoPagoSubscription } from "@/server/services/mercado-pago";
import { isSubscriptionActive } from "@/server/subscription";

export async function cancelSubscription(): Promise<ActionResult> {
  try {
    const tenant = requireRole(await getTenantContext(), ["ADMIN"]);

    if (!tenant) {
      return { status: "error", message: "Nenhuma loja encontrada para este usuário." };
    }

    const { clinic, membership: actorMembership } = tenant;
    let billingClinic: typeof clinic | null = clinic;

    if (clinic.billingOwnerId) {
      const ownerMembership = await prisma.membership.findUnique({
        where: {
          clinicId_userId: {
            clinicId: clinic.billingOwnerId,
            userId: actorMembership.userId,
          },
        },
        select: { role: true },
      });

      if (ownerMembership?.role !== "ADMIN") {
        return { status: "error", message: "Somente um administrador da unidade principal pode cancelar esta assinatura." };
      }

      billingClinic = await prisma.clinic.findUnique({ where: { id: clinic.billingOwnerId } });
    }

    if (!billingClinic) return { status: "error", message: "A unidade principal da assinatura não foi encontrada." };

    if (billingClinic.subscriptionStatus !== SubscriptionStatus.TRIALING && billingClinic.subscriptionStatus !== SubscriptionStatus.ACTIVE && billingClinic.subscriptionStatus !== SubscriptionStatus.PAST_DUE) {
      return { status: "error", message: "Não há assinatura ativa para cancelar." };
    }

    if (billingClinic.subscriptionStatus === SubscriptionStatus.TRIALING && !billingClinic.mercadoPagoSubscriptionId) {
      await prisma.clinic.update({
        where: { id: billingClinic.id },
        data: { subscriptionStatus: SubscriptionStatus.CANCELED, trialEndsAt: new Date(), cancelAtPeriodEnd: false },
      });
      return { status: "success", message: "Período grátis encerrado." };
    }

    if (!billingClinic.mercadoPagoSubscriptionId) return { status: "error", message: "A assinatura não possui vínculo com o Mercado Pago. Fale com o suporte." };
    await cancelMercadoPagoSubscription(billingClinic.mercadoPagoSubscriptionId);

    const ownerId = billingClinic.id;
    const canceledRemoteId = billingClinic.mercadoPagoSubscriptionId;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${ownerId}, 0))`;
      const current = await tx.clinic.findUniqueOrThrow({ where: { id: ownerId } });
      if (current.mercadoPagoSubscriptionId !== canceledRemoteId) return;
      const cancellationData = current.subscriptionStatus === SubscriptionStatus.ACTIVE && isSubscriptionActive(current)
        ? { cancelAtPeriodEnd: true }
        : { subscriptionStatus: SubscriptionStatus.CANCELED, cancelAtPeriodEnd: false };
      await tx.clinic.update({ where: { id: ownerId }, data: cancellationData });
      await tx.clinic.updateMany({ where: { billingOwnerId: ownerId }, data: cancellationData });
    });

    return { status: "success", message: billingClinic.subscriptionStatus === SubscriptionStatus.ACTIVE ? "Renovação cancelada. Seu acesso permanece até o fim do período pago." : "Assinatura cancelada com sucesso." };
  } catch (error) {
    logger.error("Erro ao cancelar assinatura", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "error", message: "Não foi possível cancelar a assinatura. Tente novamente em instantes." };
  }
}
