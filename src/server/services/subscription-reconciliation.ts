import "server-only";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getSubscriptionInvoicePage } from "./mercado-pago";
import { settleSubscription } from "./billing-settlement";

export async function reconcileMercadoPagoSubscriptions() {
  const started = Date.now();
  const clinics = await prisma.clinic.findMany({
    where: { mercadoPagoSubscriptionId: { not: null }, deletedAt: null },
    orderBy: [{ billingReconciledAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: 25, select: { id: true, mercadoPagoSubscriptionId: true },
  });
  let reconciled = 0;
  let failed = 0;
  for (const clinic of clinics) {
    if (Date.now() - started > 15000) break;
    try {
      await settleSubscription(clinic.mercadoPagoSubscriptionId!);
      // Keep checking old contracts too: refunds can arrive after a plan change.
      const contracts = await prisma.billingContract.findMany({
        where: { clinicId: clinic.id, remoteId: { not: null } },
        orderBy: { lastReconciledAt: { sort: "asc", nulls: "first" } }, take: 5,
      });
      for (const contract of contracts) {
        if (Date.now() - started > 15000) break;
        // Rotate even if a remote invoice is unavailable, so other contracts progress.
        await prisma.billingContract.update({ where: { id: contract.id }, data: { lastReconciledAt: new Date() } });
        const page = await getSubscriptionInvoicePage(contract.remoteId!, contract.reconciliationOffset);
        let offset = contract.reconciliationOffset;
        for (const invoiceId of page.invoices) {
          if (Date.now() - started > 15000) break;
          if (invoiceId) await settleSubscription(contract.remoteId!, invoiceId);
          offset++;
          await prisma.billingContract.update({ where: { id: contract.id }, data: { reconciliationOffset: offset } });
        }
        const finished = offset === contract.reconciliationOffset + page.invoices.length;
        await prisma.billingContract.update({ where: { id: contract.id }, data: {
          lastReconciledAt: new Date(), reconciliationOffset: finished && !page.hasMore ? 0 : offset,
        } });
      }
      reconciled++;
    } catch (error) {
      failed++;
      logger.error("Falha ao reconciliar cobrança", { clinicId: clinic.id, error: error instanceof Error ? error.message : String(error) });
    } finally {
      // Persisted rotation prevents an unavailable account from starving the queue.
      await prisma.clinic.update({ where: { id: clinic.id }, data: { billingReconciledAt: new Date() } });
    }
  }
  return { checked: reconciled + failed, reconciled, failed, remainingInBatch: clinics.length - reconciled - failed };
}
