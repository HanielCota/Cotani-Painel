import "server-only";

import { randomUUID } from "node:crypto";
import { BillingCycle, ClinicRole, SubscriptionPlan } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSubscriptionCheckoutReady, createSubscriptionCheckout } from "@/server/services/mercado-pago";
import { generateClinicSlug } from "@/server/services/clinic-provisioning";
import { landingPageUrl } from "@/lib/landing-cors";
import { ignoreFailure } from "@/lib/ignore-failure";

const LANDING_SOURCE = "LANDING";
const ACTIVE_ATTEMPT_MS = 24 * 60 * 60_000;
const ACTIVATION_LEASE_MS = 10 * 60_000;

export interface LandingCheckoutInput {
  name: string;
  email: string;
  business: string;
  phone: string;
  plan: SubscriptionPlan;
  cycle: BillingCycle;
}

export class LandingCheckoutConflictError extends Error {}

export async function createLandingCheckout(input: LandingCheckoutInput) {
  const landingOrigin = landingPageUrl();
  const config = assertSubscriptionCheckoutReady(input.plan, input.cycle, `${landingOrigin}/checkout/retorno`);
  const recentSince = new Date(Date.now() - ACTIVE_ATTEMPT_MS);
  const attempt = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.email}, 0))`;

    const existingMember = await tx.user.findFirst({
      where: {
        email: { equals: input.email, mode: "insensitive" },
        memberships: { some: {} },
      },
      select: { id: true },
    });
    if (existingMember) {
      throw new LandingCheckoutConflictError(
        "Este e-mail já possui uma conta. Entre no painel para contratar ou gerenciar o plano.",
      );
    }

    const recent = await tx.billingContract.findFirst({
      where: {
        checkoutSource: LANDING_SOURCE,
        checkoutEmail: input.email,
        createdAt: { gte: recentSince },
        state: { in: ["CREATING", "pending", "authorized"] },
      },
      orderBy: { createdAt: "desc" },
      include: { clinic: { select: { id: true } } },
    });

    if (recent) {
      if (recent.plan !== input.plan || recent.cycle !== input.cycle) {
        throw new LandingCheckoutConflictError(
          "Já existe um checkout recente para outro plano. Conclua-o ou aguarde antes de trocar.",
        );
      }
      if (recent.checkoutUrl) {
        return { contract: recent, clinicId: recent.clinic.id, resumeUrl: recent.checkoutUrl };
      }
      return { contract: recent, clinicId: recent.clinic.id, resumeUrl: null };
    }

    const clinicId = randomUUID();
    const contractId = randomUUID();
    await tx.clinic.create({
      data: {
        id: clinicId,
        name: input.business,
        slug: generateClinicSlug(input.business, clinicId),
        contactEmail: input.email,
        phone: input.phone,
        subscriptionStatus: "INACTIVE",
        pendingSubscriptionPlan: input.plan,
        pendingSubscriptionCycle: input.cycle,
        mercadoPagoCheckoutKey: contractId,
        mercadoPagoCheckoutStartedAt: new Date(),
      },
    });
    const contract = await tx.billingContract.create({
      data: {
        id: contractId,
        clinicId,
        plan: input.plan,
        cycle: input.cycle,
        amount: config.price,
        remotePlanId: null,
        checkoutSource: LANDING_SOURCE,
        checkoutEmail: input.email,
        checkoutName: input.name,
      },
      include: { clinic: { select: { id: true } } },
    });
    return { contract, clinicId, resumeUrl: null };
  });

  if (attempt.resumeUrl) {
    return { checkoutId: attempt.contract.id, checkoutUrl: attempt.resumeUrl, resumed: true };
  }

  const backUrl = `${landingOrigin}/checkout/retorno?checkout=${encodeURIComponent(attempt.contract.id)}`;
  // A chave é reaproveitada quando uma resposta remota é ambígua. Assim, um
  // timeout não pode gerar duas assinaturas recorrentes para a mesma pessoa.
  const remote = await createSubscriptionCheckout({
    clinicId: attempt.clinicId,
    plan: attempt.contract.plan,
    cycle: attempt.contract.cycle,
    idempotencyKey: attempt.contract.id,
    payerEmail: input.email,
    backUrl,
  });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${attempt.clinicId}, 0))`;
    await tx.billingContract.update({
      where: { id: attempt.contract.id },
      data: { remoteId: remote.mercadoPagoSubscriptionId, checkoutUrl: remote.checkoutUrl, state: "pending" },
    });
    await tx.clinic.update({
      where: { id: attempt.clinicId, mercadoPagoCheckoutKey: attempt.contract.id },
      data: {
        mercadoPagoSubscriptionId: remote.mercadoPagoSubscriptionId,
        mercadoPagoCheckoutUrl: remote.checkoutUrl,
        cancelAtPeriodEnd: false,
      },
    });
  });
  return { checkoutId: attempt.contract.id, checkoutUrl: remote.checkoutUrl, resumed: false };
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://painel.cotani.com.br").replace(/\/$/, "");
}

async function sendExistingAccountEmail(email: string, name: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Credenciais de e-mail não configuradas.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Pagamento confirmado - seu acesso à Cotani está liberado",
      text: `Olá, ${name}. Seu pagamento foi confirmado e seu negócio já está liberado na Cotani. Entre com este mesmo e-mail em ${appUrl()}/sign-in. Se não lembrar sua senha, use a opção \"Esqueci minha senha\".`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Falha ao enviar e-mail de acesso (HTTP ${response.status}).`);
}

function isAlreadyRegisteredError(error: { code?: string; message?: string }) {
  return /already|registered|exists|existente/.test(`${error.code ?? ""} ${error.message ?? ""}`.toLowerCase());
}

/**
 * Entrega o acesso ao comprador: conta já ativa recebe o aviso por e-mail;
 * conta nova recebe o convite do Supabase (ou o aviso, se já existir lá).
 */
async function deliverAccess(
  email: string,
  name: string,
  clinicId: string,
  user: { id: string; authUserId: string | null },
) {
  if (user.authUserId) {
    await sendExistingAccountEmail(email, name);
    return;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    data: { name, source: "landing_checkout", clinic_id: clinicId },
    redirectTo: `${appUrl()}/update-password`,
  });
  if (error && !isAlreadyRegisteredError(error)) throw new Error(`Falha ao enviar convite de acesso: ${error.message}`);

  if (error) {
    await sendExistingAccountEmail(email, name);
    return;
  }

  const authUserId = data.user?.id;
  if (!authUserId) return;

  await prisma.user.updateMany({ where: { id: user.id, authUserId: null }, data: { authUserId } });
}

export async function finalizeLandingCheckoutAccess(remoteId: string) {
  const contract = await prisma.billingContract.findUnique({
    where: { remoteId },
    include: { clinic: { select: { id: true, hasPaidOnce: true } } },
  });
  if (
    !contract ||
    contract.checkoutSource !== LANDING_SOURCE ||
    !contract.checkoutEmail ||
    !contract.clinic.hasPaidOnce ||
    contract.activationSentAt
  )
    return;

  // Já validado acima; a constante mantém o tipo dentro da transação.
  const checkoutEmail = contract.checkoutEmail;

  const claimed = await prisma.billingContract.updateMany({
    where: {
      id: contract.id,
      activationSentAt: null,
      OR: [{ activationStartedAt: null }, { activationStartedAt: { lt: new Date(Date.now() - ACTIVATION_LEASE_MS) } }],
    },
    data: { activationStartedAt: new Date(), activationError: null },
  });
  if (claimed.count === 0) return;

  try {
    const user = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${checkoutEmail}, 0))`;
      const existingUser = await tx.user.findFirst({
        where: { email: { equals: checkoutEmail, mode: "insensitive" } },
        orderBy: { createdAt: "asc" },
      });
      const appUser = existingUser ?? await tx.user.create({
        data: {
          email: checkoutEmail,
          name: contract.checkoutName || checkoutEmail.split("@")[0],
        },
      });
      await tx.membership.upsert({
        where: { clinicId_userId: { clinicId: contract.clinicId, userId: appUser.id } },
        create: { clinicId: contract.clinicId, userId: appUser.id, role: ClinicRole.ADMIN },
        update: { role: ClinicRole.ADMIN },
      });
      return appUser;
    });

    await deliverAccess(checkoutEmail, contract.checkoutName || user.name, contract.clinicId, user);

    await prisma.billingContract.update({
      where: { id: contract.id },
      data: { activationSentAt: new Date(), activationStartedAt: null, activationError: null },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await ignoreFailure(
      prisma.billingContract.update({
        where: { id: contract.id },
        data: { activationStartedAt: null, activationError: message.slice(0, 500) },
      }),
      "Falha ao registrar o erro de ativação do checkout",
    );
    throw error;
  }
}

export async function getLandingCheckoutStatus(checkoutId: string) {
  const contract = await prisma.billingContract.findFirst({
    where: { id: checkoutId, checkoutSource: LANDING_SOURCE },
    select: { state: true, activationSentAt: true, clinic: { select: { hasPaidOnce: true } } },
  });
  if (!contract) return null;
  if (contract.activationSentAt) return "approved" as const;
  if (contract.clinic.hasPaidOnce) return "activating" as const;
  if (["FAILED", "cancelled", "canceled"].includes(contract.state)) return "failed" as const;
  return "processing" as const;
}
