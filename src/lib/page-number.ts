/** Teto da paginação: evita `skip` gigante vindo da URL. */
export const MAX_PAGE_NUMBER = 10_000;

/** Lê o número da página vindo da URL; valor ausente ou inválido vira 1. */
export function parsePageNumber(value: string | null | undefined): number {
  const pageNumber = Number.parseInt(value ?? "1", 10);

  if (!Number.isFinite(pageNumber) || pageNumber < 1) return 1;

  return Math.min(pageNumber, MAX_PAGE_NUMBER);
}
