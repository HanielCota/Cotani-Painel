import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { SubscriptionPlan } from "@/generated/prisma/enums";
import { createSubscriptionCheckout } from "@/server/services/mercado-pago";
import { getTenantContext } from "@/server/tenant";

const checkoutSchema = z.object({
  plan: z.enum([SubscriptionPlan.MONTHLY, SubscriptionPlan.ANNUAL]),
});

export async function POST(request: NextRequest) {
  const parsed = checkoutSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ message: "Plano inválido. Escolha mensal ou anual." }, { status: 400 });
  }

  try {
    const { clinic } = await getTenantContext();
    const { userId } = await auth();

    const user = await prisma.user.findUnique({
      where: { clerkUserId: userId ?? undefined },
      select: { email: true },
    });

    const payerEmail = user?.email ?? clinic.name;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const backUrl = appUrl
      ? `${appUrl.replace(/\/$/, "")}/dashboard/assinatura`
      : `${request.nextUrl.origin}/dashboard/assinatura`;

    const { checkoutUrl, mercadoPagoSubscriptionId } = await createSubscriptionCheckout({
      clinicId: clinic.id,
      plan: parsed.data.plan,
      payerEmail,
      backUrl,
    });

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: {
        mercadoPagoSubscriptionId,
        subscriptionPlan: parsed.data.plan,
      },
    });

    return NextResponse.json({ checkoutUrl });
  } catch (error) {
    console.error("[subscription/checkout] Falha ao criar checkout", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar o checkout. Tente novamente.",
      },
      { status: 500 },
    );
  }
}
