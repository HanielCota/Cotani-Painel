import "server-only";

import { isIP } from "node:net";
import { Invoice, Payment, PaymentRefund, MercadoPagoConfig, PreApproval, WebhookSignatureValidator } from "mercadopago";

import { BillingCycle, SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/enums";
import {
  getMercadoPagoPlanEnvKey,
  getPlanPrice,
  getProductPlan,
} from "@/config/subscription-plans";

function getConfig() {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não está configurado.");
  }

  return new MercadoPagoConfig({ accessToken, options: { timeout: 10000, maxRetries: 0 } });
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

/** Confere erros locais antes de reservar uma loja e um contrato de checkout. */
export function assertSubscriptionCheckoutReady(plan: SubscriptionPlan, cycle: BillingCycle, backUrl: string): PlanConfig {
  getConfig();
  const config = getPlanConfig(plan, cycle);
  let url: URL;
  try {
    url = new URL(backUrl);
  } catch {
    throw new Error("LANDING_PAGE_URL não é uma URL válida para o retorno do checkout.");
  }
  const hostname = url.hostname.toLowerCase();
  const localHost = hostname === "localhost" || [".localhost", ".local", ".test", ".invalid", ".internal"].some((suffix) => hostname.endsWith(suffix));
  if (url.protocol !== "https:" || !hostname || localHost || isIP(hostname.replace(/^\[|\]$/g, "")) !== 0
    || url.username || url.password || url.hash) {
    throw new Error("LANDING_PAGE_URL deve usar HTTPS público para o retorno do checkout.");
  }
  return config;
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

function parseMercadoPagoCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const officialHost = hostname === "mercadopago.com"
      || hostname.endsWith(".mercadopago.com")
      || hostname === "mercadopago.com.br"
      || hostname.endsWith(".mercadopago.com.br");
    return url.protocol === "https:" && officialHost ? url : null;
  } catch {
    return null;
  }
}

export function isMercadoPagoCheckoutUrl(value: string) {
  return parseMercadoPagoCheckoutUrl(value) !== null;
}

export function normalizeMercadoPagoCheckoutUrl(value: string) {
  const url = parseMercadoPagoCheckoutUrl(value);
  if (!url) return null;

  if (url.pathname === "/subscriptions/checkout" && url.searchParams.get("activation") === "true") {
    url.searchParams.delete("activation");
  }

  return url.toString();
}

export function buildHostedSubscriptionBody(input: CreateCheckoutInput, planConfig: PlanConfig) {
  return {
    payer_email: input.payerEmail,
    external_reference: input.clinicId,
    back_url: input.backUrl,
    reason: `Cotani - ${planConfig.name}`,
    auto_recurring: {
      frequency: input.cycle === BillingCycle.ANNUAL ? 12 : 1,
      frequency_type: "months" as const,
      transaction_amount: planConfig.price,
      currency_id: "BRL" as const,
    },
    status: "pending" as const,
  };
}

export async function createSubscriptionCheckout(
  input: CreateCheckoutInput,
): Promise<CreateCheckoutResult> {
  const config = getConfig();
  const preApproval = new PreApproval(config);
  const planConfig = getPlanConfig(input.plan, input.cycle);

  const response = await preApproval.create({
    body: buildHostedSubscriptionBody(input, planConfig),
    requestOptions: { idempotencyKey: input.idempotencyKey },
  });

  const checkoutUrl = response.init_point
    ? normalizeMercadoPagoCheckoutUrl(response.init_point)
    : null;

  if (!response.id || !checkoutUrl) {
    throw new Error("O Mercado Pago não retornou os dados necessários para o checkout.");
  }

  return {
    checkoutUrl,
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
  amount?: number;
  currency?: string;
}

export function normalizeSubscriptionStatus(status?: string): SubscriptionStatus | null {
  if (!status) return null;

  const normalized = status.toLowerCase();

  // Authorization permits future charges; it is not proof of payment.
  if (normalized === "authorized") return null;
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
  // Anchor to the verified invoice date, never to webhook delivery or next charge.
  void nextPaymentDate;
  if (!cycle || Number.isNaN(now.getTime())) throw new Error("Período pago inválido.");
  const end = new Date(now);
  const day = end.getUTCDate();
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + (cycle === BillingCycle.ANNUAL ? 12 : 1));
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(day, lastDay));
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
    amount: response.auto_recurring?.transaction_amount,
    currency: response.auto_recurring?.currency_id,
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
  amount?: number;
  currency?: string;
}

export async function syncSubscriptionFromMercadoPago(
  input: SyncSubscriptionInput,
): Promise<SyncSubscriptionResult> {
  const subscription = await getSubscriptionFromMercadoPago(input.mercadoPagoSubscriptionId);
  const status = normalizeSubscriptionStatus(subscription.status);

  return {
    mercadoPagoSubscriptionId: subscription.id,
    status,
    hasPaidOnce: false,
    nextPaymentDate: subscription.nextPaymentDate,
    externalReference: subscription.externalReference,
    planId: subscription.planId,
    rawStatus: subscription.status,
    amount: subscription.amount,
    currency: subscription.currency,
  };
}

export async function cancelMercadoPagoSubscription(mercadoPagoSubscriptionId: string): Promise<void> {
  const current = await getSubscriptionFromMercadoPago(mercadoPagoSubscriptionId);
  if (current.status === "paused" || current.status === "cancelled" || current.status === "canceled") return;
  // Pausar interrompe novas cobranças e permite desfazer o cancelamento antes
  // do vencimento do período já pago.
  await new PreApproval(getConfig()).update({ id: mercadoPagoSubscriptionId, body: { status: "paused" } });
}

export async function reactivateMercadoPagoSubscription(mercadoPagoSubscriptionId: string): Promise<void> {
  const current = await getSubscriptionFromMercadoPago(mercadoPagoSubscriptionId);
  if (current.status === "authorized") return;
  if (current.status !== "paused") throw new Error("Somente uma assinatura pausada pode ser reativada.");
  await new PreApproval(getConfig()).update({ id: mercadoPagoSubscriptionId, body: { status: "authorized" } });
}

export async function updateMercadoPagoSubscriptionAmount(
  mercadoPagoSubscriptionId: string,
  amount: number,
  reason: string,
): Promise<void> {
  await new PreApproval(getConfig()).update({
    id: mercadoPagoSubscriptionId,
    body: { auto_recurring: { transaction_amount: amount, currency_id: "BRL" }, reason },
  });
}

export async function refundMercadoPagoPayment(paymentId: string, idempotencyKey: string): Promise<void> {
  await new PaymentRefund(getConfig()).total({ payment_id: paymentId, requestOptions: { idempotencyKey } });
}

export interface MercadoPagoInvoice {
  id: string;
  subscriptionId: string;
  paymentId: string;
  amount: number;
  status: string;
  paidAt?: Date;
  periodStartsAt?: Date;
  currency: string;
}

const MERCADO_PAGO_INVOICE_PAGE_SIZE = 10;

export async function getInvoiceFromMercadoPago(invoiceId: string): Promise<MercadoPagoInvoice> {
  const invoice = await new Invoice(getConfig()).get({ id: invoiceId });
  const id = String(invoice.id ?? invoiceId);
  const subscriptionId = invoice.preapproval_id?.trim();

  if (!subscriptionId || typeof invoice.transaction_amount !== "number") {
    throw new Error("Fatura do Mercado Pago sem assinatura ou valor para conciliação.");
  }

  if (!invoice.payment?.id) throw new Error("Fatura ainda sem pagamento vinculado.");
  const payment = await new Payment(getConfig()).get({ id: invoice.payment.id });
  const fullyRefunded = typeof payment.transaction_amount === "number" && payment.transaction_amount > 0
    && (payment.transaction_amount_refunded ?? 0) >= payment.transaction_amount;
  const status = fullyRefunded ? "refunded" : payment.status ?? "unknown";
  const date = payment.date_approved;
  if (status === "approved" && (!date || Number.isNaN(new Date(date).getTime()))) throw new Error("Pagamento sem data de aprovação válida.");
  if (typeof payment.transaction_amount !== "number") throw new Error("Pagamento sem valor.");

  return {
    id,
    subscriptionId,
    paymentId: String(invoice.payment?.id ?? id),
    amount: payment.transaction_amount,
    currency: payment.currency_id ?? "",
    status,
    paidAt: status === "approved" && date ? new Date(date) : undefined,
    periodStartsAt: invoice.debit_date ? new Date(invoice.debit_date) : date ? new Date(date) : undefined,
  };
}

export async function searchSubscriptionInvoices(subscriptionId?: string, paymentId?: string) {
  const ids: string[] = [];
  for (let offset = 0; ; offset += MERCADO_PAGO_INVOICE_PAGE_SIZE) {
    const page = await new Invoice(getConfig()).search({ options: {
      ...(subscriptionId ? { preapproval_id: subscriptionId } : {}),
      ...(paymentId ? { payment_id: Number(paymentId) } : {}),
      offset,
      limit: MERCADO_PAGO_INVOICE_PAGE_SIZE,
    } });
    for (const invoice of page.results ?? []) if (invoice.id && invoice.payment?.id) ids.push(String(invoice.id));
    if ((page.results?.length ?? 0) < MERCADO_PAGO_INVOICE_PAGE_SIZE) break;
    if (offset >= 9900) throw new Error("Paginação de faturas excedeu o limite de segurança.");
  }
  return ids;
}

export async function getSubscriptionInvoicePage(subscriptionId: string, offset: number) {
  const page = await new Invoice(getConfig()).search({
    options: { preapproval_id: subscriptionId, offset, limit: MERCADO_PAGO_INVOICE_PAGE_SIZE },
  });
  const results = page.results ?? [];
  return {
    invoices: results.map((invoice) => invoice.id && invoice.payment?.id ? String(invoice.id) : null),
    hasMore: results.length === MERCADO_PAGO_INVOICE_PAGE_SIZE,
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
