const DEFAULT_LANDING_ORIGINS = ["https://cotani.com.br", "https://www.cotani.com.br"];

function allowedOrigins() {
  const configured = process.env.LANDING_PAGE_URL?.trim().replace(/\/$/, "");
  const origins = new Set(DEFAULT_LANDING_ORIGINS);
  if (configured) origins.add(configured);
  if (process.env.NODE_ENV !== "production") {
    origins.add("http://localhost:4321");
    origins.add("http://127.0.0.1:4321");
  }
  return origins;
}

export function landingCorsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin")?.replace(/\/$/, "");
  if (!origin || !allowedOrigins().has(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function isAllowedLandingOrigin(request: Request) {
  const origin = request.headers.get("origin")?.replace(/\/$/, "");
  return Boolean(origin && allowedOrigins().has(origin));
}

export function landingPageUrl() {
  return (process.env.LANDING_PAGE_URL?.trim() || "https://cotani.com.br").replace(/\/$/, "");
}
