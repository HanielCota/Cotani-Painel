import "server-only";
import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import { getPlanConfig, getInvoiceFromMercadoPago, syncSubscriptionFromMercadoPago, subscriptionPeriodEnd } from "./mercado-pago";
import { assertPlanFits } from "./billing-access";
import { getPlanPrice } from "@/config/subscription-plans";
import { finalizeLandingCheckoutAccess } from "./landing-checkout";

// Older contracts may report refunds, but can never replace the current contract.
export async function settleSubscription(remoteId: string, invoiceId?: string) {
  const known = await prisma.billingContract.findUnique({ where: { remoteId } });
  const linked = known ? null : await prisma.clinic.findUnique({ where: { mercadoPagoSubscriptionId: remoteId } });
  if (!known && !linked) throw new Error("Contrato ainda não vinculado; repetir notificação.");
  const clinicId = known?.clinicId ?? linked!.id;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinicId}, 0))`;
    const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: clinicId } });
    const remote = await syncSubscriptionFromMercadoPago({ mercadoPagoSubscriptionId: remoteId });
    if (remote.externalReference !== clinic.id) throw new Error("Referência do contrato divergente.");
    let contract = await tx.billingContract.findUnique({ where: { remoteId } });
    if (!contract) {
      // Lazy adoption of an exact legacy binding, never by external_reference alone.
      if (clinic.mercadoPagoSubscriptionId !== remoteId) throw new Error("Contrato antigo não vinculado.");
      const plan = clinic.pendingSubscriptionPlan ?? clinic.subscriptionPlan;
      const cycle = clinic.pendingSubscriptionCycle ?? clinic.subscriptionCycle;
      if (!plan || !cycle) throw new Error("Contrato legado sem plano/ciclo.");
      const config = getPlanConfig(plan, cycle);
      if (remote.planId !== config.mercadoPagoPlanId) throw new Error("Plano legado divergente; revisão manual necessária.");
      if (!remote.amount || remote.currency !== "BRL") throw new Error("Contrato legado sem preço/moeda verificáveis.");
      contract = await tx.billingContract.create({ data: {
        id: randomUUID(), clinicId, remoteId, plan, cycle, amount: remote.amount,
        remotePlanId: config.mercadoPagoPlanId, state: remote.rawStatus,
      } });
    }
    const current = clinic.mercadoPagoSubscriptionId === remoteId;
    const expectedSubscriptionAmount = current && clinic.pendingSubscriptionPlan && clinic.pendingSubscriptionCycle
      ? getPlanPrice(clinic.pendingSubscriptionPlan, clinic.pendingSubscriptionCycle)
      : Number(contract.amount);
    if (contract.remotePlanId) {
      if (remote.planId !== contract.remotePlanId) throw new Error("Plano remoto divergente do contrato.");
    } else if (remote.planId) {
      throw new Error("A assinatura remota possui um plano inesperado.");
    }
    if (remote.currency !== contract.currency || typeof remote.amount !== "number"
      || Math.abs(remote.amount - expectedSubscriptionAmount) > 0.01) {
      throw new Error("A assinatura remota diverge do valor ou da moeda contratados.");
    }
    if (invoiceId) {
      const invoice = await getInvoiceFromMercadoPago(invoiceId);
      const existing = await tx.paymentHistory.findUnique({ where: { mercadoPagoPaymentId: invoice.paymentId } });
      if (existing && (existing.clinicId !== clinicId || existing.mercadoPagoSubscriptionId !== remoteId)) throw new Error("Pagamento já vinculado a outro contrato.");
      const pendingPlan = current ? clinic.pendingSubscriptionPlan : null;
      const pendingCycle = current ? clinic.pendingSubscriptionCycle : null;
      const invoicePlan = existing?.plan ?? pendingPlan ?? contract.plan;
      const invoiceCycle = existing?.billingCycle ?? pendingCycle ?? contract.cycle;
      const expectedAmount = existing ? Number(existing.amount) : pendingPlan && pendingCycle ? getPlanPrice(pendingPlan, pendingCycle) : Number(contract.amount);
      if (invoice.subscriptionId !== remoteId || invoice.currency !== contract.currency || Math.abs(invoice.amount - expectedAmount) > 0.01) {
        throw new Error("Fatura diverge do contrato: assinatura, moeda ou valor.");
      }
      const approved = invoice.status === "approved";
      const anchor = existing?.paidAt ?? invoice.periodStartsAt ?? invoice.paidAt;
      const periodEndsAt = existing?.periodEndsAt ?? (anchor
        ? subscriptionPeriodEnd(contract.cycle, undefined, anchor) : undefined);
      await tx.paymentHistory.upsert({
        where: { mercadoPagoPaymentId: invoice.paymentId },
        create: { clinicId, mercadoPagoPaymentId: invoice.paymentId, mercadoPagoSubscriptionId: remoteId,
          mercadoPagoInvoiceId: invoiceId, amount: invoice.amount, status: invoice.status, plan: invoicePlan,
          billingCycle: invoiceCycle, paidAt: invoice.paidAt, periodEndsAt },
        update: { status: invoice.status, paidAt: existing?.paidAt ?? invoice.paidAt, periodEndsAt, mercadoPagoInvoiceId: invoiceId },
      });
      const coverage = await tx.paymentHistory.findFirst({
        where: { clinicId, status: "approved", periodEndsAt: { gt: new Date() }, paidAt: { lte: new Date() } },
        orderBy: [{ paidAt: "desc" }, { periodEndsAt: "desc" }],
      });
      if (coverage?.plan && coverage.billingCycle) {
        await assertPlanFits(tx, clinicId, coverage.plan);
        const data = { subscriptionStatus: "ACTIVE" as const, hasPaidOnce: true,
          subscriptionPlan: coverage.plan, subscriptionCycle: coverage.billingCycle,
          subscriptionExpiresAt: coverage.periodEndsAt,
        };
        await tx.clinic.update({ where: { id: clinicId }, data: {
          ...data,
          ...(current && approved ? { pendingSubscriptionPlan: null, pendingSubscriptionCycle: null, mercadoPagoCheckoutUrl: null } : {}),
        } });
        await tx.clinic.updateMany({ where: { billingOwnerId: clinicId }, data });
      } else if (periodEndsAt && clinic.subscriptionExpiresAt?.getTime() === periodEndsAt.getTime()
        && (invoice.status === "refunded" || invoice.status === "charged_back" || invoice.status === "cancelled")) {
        // Do not revoke unrelated/manual access or a different paid period.
        const data = { subscriptionStatus: "INACTIVE" as const, subscriptionExpiresAt: new Date() };
        await tx.clinic.update({ where: { id: clinicId }, data });
        await tx.clinic.updateMany({ where: { billingOwnerId: clinicId }, data });
      }
    }
    if (current && (remote.rawStatus === "cancelled" || remote.rawStatus === "canceled" || remote.rawStatus === "paused")) {
      // Stop renewal, preserving only the already-recorded paid expiration.
      await tx.clinic.update({ where: { id: clinicId }, data: { cancelAtPeriodEnd: true } });
      await tx.clinic.updateMany({ where: { billingOwnerId: clinicId }, data: { cancelAtPeriodEnd: true } });
    }
    await tx.billingContract.update({ where: { id: contract.id }, data: { state: remote.rawStatus } });
  }, { timeout: 40000, maxWait: 10000 });
  await finalizeLandingCheckoutAccess(remoteId);
}
