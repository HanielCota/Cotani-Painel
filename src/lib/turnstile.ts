import "server-only";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ALWAYS_PASS_TEST_SECRET = "1x0000000000000000000000000000000AA";

interface TurnstileResponse {
  success?: boolean;
  action?: string;
}

export class TurnstileConfigurationError extends Error {}

function isProductionEnvironment() {
  return process.env.NODE_ENV === "production"
    || process.env.VERCEL_ENV === "production"
    || process.env.APP_ENV === "production";
}

export async function verifyTurnstileToken(token: string, remoteIp?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    if (isProductionEnvironment()) {
      throw new TurnstileConfigurationError("TURNSTILE_SECRET_KEY não está configurada.");
    }
    return true;
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") form.set("remoteip", remoteIp);

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = await response.json() as TurnstileResponse;
    const validAction = result.action === "checkout"
      || (secret === ALWAYS_PASS_TEST_SECRET && !result.action);
    return result.success === true && validAction;
  } catch {
    return false;
  }
}
