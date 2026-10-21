import "server-only";
import type { BillingContractModel } from "@/generated/prisma/models/BillingContract";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getSubscriptionInvoicePage } from "./mercado-pago";
import { settleSubscription } from "./billing-settlement";

const TIME_BUDGET_MS = 15_000;

function hasTimeLeft(startedAt: number) {
  return Date.now() - startedAt <= TIME_BUDGET_MS;
}

/** Concilia uma página de faturas do contrato e guarda até onde chegou. */
async function reconcileContractInvoices(contract: BillingContractModel, remoteId: string, startedAt: number) {
  // Rotate even if a remote invoice is unavailable, so other contracts progress.
  await prisma.billingContract.update({ where: { id: contract.id }, data: { lastReconciledAt: new Date() } });
  const page = await getSubscriptionInvoicePage(remoteId, contract.reconciliationOffset);

  let offset = contract.reconciliationOffset;
  for (const invoiceId of page.invoices) {
    if (!hasTimeLeft(startedAt)) break;
    if (invoiceId) await settleSubscription(remoteId, invoiceId);
    offset++;
    await prisma.billingContract.update({ where: { id: contract.id }, data: { reconciliationOffset: offset } });
  }

  const finished = offset === contract.reconciliationOffset + page.invoices.length;
  await prisma.billingContract.update({
    where: { id: contract.id },
    data: {
      lastReconciledAt: new Date(),
      reconciliationOffset: finished && !page.hasMore ? 0 : offset,
    },
  });
}

async function reconcileClinicContracts(clinicId: string, startedAt: number) {
  // Keep checking old contracts too: refunds can arrive after a plan change.
  const contracts = await prisma.billingContract.findMany({
    where: { clinicId, remoteId: { not: null } },
    orderBy: { lastReconciledAt: { sort: "asc", nulls: "first" } },
    take: 5,
  });

  for (const contract of contracts) {
    if (!hasTimeLeft(startedAt)) break;
    const remoteId = contract.remoteId;
    if (!remoteId) continue;

    await reconcileContractInvoices(contract, remoteId, startedAt);
  }
}

/** Devolve true quando o negócio foi conciliado e false quando falhou. */
async function reconcileClinic(clinicId: string, subscriptionId: string, startedAt: number): Promise<boolean> {
  try {
    await settleSubscription(subscriptionId);
    await reconcileClinicContracts(clinicId, startedAt);
    return true;
  } catch (error) {
    logger.error("Falha ao reconciliar cobrança", {
      clinicId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  } finally {
    // Persisted rotation prevents an unavailable account from starving the queue.
    await prisma.clinic.update({ where: { id: clinicId }, data: { billingReconciledAt: new Date() } });
  }
}

export async function reconcileMercadoPagoSubscriptions() {
  const startedAt = Date.now();
  const clinics = await prisma.clinic.findMany({
    where: { mercadoPagoSubscriptionId: { not: null }, deletedAt: null },
    orderBy: [{ billingReconciledAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: 25,
    select: { id: true, mercadoPagoSubscriptionId: true },
  });

  let reconciled = 0;
  let failed = 0;
  for (const clinic of clinics) {
    if (!hasTimeLeft(startedAt)) break;
    // A consulta só traz negócios com assinatura; a checagem mantém o tipo seguro.
    const subscriptionId = clinic.mercadoPagoSubscriptionId;
    if (!subscriptionId) continue;

    const succeeded = await reconcileClinic(clinic.id, subscriptionId, startedAt);
    if (succeeded) reconciled++;
    if (!succeeded) failed++;
  }

  return { checked: reconciled + failed, reconciled, failed, remainingInBatch: clinics.length - reconciled - failed };
}
