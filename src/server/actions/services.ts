"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { ACTIVE_APPOINTMENT_STATUSES } from "@/lib/appointment-status";
import { requireClinicAction } from "@/server/clinic-action";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";
import { persistPublicImage, removePublicImage } from "@/server/services/media-storage";
import { allowMediaUpload } from "@/server/services/action-rate-limit";

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
      value === null ||
      value instanceof File || value.startsWith("data:image/") || value.startsWith("https://"),
    { message: "A imagem deve ser um arquivo de imagem válido ou uma URL." },
  );

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(120),
  duration: z.coerce.number().int().min(5).max(480),
  price: z.coerce.number().min(0).max(100_000),
  imageUrl: imageValueSchema,
});

const updateServiceSchema = serviceSchema.extend({
  serviceId: z.uuid(),
});

function revalidateServiceViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/negocio/servicos");
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

export async function createService(input: unknown): Promise<ActionResult> {
  const authUser = await requireAuthenticatedUser();

  const parsed = serviceSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do serviço." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de cadastrar serviços.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  if (isNewImageUpload(parsed.data.imageUrl) && !(await allowMediaUpload(authUser.id))) {
    return { status: "error", message: "Muitos envios de imagem. Aguarde antes de tentar novamente." };
  }

  let uploadedImageUrl: string | null = null;

  try {
    const imageUrl = await persistPublicImage({ clinicId: clinic.id, kind: "services", value: parsed.data.imageUrl });
    if (isNewImageUpload(parsed.data.imageUrl)) uploadedImageUrl = imageUrl;
    await prisma.service.create({
      data: {
        clinicId: clinic.id,
        name: parsed.data.name,
        duration: parsed.data.duration,
        price: parsed.data.price,
        imageUrl,
      },
    });
  } catch {
    await removePublicImage({ url: uploadedImageUrl, clinicId: clinic.id, kind: "services" }).catch(() => undefined);
    return { status: "error", message: "Não foi possível cadastrar este serviço. Tente novamente." };
  }

  revalidateServiceViews();
  return { status: "success", message: "Serviço cadastrado." };
}

export async function createServiceFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  return createService({
    name: formData.get("name"),
    duration: formData.get("duration"),
    price: formData.get("price"),
    imageUrl: getImageValue(formData),
  });
}

export async function updateService(input: unknown): Promise<ActionResult> {
  const authUser = await requireAuthenticatedUser();

  const parsed = updateServiceSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do serviço." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de atualizar serviços.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  if (isNewImageUpload(parsed.data.imageUrl) && !(await allowMediaUpload(authUser.id))) {
    return { status: "error", message: "Muitos envios de imagem. Aguarde antes de tentar novamente." };
  }

  const service = await prisma.service.findFirst({
    where: { id: parsed.data.serviceId, clinicId: clinic.id },
    select: { id: true, imageUrl: true },
  });

  if (!service) {
    return { status: "error", message: "Serviço não encontrado." };
  }

  let imageUrl: string | null = service.imageUrl;
  let uploadedImageUrl: string | null = null;

  try {
    imageUrl = await persistPublicImage({ clinicId: clinic.id, kind: "services", value: parsed.data.imageUrl, currentUrl: service.imageUrl });
    if (isNewImageUpload(parsed.data.imageUrl)) uploadedImageUrl = imageUrl;
    await prisma.service.update({
      where: { id: service.id },
      data: {
        name: parsed.data.name,
        duration: parsed.data.duration,
        price: parsed.data.price,
        imageUrl,
      },
    });
  } catch {
    await removePublicImage({ url: uploadedImageUrl, clinicId: clinic.id, kind: "services" }).catch(() => undefined);
    return { status: "error", message: "Não foi possível atualizar este serviço. Tente novamente." };
  }

  if (service.imageUrl !== imageUrl) {
    await removePublicImage({ url: service.imageUrl, clinicId: clinic.id, kind: "services" }).catch(() => undefined);
  }

  revalidateServiceViews();
  return { status: "success", message: "Serviço atualizado." };
}

export async function updateServiceFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  return updateService({
    serviceId: formData.get("serviceId"),
    name: formData.get("name"),
    duration: formData.get("duration"),
    price: formData.get("price"),
    imageUrl: getImageValue(formData),
  });
}

export async function toggleServiceActive(serviceId: string): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsedId = z.uuid().safeParse(serviceId);

  if (!parsedId.success) {
    return { status: "error", message: "Não foi possível alterar este serviço." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de alterar serviços.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  const service = await prisma.service.findFirst({
    where: { id: parsedId.data, clinicId: clinic.id },
    select: { id: true, isActive: true },
  });

  if (!service) {
    return { status: "error", message: "Serviço não encontrado." };
  }

  const nextIsActive = !service.isActive;

  const outcome = await prisma.$transaction(async (transaction) => {
    if (!nextIsActive) {
      // FOR UPDATE espera agendamentos em andamento (que seguram a linha com
      // FOR SHARE) terminarem, então a contagem abaixo já os enxerga.
      await transaction.$queryRaw`SELECT id FROM "Service" WHERE id = ${service.id} FOR UPDATE`;
      const pendingAppointments = await transaction.appointment.count({
        where: {
          serviceId: service.id,
          status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
          startTime: { gte: new Date() },
        },
      });
      if (pendingAppointments > 0) return "has-appointments" as const;
    }
    await transaction.service.update({ where: { id: service.id }, data: { isActive: nextIsActive } });
    return "updated" as const;
  });

  if (outcome === "has-appointments") {
    return {
      status: "error",
      message: "Este serviço possui agendamentos futuros pendentes ou confirmados. Cancele ou reagende-os antes de desativar.",
    };
  }

  revalidateServiceViews();
  return { status: "success", message: nextIsActive ? "Serviço reativado." : "Serviço desativado." };
}
