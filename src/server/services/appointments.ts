import type { ClinicModel } from "@/generated/prisma/models/Clinic";
import prisma from "@/lib/prisma";
import { getClinicDateBounds } from "@/lib/timezone";

export interface AppointmentListItem {
  id: string;
  customerName: string;
  serviceName: string;
  startTime: Date;
  status: string;
}

function mapAppointmentListItem(appointment: {
  id: string;
  startTime: Date;
  status: string;
  customer: { name: string };
  service: { name: string };
}): AppointmentListItem {
  return {
    id: appointment.id,
    customerName: appointment.customer.name,
    serviceName: appointment.service.name,
    startTime: appointment.startTime,
    status: appointment.status,
  };
}

export async function getUpcomingAppointments(clinic: ClinicModel, limit = 10): Promise<AppointmentListItem[]> {
  const now = new Date();
  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      startTime: { gte: now },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    include: { customer: true, service: true },
    orderBy: { startTime: "asc" },
    take: limit,
  });

  return appointments.map(mapAppointmentListItem);
}

export async function getTodayAppointments(clinic: ClinicModel): Promise<AppointmentListItem[]> {
  const { startOfToday, startOfTomorrow } = getClinicDateBounds(clinic.timeZone);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicId: clinic.id,
      startTime: { gte: startOfToday, lt: startOfTomorrow },
    },
    include: { customer: true, service: true },
    orderBy: { startTime: "asc" },
  });

  return appointments.map(mapAppointmentListItem);
}
