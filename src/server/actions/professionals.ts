"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getPlanEntitlements } from "@/config/subscription-plans";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";
import { persistPublicImage, removePublicImage } from "@/server/services/media-storage";

const MAX_IMAGE_SIZE_CHARS = 2_000_000;

const imageUrlSchema = z
  .union([z.string().trim().max(MAX_IMAGE_SIZE_CHARS), z.null(), z.literal("")])
  .optional()
  .transform((value) => {
    if (!value || value === "") return null;
    return value;
  })
  .refine(
    (value) =>
      value === null ||
      value.startsWith("data:image/") || value.startsWith("https://"),
    { message: "A imagem deve ser um arquivo de imagem válido ou uma URL." },
  );

const professionalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  imageUrl: imageUrlSchema,
  serviceIds: z.array(z.uuid()).min(1, "Selecione ao menos um serviço atendido pelo profissional."),
});

const updateProfessionalSchema = professionalSchema.extend({
  professionalId: z.uuid(),
});

function revalidateProfessionalViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/configuracoes");
  revalidatePath("/dashboard/profissionais");
}

export async function createProfessional(input: unknown): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsed = professionalSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do profissional." };
  }

  const clinic = await getClinicForRoles(["ADMIN"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de cadastrar profissionais." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  try {
    const imageUrl = await persistPublicImage({ clinicId: clinic.id, kind: "professionals", value: parsed.data.imageUrl });
    const outcome = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
      const maxProfessionals = getPlanEntitlements(clinic.subscriptionPlan).maxProfessionals;
      if (maxProfessionals !== null) {
        const activeProfessionals = await transaction.professional.count({ where: { clinicId: clinic.id, isActive: true } });
        if (activeProfessionals >= maxProfessionals) return "limit" as const;
      }
      const services = await transaction.service.findMany({ where: { id: { in: parsed.data.serviceIds }, clinicId: clinic.id, isActive: true }, select: { id: true } });
      if (services.length !== parsed.data.serviceIds.length) return "services" as const;
      await transaction.professional.create({ data: { clinicId: clinic.id, name: parsed.data.name, imageUrl, services: { create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })) } } });
      return "created" as const;
    });
    if (outcome === "limit") {
      const max = getPlanEntitlements(clinic.subscriptionPlan).maxProfessionals!;
      return { status: "error", message: `Seu plano permite até ${max} ${max === 1 ? "profissional" : "profissionais"}. Faça upgrade para adicionar mais.` };
    }
    if (outcome === "services") return { status: "error", message: "Um ou mais serviços selecionados são inválidos." };
  } catch {
    return { status: "error", message: "Não foi possível cadastrar o profissional. Tente novamente." };
  }

  revalidateProfessionalViews();
  return { status: "success", message: "Profissional cadastrado." };
}

export async function createProfessionalFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);

  return createProfessional({
    name: formData.get("name"),
    imageUrl: formData.get("imageUrl") || null,
    serviceIds,
  });
}

export async function updateProfessional(input: unknown): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsed = updateProfessionalSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do profissional." };
  }

  const clinic = await getClinicForRoles(["ADMIN"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de atualizar profissionais." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const professional = await prisma.professional.findFirst({
    where: { id: parsed.data.professionalId, clinicId: clinic.id },
    select: { id: true, imageUrl: true },
  });

  if (!professional) {
    return { status: "error", message: "Profissional não encontrado." };
  }

  const services = await prisma.service.findMany({
    where: { id: { in: parsed.data.serviceIds }, clinicId: clinic.id, isActive: true },
    select: { id: true },
  });

  if (services.length !== parsed.data.serviceIds.length) {
    return { status: "error", message: "Um ou mais serviços selecionados são inválidos." };
  }

  try {
    const imageUrl = await persistPublicImage({ clinicId: clinic.id, kind: "professionals", value: parsed.data.imageUrl, currentUrl: professional.imageUrl });
    await prisma.$transaction(async (transaction) => {
      await transaction.professionalService.deleteMany({
        where: { professionalId: professional.id },
      });

      await transaction.professional.update({
        where: { id: professional.id },
        data: {
          name: parsed.data.name,
          imageUrl,
          services: {
            create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })),
          },
        },
      });
    });
    if (professional.imageUrl !== imageUrl) await removePublicImage(professional.imageUrl);
  } catch {
    return { status: "error", message: "Não foi possível atualizar o profissional. Tente novamente." };
  }

  revalidateProfessionalViews();
  return { status: "success", message: "Profissional atualizado." };
}

export async function updateProfessionalFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);

  return updateProfessional({
    professionalId: formData.get("professionalId"),
    name: formData.get("name"),
    imageUrl: formData.get("imageUrl") || null,
    serviceIds,
  });
}

export async function toggleProfessionalActive(professionalId: string): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsedId = z.uuid().safeParse(professionalId);

  if (!parsedId.success) {
    return { status: "error", message: "Não foi possível alterar este profissional." };
  }

  const clinic = await getClinicForRoles(["ADMIN"]);

  if (!clinic) {
    return { status: "error", message: "Selecione uma barbearia antes de alterar profissionais." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  const professional = await prisma.professional.findFirst({
    where: { id: parsedId.data, clinicId: clinic.id },
    select: { id: true, isActive: true },
  });

  if (!professional) {
    return { status: "error", message: "Profissional não encontrado." };
  }

  const nextIsActive = !professional.isActive;

  if (!nextIsActive) {
    const pendingAppointments = await prisma.appointment.count({
      where: {
        professionalId: professional.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        startTime: { gte: new Date() },
      },
    });

    if (pendingAppointments > 0) {
      return {
        status: "error",
        message: "Este profissional possui agendamentos futuros pendentes ou confirmados. Cancele ou reagende-os antes de desativar.",
      };
    }
  }

  const outcome = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    if (nextIsActive) {
      const maxProfessionals = getPlanEntitlements(clinic.subscriptionPlan).maxProfessionals;
      if (maxProfessionals !== null) {
        const activeProfessionals = await transaction.professional.count({ where: { clinicId: clinic.id, isActive: true } });
        if (activeProfessionals >= maxProfessionals) return "limit" as const;
      }
    }
    await transaction.professional.update({ where: { id: professional.id }, data: { isActive: nextIsActive } });
    return "updated" as const;
  });
  if (outcome === "limit") {
    const max = getPlanEntitlements(clinic.subscriptionPlan).maxProfessionals!;
    return { status: "error", message: `Seu plano permite até ${max} ${max === 1 ? "profissional ativo" : "profissionais ativos"}. Faça upgrade para reativar este profissional.` };
  }

  revalidateProfessionalViews();
  return { status: "success", message: nextIsActive ? "Profissional reativado." : "Profissional desativado." };
}
