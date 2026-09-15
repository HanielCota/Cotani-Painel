function safeOrigin(value: string | undefined) {
  try {
    return value ? new URL(value).origin : "";
  } catch {
    return "";
  }
}

export function buildContentSecurityPolicy(nonce: string, development = false) {
  const supabaseOrigin = safeOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);
  // O Sonner injeta uma folha fixa sem suporte a nonce. O hash autoriza apenas
  // o CSS exato da versão travada no lockfile, sem liberar estilos arbitrários.
  const sonnerStyleHash = "'sha256-StEaX+se6YS7pqjzrzMIA0KaX9zF/8zAhvQXZAe5epY='";
  const scriptSources = [
    "'self'",
    "https://challenges.cloudflare.com",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(development ? ["'unsafe-eval'"] : []),
  ];
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    `style-src-elem 'self' 'nonce-${nonce}' ${sonnerStyleHash}`,
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: https:${supabaseOrigin ? ` ${supabaseOrigin}` : ""}`,
    `connect-src 'self'${supabaseOrigin ? ` ${supabaseOrigin}` : ""} https://api.mercadopago.com https://*.mercadopago.com https://challenges.cloudflare.com`,
    "font-src 'self' data:",
    "frame-src https://*.mercadopago.com https://challenges.cloudflare.com",
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
