import "server-only";

import { randomUUID } from "node:crypto";

import { SubscriptionStatus } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";

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

/** Slug livre para uma loja nova: nome + sufixo aleatório (até 5 tentativas). */
export async function findAvailableClinicSlug(name: string) {
  const base = slugify(name) || "loja";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = randomUUID().replaceAll("-", "").slice(0, 6);
    const slug = `${base}-${suffix}`.slice(0, 120);
    if (!await prisma.clinic.findUnique({ where: { slug }, select: { id: true } })) return slug;
  }
  throw new Error("Não foi possível gerar um endereço único para o negócio.");
}

export function mapSubscriptionStatus(value: unknown): SubscriptionStatus {
  if (typeof value !== "string") return SubscriptionStatus.INACTIVE;
  const normalized = value.toUpperCase();
  return Object.values(SubscriptionStatus).includes(normalized as SubscriptionStatus)
    ? normalized as SubscriptionStatus
    : SubscriptionStatus.INACTIVE;
}
