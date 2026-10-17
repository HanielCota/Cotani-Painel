import "server-only";

import type { Prisma } from "@/generated/prisma/client";

export class SlugInUseError extends Error {
  constructor() {
    super("Esse endereço público já está em uso.");
    this.name = "SlugInUseError";
  }
}

type SlugReader = Pick<Prisma.TransactionClient, "clinic" | "clinicSlugAlias">;

/** O slug pertence a outra loja, como endereço atual ou antigo (alias)? */
export async function isSlugTakenByAnotherClinic(client: SlugReader, clinicId: string, slug: string) {
  const [clinic, alias] = await Promise.all([
    client.clinic.findFirst({ where: { id: { not: clinicId }, slug }, select: { id: true } }),
    client.clinicSlugAlias.findFirst({ where: { slug, clinicId: { not: clinicId } }, select: { id: true } }),
  ]);
  return Boolean(clinic || alias);
}

/**
 * Regra única de troca de endereço público (usada pela loja e pela
 * administração da plataforma). Deve rodar na mesma transação que grava o novo
 * `slug`:
 * - recusa slug em uso por outra loja, inclusive como alias;
 * - guarda o slug antigo como alias para links já compartilhados continuarem
 *   funcionando;
 * - remove o alias que coincidir com o novo slug desta loja.
 */
export async function moveClinicSlug(transaction: Prisma.TransactionClient, clinic: { id: string; slug: string }, nextSlug: string) {
  if (clinic.slug === nextSlug) return;
  await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`clinic-slug:${nextSlug}`}, 0))`;
  if (await isSlugTakenByAnotherClinic(transaction, clinic.id, nextSlug)) throw new SlugInUseError();
  await transaction.clinicSlugAlias.upsert({
    where: { slug: clinic.slug },
    create: { slug: clinic.slug, clinicId: clinic.id },
    update: { clinicId: clinic.id },
  });
  await transaction.clinicSlugAlias.deleteMany({ where: { clinicId: clinic.id, slug: nextSlug } });
}
