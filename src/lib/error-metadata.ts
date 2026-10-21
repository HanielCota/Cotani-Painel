type ErrorMetadata = {
  errorName: string;
  errorCode?: string;
};

function findErrorCode(error: unknown): string | undefined {
  // Guarda os objetos já vistos: uma cadeia de `cause` circular não pode
  // travar o processo no meio de um catch.
  const visited = new Set<object>();
  let current: unknown = error;

  while (current !== null && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }

  return undefined;
}

/**
 * Campos seguros para log: nome e código do erro (ex.: P2002 do Prisma).
 * A mensagem fica de fora porque pode trazer dados do cliente.
 */
export function getErrorMetadata(error: unknown): ErrorMetadata {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const errorCode = findErrorCode(error);

  if (!errorCode) return { errorName };
  return { errorName, errorCode };
}
