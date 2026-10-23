"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getErrorMetadata } from "@/lib/error-metadata";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { requireClinicAction } from "@/server/clinic-action";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";
import { allowMediaUpload } from "@/server/services/action-rate-limit";
import { persistPublicImage, removePublicImage } from "@/server/services/media-storage";
import { slugify } from "@/server/services/clinic-provisioning";
import { isSlugTakenByAnotherClinic, moveClinicSlug, SlugInUseError } from "@/server/services/clinic-slug";
import { ignoreFailure } from "@/lib/ignore-failure";

const settingsSchema = z.object({
  maxAppointmentsPerDay: z.coerce.number().int().min(1).optional().or(z.literal("")),
});

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(120).transform(slugify),
  timeZone: z.enum([
    "America/Sao_Paulo",
    "America/Manaus",
    "America/Cuiaba",
    "America/Rio_Branco",
    "America/Fortaleza",
    "America/Recife",
    "America/Bahia",
    "America/Belem",
  ]),
  contactEmail: z.union([z.literal(""), z.email()]),
  phone: z.string().trim().max(30),
  address: z.string().trim().max(300),
  publicDescription: z.string().trim().max(500),
  imageUrl: z.string().trim().max(2_000_000).nullable(),
});

export async function saveBusinessProfile(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const authUser = await requireAuthenticatedUser();
  const imageFile = formData.get("image");
  let imageValue = String(formData.get("currentImageUrl") ?? "").trim() || null;
  if (formData.get("removeImage") === "on") imageValue = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
      return { status: "error", message: "Envie uma imagem JPG, PNG ou WebP de até 2 MB." };
    }
    imageValue = `data:${imageFile.type};base64,${Buffer.from(await imageFile.arrayBuffer()).toString("base64")}`;
  }
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    timeZone: formData.get("timeZone"),
    contactEmail: formData.get("contactEmail") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    publicDescription: formData.get("publicDescription") ?? "",
    imageUrl: imageValue,
  });
  if (!parsed.success || !parsed.data.slug)
    return { status: "error", message: "Revise os dados e o endereço público informados." };
  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de salvar.");
  if (!access.ok) return access.result;
  const { clinic } = access;
  if (parsed.data.imageUrl?.startsWith("data:") && !(await allowMediaUpload(authUser.id))) {
    return { status: "error", message: "Muitos envios de imagem. Aguarde antes de tentar novamente." };
  }
  // Checagem antecipada para não enviar a imagem à toa; a definitiva roda na transação.
  if (await isSlugTakenByAnotherClinic(prisma, clinic.id, parsed.data.slug))
    return { status: "error", message: "Esse endereço público já está em uso." };

  let uploadedImageUrl: string | null = null;
  try {
    const imageUrl = await persistPublicImage({
      clinicId: clinic.id,
      kind: "clinics",
      value: parsed.data.imageUrl,
      currentUrl: clinic.imageUrl,
    });
    if (parsed.data.imageUrl?.startsWith("data:")) uploadedImageUrl = imageUrl;
    await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${clinic.id}, 0))`;
      await moveClinicSlug(transaction, clinic, parsed.data.slug);
      await transaction.clinic.update({
        where: { id: clinic.id },
        data: {
          name: parsed.data.name,
          slug: parsed.data.slug,
          timeZone: parsed.data.timeZone,
          contactEmail: parsed.data.contactEmail || null,
          phone: parsed.data.phone || null,
          address: parsed.data.address || null,
          publicDescription: parsed.data.publicDescription || null,
          imageUrl,
        },
      });
    });
    if (clinic.imageUrl !== imageUrl)
      await ignoreFailure(removePublicImage({ url: clinic.imageUrl, clinicId: clinic.id, kind: "clinics" }), "Falha ao remover imagem do storage");
  } catch (error) {
    if (!(error instanceof SlugInUseError)) {
      logger.error("Falha ao salvar os dados do negócio", { clinicId: clinic.id, ...getErrorMetadata(error) });
    }
    await ignoreFailure(removePublicImage({ url: uploadedImageUrl, clinicId: clinic.id, kind: "clinics" }), "Falha ao remover imagem do storage");
    return {
      status: "error",
      message: error instanceof SlugInUseError ? error.message : "Não foi possível salvar os dados do negócio.",
    };
  }
  revalidatePath("/dashboard", "layout");
  revalidatePath(`/${parsed.data.slug}`);
  return { status: "success", message: "Dados do negócio atualizados." };
}

export async function saveClinicSettings(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const rawValue = formData.get("maxAppointmentsPerDay");
  const parsed = settingsSchema.safeParse({
    maxAppointmentsPerDay: rawValue === "" || rawValue === null ? "" : rawValue,
  });

  if (!parsed.success) {
    return { status: "error", message: "Revise o limite diário informado." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de salvar.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  const maxAppointmentsPerDay =
    parsed.data.maxAppointmentsPerDay === "" || parsed.data.maxAppointmentsPerDay === undefined
      ? null
      : parsed.data.maxAppointmentsPerDay;

  try {
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { maxAppointmentsPerDay },
    });
  } catch (error) {
    logger.error("Falha ao salvar as configurações do negócio", { clinicId: clinic.id, ...getErrorMetadata(error) });
    return { status: "error", message: "Não foi possível salvar as configurações. Tente novamente." };
  }

  revalidatePath("/dashboard/negocio/horarios");
  return { status: "success", message: "Configurações salvas." };
}
