"use server";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { getTenantContext, requireRole } from "@/server/tenant";
import type { ActionResult } from "@/types";
import { cancelMercadoPagoSubscription, subscriptionPeriodEnd } from "@/server/services/mercado-pago";

export async function cancelSubscription(): Promise<ActionResult> {
  try {
    const tenant = requireRole(await getTenantContext(), ["ADMIN"]);

    if (!tenant) {
      return { status: "error", message: "Nenhuma loja encontrada para este usuário." };
    }

    const { clinic } = tenant;
    const billingClinic = clinic.billingOwnerId
      ? await prisma.clinic.findUnique({ where: { id: clinic.billingOwnerId } })
      : clinic;
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

    const accessEndsAt = billingClinic.subscriptionStatus === SubscriptionStatus.ACTIVE
      ? subscriptionPeriodEnd(billingClinic.subscriptionCycle, billingClinic.subscriptionExpiresAt ?? undefined)
      : new Date();
    const cancellationData = billingClinic.subscriptionStatus === SubscriptionStatus.ACTIVE
      ? { subscriptionStatus: SubscriptionStatus.ACTIVE, subscriptionExpiresAt: accessEndsAt, cancelAtPeriodEnd: true }
      : { subscriptionStatus: SubscriptionStatus.CANCELED, cancelAtPeriodEnd: false };
    await prisma.$transaction([
      prisma.clinic.update({ where: { id: billingClinic.id }, data: cancellationData }),
      prisma.clinic.updateMany({ where: { billingOwnerId: billingClinic.id }, data: cancellationData }),
    ]);

    return { status: "success", message: billingClinic.subscriptionStatus === SubscriptionStatus.ACTIVE ? "Renovação cancelada. Seu acesso permanece até o fim do período pago." : "Assinatura cancelada com sucesso." };
  } catch (error) {
    logger.error("Erro ao cancelar assinatura", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { status: "error", message: "Não foi possível cancelar a assinatura. Tente novamente em instantes." };
  }
}
