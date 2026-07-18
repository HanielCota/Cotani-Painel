import { MercadoPagoConfig, PreApproval, WebhookSignatureValidator } from "mercadopago";

import { SubscriptionPlan, SubscriptionStatus } from "@/generated/prisma/enums";

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

function getConfig() {
  if (!accessToken) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não está configurado.");
  }

  return new MercadoPagoConfig({ accessToken });
}

export interface PlanConfig {
  id: SubscriptionPlan;
  name: string;
  price: number;
  mercadoPagoPlanId: string;
}

const PLAN_PRICES: Record<SubscriptionPlan, number> = {
  [SubscriptionPlan.MONTHLY]: 97,
  [SubscriptionPlan.ANNUAL]: 970,
};

export function getPlanConfig(plan: SubscriptionPlan): PlanConfig {
  const envKey = plan === SubscriptionPlan.MONTHLY
    ? "MERCADO_PAGO_MONTHLY_PLAN_ID"
    : "MERCADO_PAGO_ANNUAL_PLAN_ID";
  const mercadoPagoPlanId = process.env[envKey]?.trim();

  if (!mercadoPagoPlanId) {
    throw new Error(`${envKey} não está configurado.`);
  }

  return {
    id: plan,
    name: plan === SubscriptionPlan.MONTHLY ? "Plano Mensal" : "Plano Anual",
    price: PLAN_PRICES[plan],
    mercadoPagoPlanId,
  };
}

export interface CreateCheckoutInput {
  clinicId: string;
  plan: SubscriptionPlan;
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
  const planConfig = getPlanConfig(input.plan);

  const response = await preApproval.create({
    body: {
      preapproval_plan_id: planConfig.mercadoPagoPlanId,
      payer_email: input.payerEmail,
      external_reference: input.clinicId,
      back_url: input.backUrl,
      reason: `Cotani - ${planConfig.name}`,
      status: "pending",
    },
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
}

function normalizeStatus(status?: string): SubscriptionStatus {
  if (!status) return SubscriptionStatus.INACTIVE;

  const normalized = status.toLowerCase();

  if (normalized === "authorized") return SubscriptionStatus.ACTIVE;
  if (normalized === "pending") return SubscriptionStatus.INACTIVE;
  if (normalized === "paused") return SubscriptionStatus.PAST_DUE;
  if (normalized === "cancelled" || normalized === "canceled") return SubscriptionStatus.CANCELED;

  return SubscriptionStatus.INACTIVE;
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
  };
}

export interface SyncSubscriptionInput {
  mercadoPagoSubscriptionId: string;
}

export interface SyncSubscriptionResult {
  mercadoPagoSubscriptionId: string;
  status: SubscriptionStatus;
  hasPaidOnce: boolean;
  nextPaymentDate?: Date;
}

export async function syncSubscriptionFromMercadoPago(
  input: SyncSubscriptionInput,
): Promise<SyncSubscriptionResult> {
  const subscription = await getSubscriptionFromMercadoPago(input.mercadoPagoSubscriptionId);
  const status = normalizeStatus(subscription.status);

  return {
    mercadoPagoSubscriptionId: subscription.id,
    status,
    hasPaidOnce: status === SubscriptionStatus.ACTIVE,
    nextPaymentDate: subscription.nextPaymentDate,
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
