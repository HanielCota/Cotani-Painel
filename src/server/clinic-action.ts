import "server-only";

import type { ClinicRole } from "@/generated/prisma/enums";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";

type ActionClinic = NonNullable<Awaited<ReturnType<typeof getClinicForRoles>>>;

export type ClinicActionAccess =
  | { ok: true; clinic: ActionClinic }
  | { ok: false; result: Extract<ActionResult, { status: "error" }> };

/**
 * Preâmbulo comum das Server Actions do painel: resolve o negócio ativo com o
 * papel exigido e confere a assinatura. Em falha, devolve o `ActionResult` de
 * erro pronto para retornar:
 *
 *     const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de salvar.");
 *     if (!access.ok) return access.result;
 *     const { clinic } = access;
 */
export async function requireClinicAction(roles: readonly ClinicRole[], noClinicMessage = "Selecione um negócio."): Promise<ClinicActionAccess> {
  const clinic = await getClinicForRoles(roles);
  if (!clinic) return { ok: false, result: { status: "error", message: noClinicMessage } };
  if (!isSubscriptionActive(clinic)) return { ok: false, result: { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE } };
  return { ok: true, clinic };
}
