/**
 * Ciclo de vida do atendimento, compartilhado entre servidor e interface para
 * que a agenda só ofereça transições que a Server Action aceita.
 */
export const APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"] as const;
export type AppointmentStatusValue = (typeof APPOINTMENT_STATUSES)[number];

/** Atendimentos que ainda ocupam horário na agenda. */
export const ACTIVE_APPOINTMENT_STATUSES = ["PENDING", "CONFIRMED"] as const satisfies readonly AppointmentStatusValue[];
export const TERMINAL_APPOINTMENT_STATUSES = ["COMPLETED", "CANCELED", "NO_SHOW"] as const satisfies readonly AppointmentStatusValue[];

export type ActiveAppointmentStatus = (typeof ACTIVE_APPOINTMENT_STATUSES)[number];
export type NextAppointmentStatus = Exclude<AppointmentStatusValue, "PENDING">;

const TRANSITIONS: Record<ActiveAppointmentStatus, readonly NextAppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELED", "NO_SHOW"],
  CONFIRMED: ["COMPLETED", "CANCELED", "NO_SHOW"],
};

/** Concluir ou registrar falta só faz sentido depois que o horário começou. */
const REQUIRES_STARTED: readonly NextAppointmentStatus[] = ["COMPLETED", "NO_SHOW"];

export function isActiveAppointmentStatus(status: string): status is ActiveAppointmentStatus {
  return (ACTIVE_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

export function isTerminalAppointmentStatus(status: string) {
  return (TERMINAL_APPOINTMENT_STATUSES as readonly string[]).includes(status);
}

export function getAllowedAppointmentTransitions(status: string, startTime: Date | string, now = new Date()): NextAppointmentStatus[] {
  if (!isActiveAppointmentStatus(status)) return [];
  const started = new Date(startTime).getTime() <= now.getTime();
  return TRANSITIONS[status].filter((next) => started || !REQUIRES_STARTED.includes(next));
}

export type AppointmentTransitionCheck =
  | { ok: true }
  | { ok: false; reason: "invalid" | "not-started" };

export function checkAppointmentTransition(status: string, next: string, startTime: Date | string, now = new Date()): AppointmentTransitionCheck {
  if (!isActiveAppointmentStatus(status) || !(TRANSITIONS[status] as readonly string[]).includes(next)) return { ok: false, reason: "invalid" };
  if (!getAllowedAppointmentTransitions(status, startTime, now).includes(next as NextAppointmentStatus)) return { ok: false, reason: "not-started" };
  return { ok: true };
}

export const PAYMENT_METHODS = ["PIX", "CREDIT_CARD", "DEBIT_CARD", "CASH", "OTHER"] as const;
export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number];

export const paymentMethodLabels: Record<PaymentMethodValue, string> = {
  PIX: "Pix",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CASH: "Dinheiro",
  OTHER: "Outro",
};
