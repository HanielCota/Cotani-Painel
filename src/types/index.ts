export type ActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export interface AgendaAppointment {
  id: string;
  customerName: string;
  serviceName: string;
  professionalName: string | null;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
}

export interface CustomerListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  createdAt: string;
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
