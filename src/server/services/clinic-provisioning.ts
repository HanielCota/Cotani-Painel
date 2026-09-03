import "server-only";

import { SubscriptionStatus } from "@/generated/prisma/enums";

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateClinicSlug(name: string, uniqueSuffix: string) {
  return `${slugify(name) || "loja"}-${uniqueSuffix.replaceAll("-", "").slice(-6).toLowerCase()}`;
}

export function mapSubscriptionStatus(value: unknown): SubscriptionStatus {
  if (typeof value !== "string") return SubscriptionStatus.INACTIVE;
  const normalized = value.toUpperCase();
  return Object.values(SubscriptionStatus).includes(normalized as SubscriptionStatus)
    ? normalized as SubscriptionStatus
    : SubscriptionStatus.INACTIVE;
}
