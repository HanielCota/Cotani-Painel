"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { requireClinicAction } from "@/server/clinic-action";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";
import { validateDaySchedule } from "@/server/domain/working-hours";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/);

const businessHourItemSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isOpen: z.boolean(),
  openTime: timeSchema,
  closeTime: timeSchema,
  breakStart: timeSchema.optional().or(z.literal("")),
  breakEnd: timeSchema.optional().or(z.literal("")),
});

const businessHoursSchema = z.array(businessHourItemSchema).length(7).superRefine((items, context) => {
  const days = new Set(items.map((item) => item.dayOfWeek));
  if (days.size !== 7 || [...days].some((day) => day < 0 || day > 6)) {
    context.addIssue({ code: "custom", message: "Informe cada dia da semana exatamente uma vez." });
  }
  items.forEach((item, index) => {
    if (Boolean(item.breakStart) !== Boolean(item.breakEnd)) {
      context.addIssue({ code: "custom", path: [index, "breakStart"], message: "Informe o início e o fim do intervalo." });
    }
  });
});

export async function saveBusinessHours(input: unknown): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsed = businessHoursSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os horários informados." };
  }

  const access = await requireClinicAction(["ADMIN"], "Selecione um negócio antes de salvar o expediente.");
  if (!access.ok) return access.result;
  const { clinic } = access;

  const scheduleError = firstScheduleError(parsed.data);
  if (scheduleError) return { status: "error", message: scheduleError };

  try {
    await prisma.$transaction(
      parsed.data.map((item) =>
        prisma.businessHour.upsert({
          where: { clinicId_dayOfWeek: { clinicId: clinic.id, dayOfWeek: item.dayOfWeek } },
          update: {
            isOpen: item.isOpen,
            openTime: item.openTime,
            closeTime: item.closeTime,
            breakStart: item.breakStart || null,
            breakEnd: item.breakEnd || null,
          },
          create: {
            clinicId: clinic.id,
            dayOfWeek: item.dayOfWeek,
            isOpen: item.isOpen,
            openTime: item.openTime,
            closeTime: item.closeTime,
            breakStart: item.breakStart || null,
            breakEnd: item.breakEnd || null,
          },
        }),
      ),
    );
  } catch {
    return { status: "error", message: "Não foi possível salvar o expediente. Tente novamente." };
  }

  revalidatePath("/dashboard/negocio/horarios");
  return { status: "success", message: "Expediente salvo." };
}

/** Mesma validação para o expediente do negócio e o de cada profissional. */
function firstScheduleError(items: ReadonlyArray<z.infer<typeof businessHourItemSchema>>) {
  for (const item of items) {
    const error = validateDaySchedule(item);
    if (error) return error;
  }
  return null;
}

export async function saveBusinessHoursFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  const items = [];

  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
    items.push({
      dayOfWeek,
      isOpen: formData.get(`isOpen-${dayOfWeek}`) === "on",
      openTime: String(formData.get(`openTime-${dayOfWeek}`) ?? "08:00"),
      closeTime: String(formData.get(`closeTime-${dayOfWeek}`) ?? "18:00"),
      breakStart: String(formData.get(`breakStart-${dayOfWeek}`) ?? ""),
      breakEnd: String(formData.get(`breakEnd-${dayOfWeek}`) ?? ""),
    });
  }

  return saveBusinessHours(items);
}

export async function saveProfessionalAvailabilityFromForm(_previousState: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAuthenticatedUser();
  const professionalId = z.uuid().safeParse(formData.get("professionalId"));
  const items = Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isOpen: formData.get(`isOpen-${dayOfWeek}`) === "on",
    openTime: String(formData.get(`openTime-${dayOfWeek}`) ?? "08:00"),
    closeTime: String(formData.get(`closeTime-${dayOfWeek}`) ?? "18:00"),
    breakStart: String(formData.get(`breakStart-${dayOfWeek}`) ?? ""),
    breakEnd: String(formData.get(`breakEnd-${dayOfWeek}`) ?? ""),
  }));
  const parsed = businessHoursSchema.safeParse(items);
  if (!professionalId.success || !parsed.success) return { status: "error", message: "Revise os horários informados." };
  const access = await requireClinicAction(["ADMIN"]);
  if (!access.ok) return access.result;
  const { clinic } = access;
  const professional = await prisma.professional.findFirst({ where: { id: professionalId.data, clinicId: clinic.id, isActive: true }, select: { id: true } });
  if (!professional) return { status: "error", message: "Profissional não encontrado." };
  const scheduleError = firstScheduleError(parsed.data);
  if (scheduleError) return { status: "error", message: scheduleError };
  await prisma.$transaction(parsed.data.map((item) => prisma.professionalAvailability.upsert({
    where: { professionalId_dayOfWeek: { professionalId: professional.id, dayOfWeek: item.dayOfWeek } },
    update: { clinicId: clinic.id, isOpen: item.isOpen, openTime: item.openTime, closeTime: item.closeTime, breakStart: item.breakStart || null, breakEnd: item.breakEnd || null },
    create: { clinicId: clinic.id, professionalId: professional.id, dayOfWeek: item.dayOfWeek, isOpen: item.isOpen, openTime: item.openTime, closeTime: item.closeTime, breakStart: item.breakStart || null, breakEnd: item.breakEnd || null },
  })));
  revalidatePath("/dashboard/negocio/horarios");
  return { status: "success", message: "Horários do profissional salvos." };
}
