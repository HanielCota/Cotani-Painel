"use server";

import { MercadoPagoConfig, PreApproval } from "mercadopago";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { getTenantContext } from "@/server/tenant";
import type { ActionResult } from "@/types";

const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();

export async function cancelSubscription(): Promise<ActionResult> {
  try {
    const tenant = await getTenantContext();

    if (!tenant) {
      return { status: "error", message: "Nenhuma barbearia encontrada para este usuário." };
    }

    const { clinic } = tenant;

    if (clinic.subscriptionStatus !== SubscriptionStatus.ACTIVE && clinic.subscriptionStatus !== SubscriptionStatus.PAST_DUE) {
      return { status: "error", message: "Não há assinatura ativa para cancelar." };
    }

    if (!clinic.mercadoPagoSubscriptionId || !accessToken) {
      // Sem integração com Mercado Pago: apenas marca como cancelada localmente.
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: { subscriptionStatus: SubscriptionStatus.CANCELED },
      });

      return { status: "success", message: "Assinatura cancelada com sucesso." };
    }

    const config = new MercadoPagoConfig({ accessToken });
    const preApproval = new PreApproval(config);

    await preApproval.update({
      id: clinic.mercadoPagoSubscriptionId,
      body: { status: "cancelled" },
    });

    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { subscriptionStatus: SubscriptionStatus.CANCELED },
    });

    return { status: "success", message: "Assinatura cancelada com sucesso." };
  } catch (error) {
    console.error("[cancelSubscription] Erro ao cancelar assinatura:", error);
    return { status: "error", message: "Não foi possível cancelar a assinatura. Tente novamente em instantes." };
  }
}
