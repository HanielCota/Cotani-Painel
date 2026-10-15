"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { getErrorMetadata } from "@/lib/error-metadata";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/appointment-status";
import { findProfessionalLimitReached, professionalLimitMessage } from "@/server/services/billing-access";
import { requireClinicAction } from "@/server/clinic-action";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";
import { persistPublicImage, removePublicImage } from "@/server/services/media-storage";
import { allowMediaUpload } from "@/server/services/action-rate-limit";
import { ignoreFailure } from "@/lib/ignore-failure";

const MAX_IMAGE_SIZE_CHARS = 2_000_000;

const imageValueSchema = z
  .union([z.string().trim().max(MAX_IMAGE_SIZE_CHARS), z.instanceof(File), z.null()])
  .optional()
  .transform((value) => {
    if (!value || value === "") return null;
    return value;
  })
  .refine(
    (value) =>
      value === null || value instanceof File || value.startsWith("data:image/") || value.startsWith("https://"),
    { message: "A imagem deve ser um arquivo de imagem válido ou uma URL." },
  );

const professionalSchema = z.object({
  name: z.string().trim().min(2).max(120),
  imageUrl: imageValueSchema,
  serviceIds: z
    .array(z.uuid())
    .min(1, "Selecione ao menos um serviço atendido pelo profissional.")
    .transform((serviceIds) => [...new Set(serviceIds)]),
});

const updateProfessionalSchema = professionalSchema.extend({
  professionalId: z.uuid(),
});

function revalidateProfessionalViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/negocio/profissionais");
  revalidatePath("/dashboard/profissionais");
}

function isNewImageUpload(value: string | File | null): boolean {
  return value instanceof File ? value.size > 0 : Boolean(value?.startsWith("data:"));
}

function getImageValue(formData: FormData): string | File | null {
  const file = formData.get("imageFile");
  if (file instanceof File && file.size > 0) return file;
  const currentValue = formData.get("imageUrl");
  return typeof currentValue === "string" && currentValue ? currentValue : null;
}

export async function createProfessional(input: unknown): Promise<ActionResult> {
  const authUser = await requireAuthenticatedUser();

  const parsed = professionalSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do profissional." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de cadastrar profissionais.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  if (isNewImageUpload(parsed.data.imageUrl) && !(await allowMediaUpload(authUser.id))) {
    return { status: "error", message: "Muitos envios de imagem. Aguarde antes de tentar novamente." };
  }

  let uploadedImageUrl: string | null = null;

  try {
    const imageUrl = await persistPublicImage({
      clinicId: clinic.id,
      kind: "professionals",
      value: parsed.data.imageUrl,
    });
    if (isNewImageUpload(parsed.data.imageUrl)) uploadedImageUrl = imageUrl;
    const outcome = await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
      const current = await transaction.clinic.findUniqueOrThrow({ where: { id: clinic.id } });
      if (!isSubscriptionActive(current)) throw new Error(SUBSCRIPTION_INACTIVE_MESSAGE);
      const limit = await findProfessionalLimitReached(transaction, current);
      if (limit !== null) return { kind: "limit", limit } as const;
      const services = await transaction.service.findMany({
        where: { id: { in: parsed.data.serviceIds }, clinicId: clinic.id, isActive: true },
        select: { id: true },
      });
      if (services.length !== parsed.data.serviceIds.length) return { kind: "services" } as const;
      await transaction.professional.create({
        data: {
          clinicId: clinic.id,
          name: parsed.data.name,
          imageUrl,
          services: { create: parsed.data.serviceIds.map((serviceId) => ({ serviceId })) },
        },
      });
      return { kind: "created" } as const;
    });
    if (outcome.kind === "limit") {
      await removePublicImage({ url: uploadedImageUrl, clinicId: clinic.id, kind: "professionals" });
      return { status: "error", message: professionalLimitMessage(outcome.limit, "add") };
    }
    if (outcome.kind === "services") {
      await removePublicImage({ url: uploadedImageUrl, clinicId: clinic.id, kind: "professionals" });
      return { status: "error", message: "Um ou mais serviços selecionados são inválidos." };
    }
  } catch (error) {
    logger.error("Falha ao cadastrar profissional", { clinicId: clinic.id, ...getErrorMetadata(error) });
    await ignoreFailure(removePublicImage({ url: uploadedImageUrl, clinicId: clinic.id, kind: "professionals" }), "Falha ao remover imagem do storage");
    return { status: "error", message: "Não foi possível cadastrar o profissional. Tente novamente." };
  }

  revalidateProfessionalViews();
  return { status: "success", message: "Profissional cadastrado." };
}

export async function createProfessionalFromForm(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);

  return createProfessional({
    name: formData.get("name"),
    imageUrl: getImageValue(formData),
    serviceIds,
  });
}

export async function updateProfessional(input: unknown): Promise<ActionResult> {
  const authUser = await requireAuthenticatedUser();

  const parsed = updateProfessionalSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do profissional." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de atualizar profissionais.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  if (isNewImageUpload(parsed.data.imageUrl) && !(await allowMediaUpload(authUser.id))) {
    return { status: "error", message: "Muitos envios de imagem. Aguarde antes de tentar novamente." };
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

  let imageUrl: string | null = professional.imageUrl;
  let uploadedImageUrl: string | null = null;

  try {
    imageUrl = await persistPublicImage({
      clinicId: clinic.id,
      kind: "professionals",
      value: parsed.data.imageUrl,
      currentUrl: professional.imageUrl,
    });
    if (isNewImageUpload(parsed.data.imageUrl)) uploadedImageUrl = imageUrl;
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
  } catch (error) {
    logger.error("Falha ao atualizar profissional", { clinicId: clinic.id, ...getErrorMetadata(error) });
    await ignoreFailure(removePublicImage({ url: uploadedImageUrl, clinicId: clinic.id, kind: "professionals" }), "Falha ao remover imagem do storage");
    return { status: "error", message: "Não foi possível atualizar o profissional. Tente novamente." };
  }

  if (professional.imageUrl !== imageUrl) {
    await ignoreFailure(removePublicImage({ url: professional.imageUrl, clinicId: clinic.id, kind: "professionals" }), "Falha ao remover imagem do storage");
  }

  revalidateProfessionalViews();
  return { status: "success", message: "Profissional atualizado." };
}

export async function updateProfessionalFromForm(
  _previousState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const serviceIds = formData.getAll("serviceIds").map(String).filter(Boolean);

  return updateProfessional({
    professionalId: formData.get("professionalId"),
    name: formData.get("name"),
    imageUrl: getImageValue(formData),
    serviceIds,
  });
}

/** Reativar exige assinatura ativa e vaga no limite de profissionais do plano. */
async function findActivationBlocker(transaction: Prisma.TransactionClient, clinicId: string) {
  const current = await transaction.clinic.findUniqueOrThrow({ where: { id: clinicId } });
  if (!isSubscriptionActive(current)) throw new Error(SUBSCRIPTION_INACTIVE_MESSAGE);

  const limit = await findProfessionalLimitReached(transaction, current);
  if (limit === null) return null;

  return { kind: "limit", limit } as const;
}

/** Desativar é bloqueado enquanto houver atendimentos futuros pendentes ou confirmados. */
async function findDeactivationBlocker(transaction: Prisma.TransactionClient, professionalId: string) {
  // FOR UPDATE espera agendamentos em andamento (que seguram a linha com
  // FOR SHARE) terminarem, então a contagem abaixo já os enxerga.
  await transaction.$queryRaw`SELECT id FROM "Professional" WHERE id = ${professionalId} FOR UPDATE`;
  const pendingAppointments = await transaction.appointment.count({
    where: { professionalId, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, startTime: { gte: new Date() } },
  });
  if (pendingAppointments === 0) return null;

  return { kind: "has-appointments" } as const;
}

export async function toggleProfessionalActive(professionalId: string): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsedId = z.uuid().safeParse(professionalId);

  if (!parsedId.success) {
    return { status: "error", message: "Não foi possível alterar este profissional." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de alterar profissionais.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  const professional = await prisma.professional.findFirst({
    where: { id: parsedId.data, clinicId: clinic.id },
    select: { id: true, isActive: true },
  });

  if (!professional) {
    return { status: "error", message: "Profissional não encontrado." };
  }

  const nextIsActive = !professional.isActive;

  const outcome = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
    const blocker = nextIsActive
      ? await findActivationBlocker(transaction, clinic.id)
      : await findDeactivationBlocker(transaction, professional.id);
    if (blocker) return blocker;

    await transaction.professional.update({ where: { id: professional.id }, data: { isActive: nextIsActive } });
    return { kind: "updated" } as const;
  });
  if (outcome.kind === "limit") {
    return { status: "error", message: professionalLimitMessage(outcome.limit, "reactivate") };
  }
  if (outcome.kind === "has-appointments") {
    return {
      status: "error",
      message:
        "Este profissional possui agendamentos futuros pendentes ou confirmados. Cancele ou reagende-os antes de desativar.",
    };
  }

  revalidateProfessionalViews();
  return { status: "success", message: nextIsActive ? "Profissional reativado." : "Profissional desativado." };
}
