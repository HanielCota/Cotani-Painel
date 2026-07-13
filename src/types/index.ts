export type ActionResult =
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export interface AgendaAppointment {
  id: string;
  customerName: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
}
