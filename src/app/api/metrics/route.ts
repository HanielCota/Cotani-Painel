import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { getClinicDateBounds } from "@/lib/timezone";
import type { DashboardMetrics } from "@/types";

export async function GET() {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return NextResponse.json({ message: "Nenhuma clínica selecionada." }, { status: 400 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { clerkOrgId: orgId },
  });

  if (!clinic) {
    return NextResponse.json({ message: "A clínica ativa ainda não foi sincronizada." }, { status: 404 });
  }

  const { startOfToday, startOfTomorrow, startOfMonth, startOfNextMonth } = getClinicDateBounds(clinic.timeZone);

  // Denominador das taxas: atendimentos do mês (calendário, no fuso da clínica), exceto cancelados.
  const monthAppointments: Prisma.AppointmentWhereInput = {
    clinicId: clinic.id,
    startTime: { gte: startOfMonth, lt: startOfNextMonth },
    status: { not: "CANCELED" },
  };

  const [
    totalAppointments,
    confirmedToday,
    noShowsThisMonth,
    totalCustomers,
    totalServices,
    monthAppointmentsTotal,
    confirmedOrCompletedThisMonth,
    activeCustomers,
  ] = await Promise.all([
    prisma.appointment.count({ where: { clinicId: clinic.id } }),
    prisma.appointment.count({
      where: { clinicId: clinic.id, startTime: { gte: startOfToday, lt: startOfTomorrow }, status: "CONFIRMED" },
    }),
    prisma.appointment.count({ where: { ...monthAppointments, status: "NO_SHOW" } }),
    prisma.customer.count({ where: { clinicId: clinic.id } }),
    prisma.service.count({ where: { clinicId: clinic.id, isActive: true } }),
    prisma.appointment.count({ where: monthAppointments }),
    prisma.appointment.count({ where: { ...monthAppointments, status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    prisma.appointment.findMany({ where: monthAppointments, distinct: ["customerId"], select: { customerId: true } }),
  ]);

  const metrics: DashboardMetrics = {
    totalAppointments,
    confirmedToday,
    noShowsThisMonth,
    totalCustomers,
    totalServices,
    activeCustomersThisMonth: activeCustomers.length,
    // Taxa de confirmação: confirmados + concluídos sobre os atendimentos do mês (exceto cancelados).
    confirmationRate: monthAppointmentsTotal > 0 ? Math.round((confirmedOrCompletedThisMonth / monthAppointmentsTotal) * 100) : 0,
    // Taxa de falta: não comparecimentos do mês sobre o mesmo denominador.
    noShowRate: monthAppointmentsTotal > 0 ? Math.round((noShowsThisMonth / monthAppointmentsTotal) * 100) : 0,
  };

  return NextResponse.json(metrics);
}
