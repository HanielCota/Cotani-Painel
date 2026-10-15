const DEFAULT_DESTINATION = "/dashboard";

// Origem fictícia só para o navegador-padrão do URL resolver caminhos relativos.
const INTERNAL_ORIGIN = "https://cotani.internal";

// Caracteres de controle (incluindo tab e quebra de linha), que o navegador
// descarta ao interpretar a URL e podem transformar "/\t/site" em "//site".
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

/**
 * Caminho interno seguro para redirecionar depois do login, do 2FA ou do link
 * do e-mail. Aceita só caminhos do próprio site ("/..."). Recusa "//" e "\"
 * (o navegador trata "/\site" como "//site"), caracteres de controle e
 * qualquer valor que resolva para outra origem. Sem valor válido, devolve o
 * destino padrão.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = DEFAULT_DESTINATION): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\") || CONTROL_CHARACTERS.test(value)) return fallback;

  try {
    const target = new URL(value, INTERNAL_ORIGIN);
    if (target.origin !== INTERNAL_ORIGIN) return fallback;

    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
