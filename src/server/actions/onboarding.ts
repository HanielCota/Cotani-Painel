"use server";

import prisma from "@/lib/prisma";
import { requireClinicAction } from "@/server/clinic-action";
import type { ActionResult } from "@/types";

/**
 * Registra no negócio que o link de agendamento foi copiado (passo "Divulgar
 * link" do checklist). Grava só a primeira vez; repetir não altera a data.
 */
export async function markBookingLinkSharedOnServer(): Promise<ActionResult> {
  const access = await requireClinicAction(["ADMIN", "RECEPTIONIST"]);
  if (!access.ok) return access.result;

  await prisma.clinic.updateMany({
    where: { id: access.clinic.id, bookingLinkSharedAt: null },
    data: { bookingLinkSharedAt: new Date() },
  });
  return { status: "success", message: "" };
}
