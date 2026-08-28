export const MIN_BOOKING_LEAD_MINUTES = 15;
export const MAX_BOOKING_HORIZON_DAYS = 180;

export function isWithinBookingWindow(date: Date, now = new Date()): boolean {
  const earliest = new Date(now.getTime() + MIN_BOOKING_LEAD_MINUTES * 60_000);
  const latest = new Date(now.getTime() + MAX_BOOKING_HORIZON_DAYS * 24 * 60 * 60_000);
  return date >= earliest && date <= latest;
}
