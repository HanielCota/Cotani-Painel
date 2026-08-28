import { Invoice, MercadoPagoConfig, PreApproval, WebhookSignatureValidator } from "mercadopago";

import { BillingCycle, SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/enums";
import {
  getMercadoPagoPlanEnvKey,
  getPlanPrice,
  getProductPlan,
} from "@/config/subscription-plans";

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

function getConfig() {
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não está configurado.");
  }

  return new MercadoPagoConfig({ accessToken });
}

export interface PlanConfig {
  id: SubscriptionPlan;
  cycle: BillingCycle;
  name: string;
  price: number;
  mercadoPagoPlanId: string;
}

export function getPlanConfig(plan: SubscriptionPlan, cycle: BillingCycle): PlanConfig {
  const product = getProductPlan(plan);
  if (!product.selfServiceCheckout) {
    throw new Error("O plano Empresa é contratado diretamente com a equipe Cotani.");
  }

  const envKey = getMercadoPagoPlanEnvKey(plan, cycle);
  const mercadoPagoPlanId = process.env[envKey]?.trim();

  if (!mercadoPagoPlanId) {
    throw new Error(`${envKey} não está configurado.`);
  }

  return {
    id: plan,
    cycle,
    name: `${product.name} ${cycle === BillingCycle.ANNUAL ? "Anual" : "Mensal"}`,
    price: getPlanPrice(plan, cycle),
    mercadoPagoPlanId,
  };
}

export interface CreateCheckoutInput {
  clinicId: string;
  plan: SubscriptionPlan;
  cycle: BillingCycle;
  idempotencyKey: string;
  payerEmail: string;
  backUrl: string;
}

export interface CreateCheckoutResult {
  checkoutUrl: string;
  mercadoPagoSubscriptionId: string;
}

export async function createSubscriptionCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const config = getConfig();
  const preApproval = new PreApproval(config);
  const planConfig = getPlanConfig(input.plan, input.cycle);

  const response = await preApproval.create({
    body: {
      preapproval_plan_id: planConfig.mercadoPagoPlanId,
      payer_email: input.payerEmail,
      external_reference: input.clinicId,
      back_url: input.backUrl,
      reason: `Cotani - ${planConfig.name}`,
      status: "pending",
    },
    requestOptions: { idempotencyKey: input.idempotencyKey },
  });

  if (!response.id || !response.init_point) {
    throw new Error("O Mercado Pago não retornou os dados necessários para o checkout.");
  }

  return {
    checkoutUrl: response.init_point,
    mercadoPagoSubscriptionId: String(response.id),
  };
}

export interface MercadoPagoSubscription {
  id: string;
  status: string;
  payerEmail?: string;
  externalReference?: string;
  nextPaymentDate?: Date;
  planId?: string;
}

export function normalizeSubscriptionStatus(status?: string): SubscriptionStatus | null {
  if (!status) return null;

  const normalized = status.toLowerCase();

  if (normalized === "authorized") return SubscriptionStatus.ACTIVE;
  if (normalized === "pending") return null;
  if (normalized === "paused") return SubscriptionStatus.PAST_DUE;
  if (normalized === "cancelled" || normalized === "canceled") return SubscriptionStatus.CANCELED;

  return null;
}

function stringId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "object" && value !== null && "id" in value && typeof value.id === "string") return value.id;
  return undefined;
}

export function subscriptionPeriodEnd(cycle: BillingCycle | null | undefined, nextPaymentDate?: Date, now = new Date()): Date {
  if (nextPaymentDate && !Number.isNaN(nextPaymentDate.getTime()) && nextPaymentDate > now) return nextPaymentDate;
  const end = new Date(now);
  if (cycle === BillingCycle.ANNUAL) end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

export async function getSubscriptionFromMercadoPago(
  mercadoPagoSubscriptionId: string,
): Promise<MercadoPagoSubscription> {
  const config = getConfig();
  const preApproval = new PreApproval(config);

  const response = await preApproval.get({ id: mercadoPagoSubscriptionId });

  return {
    id: String(response.id ?? mercadoPagoSubscriptionId),
    status: response.status ?? "unknown",
    payerEmail: response.payer_email ?? undefined,
    externalReference: response.external_reference ?? undefined,
    nextPaymentDate: response.next_payment_date ? new Date(response.next_payment_date) : undefined,
    planId: stringId((response as typeof response & { preapproval_plan_id?: unknown }).preapproval_plan_id),
  };
}

export interface SyncSubscriptionInput {
  mercadoPagoSubscriptionId: string;
}

export interface SyncSubscriptionResult {
  mercadoPagoSubscriptionId: string;
  status: SubscriptionStatus | null;
  hasPaidOnce: boolean;
  nextPaymentDate?: Date;
  externalReference?: string;
  planId?: string;
  rawStatus: string;
}

export async function syncSubscriptionFromMercadoPago(
  input: SyncSubscriptionInput,
): Promise<SyncSubscriptionResult> {
  const subscription = await getSubscriptionFromMercadoPago(input.mercadoPagoSubscriptionId);
  const status = normalizeSubscriptionStatus(subscription.status);

  return {
    mercadoPagoSubscriptionId: subscription.id,
    status,
    hasPaidOnce: status === SubscriptionStatus.ACTIVE,
    nextPaymentDate: subscription.nextPaymentDate,
    externalReference: subscription.externalReference,
    planId: subscription.planId,
    rawStatus: subscription.status,
  };
}

export async function cancelMercadoPagoSubscription(mercadoPagoSubscriptionId: string): Promise<void> {
  await new PreApproval(getConfig()).update({ id: mercadoPagoSubscriptionId, body: { status: "cancelled" } });
}

export interface MercadoPagoInvoice {
  id: string;
  subscriptionId: string;
  paymentId: string;
  amount: number;
  status: string;
  paidAt?: Date;
}

export async function getInvoiceFromMercadoPago(invoiceId: string): Promise<MercadoPagoInvoice> {
  const invoice = await new Invoice(getConfig()).get({ id: invoiceId });
  const id = String(invoice.id ?? invoiceId);
  const subscriptionId = invoice.preapproval_id?.trim();

  if (!subscriptionId || typeof invoice.transaction_amount !== "number") {
    throw new Error("Fatura do Mercado Pago sem assinatura ou valor para conciliação.");
  }

  const status = invoice.payment?.status ?? invoice.status ?? "unknown";
  const date = invoice.last_modified ?? invoice.date_created ?? invoice.debit_date;

  return {
    id,
    subscriptionId,
    paymentId: String(invoice.payment?.id ?? id),
    amount: invoice.transaction_amount,
    status,
    paidAt: status === "approved" && date ? new Date(date) : undefined,
  };
}

export interface ValidateWebhookInput {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}

export function validateMercadoPagoWebhook(input: ValidateWebhookInput): void {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET?.trim();

  if (!secret) {
    // Em desenvolvimento podemos aceitar sem validar, mas logamos um aviso.
    if (process.env.NODE_ENV === "development") {
      console.warn("[mercado-pago-webhook] MERCADO_PAGO_WEBHOOK_SECRET não configurado. Ignorando validação de assinatura em desenvolvimento.");
      return;
    }

    throw new Error("MERCADO_PAGO_WEBHOOK_SECRET não está configurado.");
  }

  WebhookSignatureValidator.validate({
    xSignature: input.xSignature,
    xRequestId: input.xRequestId,
    dataId: input.dataId,
    secret,
  });
}
