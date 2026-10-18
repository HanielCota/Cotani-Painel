export type ActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

/** Estado inicial neutro para `useActionState` (mensagem vazia não gera toast). */
export const INITIAL_ACTION_RESULT: ActionResult = { status: "success", message: "" };

export interface AgendaAppointment {
  id: string;
  customerId?: string;
  serviceId?: string;
  professionalId?: string | null;
  customerName: string;
  serviceName: string;
  professionalName: string | null;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
  notes?: string | null;
  totalPrice?: number;
}

/** Agenda em grade (dia/semana): atendimentos do intervalo + dados da grade. */
export interface AgendaRange {
  /** Primeiro dia (YYYY-MM-DD, fuso do negócio). */
  from: string;
  days: number;
  timeZone: string;
  items: AgendaAppointment[];
  professionals: Array<{ id: string; name: string }>;
  hours: Array<{ dayOfWeek: number; isOpen: boolean; openTime: string; closeTime: string }>;
}

export interface AppointmentsPage {
  items: AgendaAppointment[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CustomerListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  createdAt: string;
  appointmentCount: number;
  lastAppointmentAt: string | null;
  lastServiceName: string | null;
  relationship: "NEW" | "ACTIVE" | "RECURRING" | "INACTIVE";
  notes: string | null;
  tags: string[];
  nextReturnAt: string | null;
}

export interface CustomersPage {
  items: CustomerListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DashboardMetrics {
  totalAppointments: number;
  confirmedToday: number;
  noShowsThisMonth: number;
  totalCustomers: number;
  totalServices: number;
  activeCustomersThisMonth: number;
  confirmationRate: number;
  noShowRate: number;
  appointmentsToday: number;
  estimatedRevenueToday: number;
  customersServedToday: number;
  appointmentsThisMonth: number;
  appointmentsPreviousMonth: number;
  completedRevenueThisMonth: number;
  completedRevenuePreviousMonth: number;
  cancellationsThisMonth: number;
  newCustomersThisMonth: number;
}

export interface ServiceListItem {
  id: string;
  name: string;
  duration: number;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ProfessionalListItem {
  id: string;
  name: string;
  imageUrl: string | null;
  isActive: boolean;
  serviceIds: string[];
}

export interface BusinessHourItem {
  id: string;
  dayOfWeek: number;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  breakStart: string | null;
  breakEnd: string | null;
}
