"use server";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { getTenantContext, requireRole, type TenantContext } from "@/server/tenant";
import type { ActionResult } from "@/types";
import { SubscriptionPlan } from "@/generated/prisma/enums";
import { getPlanPrice, getProductPlan } from "@/config/subscription-plans";
import { assertPlanFits } from "@/server/services/billing-access";
import {
  cancelMercadoPagoSubscription,
  reactivateMercadoPagoSubscription,
  refundMercadoPagoPayment,
  updateMercadoPagoSubscriptionAmount,
} from "@/server/services/mercado-pago";
import { isSubscriptionActive } from "@/server/subscription";

async function resolveBillingClinic(tenant: TenantContext) {
  if (!tenant.clinic.billingOwnerId) return tenant.clinic;
  const membership = await prisma.membership.findUnique({ where: { clinicId_userId: { clinicId: tenant.clinic.billingOwnerId, userId: tenant.membership.userId } }, select: { role: true } });
  if (membership?.role !== "ADMIN") return null;
  return prisma.clinic.findUnique({ where: { id: tenant.clinic.billingOwnerId } });
}

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

export async function reactivateSubscription(): Promise<ActionResult> {
  try {
    const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
    const clinic = await resolveBillingClinic(tenant);
    if (!clinic?.mercadoPagoSubscriptionId || !clinic.cancelAtPeriodEnd || !isSubscriptionActive(clinic)) {
      return { status: "error", message: "Não há cancelamento pendente para desfazer." };
    }
    await reactivateMercadoPagoSubscription(clinic.mercadoPagoSubscriptionId);
    await prisma.$transaction([
      prisma.clinic.update({ where: { id: clinic.id }, data: { cancelAtPeriodEnd: false } }),
      prisma.clinic.updateMany({ where: { billingOwnerId: clinic.id }, data: { cancelAtPeriodEnd: false } }),
    ]);
    return { status: "success", message: "Renovação reativada com sucesso." };
  } catch (error) {
    logger.error("Erro ao reativar assinatura", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Não foi possível reativar a renovação." };
  }
}

export async function schedulePlanChange(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
    const clinic = await resolveBillingClinic(tenant);
    const plan = formData.get("plan");
    if (!clinic || !Object.values(SubscriptionPlan).includes(plan as SubscriptionPlan)) return { status: "error", message: "Plano inválido." };
    const target = plan as SubscriptionPlan;
    if (target === SubscriptionPlan.ENTERPRISE || !getProductPlan(target).selfServiceCheckout) return { status: "error", message: "O plano Empresa é contratado com a equipe Cotani." };
    if (!clinic.subscriptionCycle || !clinic.subscriptionPlan || !clinic.mercadoPagoSubscriptionId || !isSubscriptionActive(clinic)) return { status: "error", message: "É necessária uma assinatura paga ativa para programar a troca." };
    if (target === clinic.subscriptionPlan && !clinic.pendingSubscriptionPlan) return { status: "error", message: "Este já é o seu plano atual." };

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
      await assertPlanFits(tx, clinic.id, target);
    });
    const amount = getPlanPrice(target, clinic.subscriptionCycle);
    await updateMercadoPagoSubscriptionAmount(clinic.mercadoPagoSubscriptionId, amount, `Cotani - ${getProductPlan(target).name}`);
    try {
      await prisma.clinic.update({ where: { id: clinic.id }, data: { pendingSubscriptionPlan: target, pendingSubscriptionCycle: clinic.subscriptionCycle } });
    } catch (error) {
      await updateMercadoPagoSubscriptionAmount(clinic.mercadoPagoSubscriptionId, getPlanPrice(clinic.subscriptionPlan, clinic.subscriptionCycle), `Cotani - ${getProductPlan(clinic.subscriptionPlan).name}`).catch(() => undefined);
      throw error;
    }
    return { status: "success", message: `Troca para ${getProductPlan(target).name} programada para a próxima cobrança.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível programar a troca.";
    logger.error("Erro ao programar troca de plano", { error: message });
    return { status: "error", message };
  }
}

export async function cancelScheduledPlanChange(): Promise<ActionResult> {
  try {
    const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
    const clinic = await resolveBillingClinic(tenant);
    if (!clinic?.pendingSubscriptionPlan || !clinic.subscriptionPlan || !clinic.subscriptionCycle || !clinic.mercadoPagoSubscriptionId) return { status: "error", message: "Não há troca de plano programada." };
    const amount = getPlanPrice(clinic.subscriptionPlan, clinic.subscriptionCycle);
    await updateMercadoPagoSubscriptionAmount(clinic.mercadoPagoSubscriptionId, amount, `Cotani - ${getProductPlan(clinic.subscriptionPlan).name}`);
    try {
      await prisma.clinic.update({ where: { id: clinic.id }, data: { pendingSubscriptionPlan: null, pendingSubscriptionCycle: null } });
    } catch (error) {
      const pendingAmount = getPlanPrice(clinic.pendingSubscriptionPlan, clinic.subscriptionCycle);
      await updateMercadoPagoSubscriptionAmount(clinic.mercadoPagoSubscriptionId, pendingAmount, `Cotani - ${getProductPlan(clinic.pendingSubscriptionPlan).name}`).catch(() => undefined);
      throw error;
    }
    return { status: "success", message: "Troca de plano cancelada." };
  } catch (error) {
    logger.error("Erro ao cancelar troca de plano", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "Não foi possível cancelar a troca de plano." };
  }
}

export async function requestSubscriptionRefund(): Promise<ActionResult> {
  try {
    const tenant = requireRole(await getTenantContext(), ["ADMIN"]);
    const clinic = await resolveBillingClinic(tenant);
    if (!clinic) return { status: "error", message: "Assinatura não encontrada." };
    const payment = await prisma.paymentHistory.findFirst({
      where: { clinicId: clinic.id, status: "approved", mercadoPagoPaymentId: { not: null }, paidAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60_000) } },
      orderBy: { paidAt: "desc" },
    });
    if (!payment?.mercadoPagoPaymentId) return { status: "error", message: "Não há pagamento elegível para a garantia de 7 dias." };
    await refundMercadoPagoPayment(payment.mercadoPagoPaymentId, payment.id);
    if (clinic.mercadoPagoSubscriptionId) await cancelMercadoPagoSubscription(clinic.mercadoPagoSubscriptionId);
    await prisma.$transaction(async (tx) => {
      await tx.paymentHistory.update({ where: { id: payment.id }, data: { status: "refunded" } });
      const coverage = await tx.paymentHistory.findFirst({ where: { clinicId: clinic.id, id: { not: payment.id }, status: "approved", paidAt: { lte: new Date() }, periodEndsAt: { gt: new Date() } }, orderBy: [{ paidAt: "desc" }, { periodEndsAt: "desc" }] });
      const data = coverage?.plan && coverage.billingCycle && coverage.periodEndsAt
        ? { subscriptionStatus: SubscriptionStatus.ACTIVE, subscriptionPlan: coverage.plan, subscriptionCycle: coverage.billingCycle, subscriptionExpiresAt: coverage.periodEndsAt, cancelAtPeriodEnd: true }
        : { subscriptionStatus: SubscriptionStatus.INACTIVE, subscriptionExpiresAt: new Date(), cancelAtPeriodEnd: false };
      await tx.clinic.update({ where: { id: clinic.id }, data });
      await tx.clinic.updateMany({ where: { billingOwnerId: clinic.id }, data });
    });
    return { status: "success", message: "Reembolso solicitado ao Mercado Pago e acesso encerrado." };
  } catch (error) {
    logger.error("Erro ao solicitar reembolso", { error: error instanceof Error ? error.message : String(error) });
    return { status: "error", message: "O reembolso não pôde ser concluído. Verifique a elegibilidade ou tente novamente." };
  }
}
