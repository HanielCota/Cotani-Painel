import type { AgendaAppointment, DashboardMetrics } from "@/types";

function todayAt(hour: number, minute: number, offsetDays = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function getMockMetrics(): DashboardMetrics {
  return {
    totalAppointments: 124,
    confirmedToday: 4,
    noShowsThisMonth: 2,
    totalCustomers: 86,
    totalServices: 5,
    activeCustomersThisMonth: 32,
    confirmationRate: 92,
    noShowRate: 3,
    appointmentsToday: 6,
    estimatedRevenueToday: 450,
    customersServedToday: 5,
  };
}

export function getMockAppointments(): AgendaAppointment[] {
  return [
    {
      id: "mock-apt-1",
      customerName: "João Silva",
      serviceName: "Corte de cabelo",
      professionalName: "Carlos",
      startTime: todayAt(10, 0).toISOString(),
      endTime: todayAt(10, 30).toISOString(),
      status: "CONFIRMED",
    },
    {
      id: "mock-apt-2",
      customerName: "Pedro Oliveira",
      serviceName: "Barba completa",
      professionalName: "Carlos",
      startTime: todayAt(11, 0).toISOString(),
      endTime: todayAt(11, 30).toISOString(),
      status: "PENDING",
    },
    {
      id: "mock-apt-3",
      customerName: "Lucas Mendes",
      serviceName: "Corte + barba",
      professionalName: "André",
      startTime: todayAt(14, 0).toISOString(),
      endTime: todayAt(15, 0).toISOString(),
      status: "CONFIRMED",
    },
    {
      id: "mock-apt-4",
      customerName: "Carlos Souza",
      serviceName: "Sobrancelha",
      professionalName: "André",
      startTime: todayAt(16, 30).toISOString(),
      endTime: todayAt(16, 45).toISOString(),
      status: "CONFIRMED",
    },
    {
      id: "mock-apt-5",
      customerName: "André Lima",
      serviceName: "Corte de cabelo",
      professionalName: "Carlos",
      startTime: todayAt(17, 0, 1).toISOString(),
      endTime: todayAt(17, 30, 1).toISOString(),
      status: "PENDING",
    },
  ];
}

export const mockCustomers = [
  { id: "mock-cus-1", name: "João Silva" },
  { id: "mock-cus-2", name: "Pedro Oliveira" },
  { id: "mock-cus-3", name: "Lucas Mendes" },
  { id: "mock-cus-4", name: "Carlos Souza" },
  { id: "mock-cus-5", name: "André Lima" },
];

export const mockServices = [
  { id: "mock-ser-1", name: "Corte de cabelo", duration: 30 },
  { id: "mock-ser-2", name: "Barba completa", duration: 30 },
  { id: "mock-ser-3", name: "Corte + barba", duration: 60 },
  { id: "mock-ser-4", name: "Sobrancelha", duration: 15 },
];
