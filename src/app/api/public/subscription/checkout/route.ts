import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BillingCycle, SubscriptionPlan } from "@/generated/prisma/enums";
import { isAllowedLandingOrigin, landingCorsHeaders } from "@/lib/landing-cors";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { readRequestText, RequestBodyTooLargeError } from "@/lib/request-body";
import { createLandingCheckout, LandingCheckoutConflictError } from "@/server/services/landing-checkout";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  business: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(10).max(20).refine((value) => {
    const digits = value.replace(/\D/g, "");
    return /^\+?[\d\s().-]+$/.test(value) && digits.length >= 10 && digits.length <= 13;
  }),
  plan: z.enum(["essential", "professional"]),
  cycle: z.enum(["mensal", "anual"]),
  acceptedTerms: z.literal(true),
  website: z.string().max(0).optional(),
});

function json(request: Request, body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: landingCorsHeaders(request) });
}

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}

export function OPTIONS(request: NextRequest) {
  if (!isAllowedLandingOrigin(request)) return json(request, { message: "Origem não permitida." }, 403);
  return new NextResponse(null, { status: 204, headers: landingCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  if (!isAllowedLandingOrigin(request)) return json(request, { message: "Origem não permitida." }, 403);
  try {
    let body: unknown;
    try {
      body = JSON.parse(await readRequestText(request, 16 * 1024));
    } catch (error) {
      return json(request, { message: "Dados inválidos." }, error instanceof RequestBodyTooLargeError ? 413 : 400);
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return json(request, { message: "Revise os dados informados e tente novamente." }, 400);

    const [ipLimit, emailLimit] = await Promise.all([
      rateLimit({ key: `landing-checkout:ip:${clientIp(request)}`, limit: 10, windowMs: 60 * 60_000 }),
      rateLimit({ key: `landing-checkout:email:${parsed.data.email}`, limit: 3, windowMs: 60 * 60_000 }),
    ]);
    if (!ipLimit.success || !emailLimit.success) {
      return json(request, { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }, 429);
    }

    const result = await createLandingCheckout({
      name: parsed.data.name,
      email: parsed.data.email,
      business: parsed.data.business,
      phone: parsed.data.phone,
      plan: parsed.data.plan === "professional" ? SubscriptionPlan.PROFESSIONAL : SubscriptionPlan.ESSENTIAL,
      cycle: parsed.data.cycle === "anual" ? BillingCycle.ANNUAL : BillingCycle.MONTHLY,
    });
    return json(request, result, 201);
  } catch (error) {
    if (error instanceof LandingCheckoutConflictError) return json(request, { message: error.message }, 409);
    logger.error("Falha ao iniciar checkout público da landing", { error: error instanceof Error ? error.message : String(error) });
    return json(request, { message: "Não foi possível abrir o pagamento agora. Tente novamente em instantes." }, 500);
  }
}
