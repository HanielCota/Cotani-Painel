/** Reserva pública (cliente final): antecedência mínima e horizonte máximo. */
export const MIN_BOOKING_LEAD_MINUTES = 15;
export const MAX_BOOKING_HORIZON_DAYS = 180;

/**
 * Agendamento pela equipe no painel: pode encaixar em cima da hora (cliente no
 * balcão), mas com horizonte de 1 ano para barrar datas digitadas errado
 * (ex.: ano trocado).
 */
export const STAFF_MAX_BOOKING_HORIZON_DAYS = 365;

const DAY_MS = 24 * 60 * 60_000;

export function isWithinBookingWindow(date: Date, now = new Date()): boolean {
  const earliest = new Date(now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60_000);
  const latest = new Date(now.getTime() + MAX_BOOKING_HORIZON_DAYS * DAY_MS);
  return date >= earliest && date <= latest;
}

export function isWithinStaffBookingHorizon(date: Date, now = new Date()): boolean {
  return date.getTime() <= now.getTime() + STAFF_MAX_BOOKING_HORIZON_DAYS * DAY_MS;
}
