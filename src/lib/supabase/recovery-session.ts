export function isRecoverySession(claims: unknown): boolean {
  if (!claims || typeof claims !== "object" || !("amr" in claims)) return false;
  const methods = claims.amr;
  return Array.isArray(methods) && methods.some(
    (entry) => entry && typeof entry === "object" && "method" in entry && entry.method === "recovery",
  );
}
