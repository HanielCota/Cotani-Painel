"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getClinicForRoles } from "@/server/tenant";
import { isSubscriptionActive, SUBSCRIPTION_INACTIVE_MESSAGE } from "@/server/subscription";
import type { ActionResult } from "@/types";
import { requireAuthenticatedUser } from "@/server/auth";

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

function minutesFromTime(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function saveBusinessHours(input: unknown): Promise<ActionResult> {
  await requireAuthenticatedUser();

  const parsed = businessHoursSchema.safeParse(input);

  if (!parsed.success) {
    return { status: "error", message: "Revise os horários informados." };
  }

  const clinic = await getClinicForRoles(["ADMIN"]);

  if (!clinic) {
    return { status: "error", message: "Selecione um negócio antes de salvar o expediente." };
  }

  if (!isSubscriptionActive(clinic)) {
    return { status: "error", message: SUBSCRIPTION_INACTIVE_MESSAGE };
  }

  for (const item of parsed.data) {
    if (!item.isOpen) {
      continue;
    }

    const openMinutes = minutesFromTime(item.openTime);
    const closeMinutes = minutesFromTime(item.closeTime);

    if (openMinutes >= closeMinutes) {
      return { status: "error", message: `O horário de abertura deve ser anterior ao de fechamento (${weekdayLabel(item.dayOfWeek)}).` };
    }

    if (item.breakStart && item.breakEnd) {
      const breakStartMinutes = minutesFromTime(item.breakStart);
      const breakEndMinutes = minutesFromTime(item.breakEnd);

      if (breakStartMinutes >= breakEndMinutes) {
        return { status: "error", message: `O início do intervalo deve ser anterior ao fim (${weekdayLabel(item.dayOfWeek)}).` };
      }

      if (breakStartMinutes < openMinutes || breakEndMinutes > closeMinutes) {
        return { status: "error", message: `O intervalo deve estar dentro do expediente (${weekdayLabel(item.dayOfWeek)}).` };
      }
    }
  }

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

function weekdayLabel(dayOfWeek: number): string {
  const labels = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return labels[dayOfWeek] ?? "Dia inválido";
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
  const clinic = await getClinicForRoles(["ADMIN"]);
  if (!clinic || !isSubscriptionActive(clinic)) return { status: "error", message: clinic ? SUBSCRIPTION_INACTIVE_MESSAGE : "Selecione um negócio." };
  const professional = await prisma.professional.findFirst({ where: { id: professionalId.data, clinicId: clinic.id, isActive: true }, select: { id: true } });
  if (!professional) return { status: "error", message: "Profissional não encontrado." };
  for (const item of parsed.data) {
    if (!item.isOpen) continue;
    const open = minutesFromTime(item.openTime); const close = minutesFromTime(item.closeTime);
    if (open >= close) return { status: "error", message: `Revise abertura e fechamento de ${weekdayLabel(item.dayOfWeek)}.` };
    if (item.breakStart && item.breakEnd) {
      const start = minutesFromTime(item.breakStart); const end = minutesFromTime(item.breakEnd);
      if (start >= end || start < open || end > close) return { status: "error", message: `Revise o intervalo de ${weekdayLabel(item.dayOfWeek)}.` };
    }
  }
  await prisma.$transaction(parsed.data.map((item) => prisma.professionalAvailability.upsert({
    where: { professionalId_dayOfWeek: { professionalId: professional.id, dayOfWeek: item.dayOfWeek } },
    update: { clinicId: clinic.id, isOpen: item.isOpen, openTime: item.openTime, closeTime: item.closeTime, breakStart: item.breakStart || null, breakEnd: item.breakEnd || null },
    create: { clinicId: clinic.id, professionalId: professional.id, dayOfWeek: item.dayOfWeek, isOpen: item.isOpen, openTime: item.openTime, closeTime: item.closeTime, breakStart: item.breakStart || null, breakEnd: item.breakEnd || null },
  })));
  revalidatePath("/dashboard/negocio/horarios");
  return { status: "success", message: "Horários do profissional salvos." };
}
