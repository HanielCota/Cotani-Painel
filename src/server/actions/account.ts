"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureCurrentAppUser, requireAuthenticatedUser } from "@/server/auth";
import type { ActionResult } from "@/types";

export async function updateAccountProfile(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const parsed = z
    .object({ name: z.string().trim().min(2).max(120), email: z.email().trim().toLowerCase() })
    .safeParse({ name: formData.get("name"), email: formData.get("email") });
  if (!parsed.success) return { status: "error", message: "Revise seu nome e e-mail." };
  const { authUser, appUser } = await ensureCurrentAppUser();
  const emailChanged = authUser.email?.toLowerCase() !== parsed.data.email;
  if (emailChanged) {
    const { error } = await (
      await createClient()
    ).auth.updateUser({ email: parsed.data.email, data: { name: parsed.data.name } });
    if (error) return { status: "error", message: "Não foi possível iniciar a troca de e-mail." };
  }

  if (!emailChanged) await (await createClient()).auth.updateUser({ data: { name: parsed.data.name } });
  await prisma.user.update({ where: { id: appUser.id }, data: { name: parsed.data.name } });
  revalidatePath("/dashboard", "layout");
  return {
    status: "success",
    message: emailChanged
      ? "Perfil salvo. Confirme o novo e-mail pelos links enviados."
      : "Perfil e preferências salvos.",
  };
}

export async function deleteOwnAccount(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  if (String(formData.get("confirmation") ?? "") !== "EXCLUIR MINHA CONTA")
    return { status: "error", message: "Digite EXCLUIR MINHA CONTA para confirmar." };
  const authUser = await requireAuthenticatedUser();
  const { appUser } = await ensureCurrentAppUser();
  const memberships = await prisma.membership.findMany({
    where: { userId: appUser.id },
    select: { id: true, clinicId: true, role: true },
  });
  for (const membership of memberships.filter((item) => item.role === "ADMIN")) {
    const admins = await prisma.membership.count({ where: { clinicId: membership.clinicId, role: "ADMIN" } });
    if (admins <= 1)
      return { status: "error", message: "Transfira a administração dos seus negócios antes de excluir a conta." };
  }
  const blockedByAdministration = await prisma.$transaction(async (transaction) => {
    const administeredClinicIds = memberships
      .filter((item) => item.role === "ADMIN")
      .map((item) => item.clinicId)
      .sort();
    for (const clinicId of administeredClinicIds) {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinicId}, 0))`;
    }
    for (const clinicId of administeredClinicIds) {
      const admins = await transaction.membership.count({ where: { clinicId, role: "ADMIN" } });
      if (admins <= 1) return true;
    }
    await transaction.professional.updateMany({
      where: { membership: { userId: appUser.id } },
      data: { membershipId: null },
    });
    await transaction.membership.deleteMany({ where: { userId: appUser.id } });
    await transaction.user.delete({ where: { id: appUser.id } });
    return false;
  });
  if (blockedByAdministration)
    return { status: "error", message: "Transfira a administração dos seus negócios antes de excluir a conta." };
  const { error } = await createAdminClient().auth.admin.deleteUser(authUser.id);
  if (error)
    return {
      status: "error",
      message: "Dados removidos, mas o acesso de autenticação precisa ser encerrado pelo suporte.",
    };
  return { status: "success", message: "Conta excluída." };
}
