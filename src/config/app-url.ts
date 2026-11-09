/** Endereço local usado só quando NEXT_PUBLIC_APP_URL não existe (desenvolvimento). */
export const DEVELOPMENT_APP_URL = "http://localhost:3000";

export class MissingConfigurationError extends Error {
  constructor(variableName: string) {
    super(`${variableName} não está configurada.`);
    this.name = "MissingConfigurationError";
  }
}

/** Origem pública do painel, de NEXT_PUBLIC_APP_URL, sem barra no fim. */
export function readConfiguredAppUrl(): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!appUrl) return null;
  return appUrl.replace(/\/$/, "");
}

/** Como readConfiguredAppUrl, mas falha quando a variável não existe. */
export function requireConfiguredAppUrl(): string {
  const appUrl = readConfiguredAppUrl();
  if (!appUrl) throw new MissingConfigurationError("NEXT_PUBLIC_APP_URL");
  return appUrl;
}
