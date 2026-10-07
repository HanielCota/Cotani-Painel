import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseAuthCookieNames } from "@/lib/supabase/auth-cookie-names";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { getRecoveryMfaStatus } from "@/lib/supabase/recovery-mfa";
import { createClient } from "@/lib/supabase/server";

const recoveryTokenCookie = "cotani_recovery_token";
const recoveryPendingCookie = "cotani_recovery_pending";

function safeNext(value: string | null, origin: string) {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  try {
    const target = new URL(value, origin);
    return target.origin === origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"), url.origin);

  // Recovery links must not consume their one-time token on GET. Mail providers
  // may prefetch links, so defer verification until the user submits the page.
  if (tokenHash && type === "recovery") {
    if (tokenHash.length > 1024) {
      return NextResponse.redirect(new URL("/auth/confirm-recovery?error=invalid", url.origin), 303);
    }
    const confirmationUrl = new URL("/auth/confirm-recovery", url.origin);
    const response = NextResponse.redirect(confirmationUrl, 303);
    response.cookies.set(recoveryTokenCookie, tokenHash, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/auth/callback",
      maxAge: 10 * 60,
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  const supabase = await createClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Código de autenticação ausente.") };

  if (result.error) {
    return NextResponse.redirect(new URL("/sign-in?error=auth_callback", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const invalidUrl = new URL("/auth/confirm-recovery?error=invalid", url.origin);
  const tokenHash = request.cookies.get(recoveryTokenCookie)?.value;

  function recoveryRedirect(target: URL, options: { clearToken?: boolean; pending?: boolean; clearSessionNames?: string[] } = {}) {
    const response = NextResponse.redirect(target, 303);
    if (options.clearToken) {
      response.cookies.set(recoveryTokenCookie, "", { path: "/auth/callback", maxAge: 0 });
    }
    if (options.pending !== undefined) {
      response.cookies.set(recoveryPendingCookie, options.pending ? "1" : "", {
        httpOnly: true,
        secure: url.protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: options.pending ? 30 * 60 : 0,
      });
    }
    for (const name of options.clearSessionNames ?? []) {
      response.cookies.set(name, "", { path: "/", maxAge: 0 });
    }
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }

  let updated = false;
  try {
    if (tokenHash && tokenHash.length > 1024) {
      return recoveryRedirect(invalidUrl, { clearToken: true, pending: false });
    }

    const formData = await request.formData();
    const intent = formData.get("intent");
    if (intent !== "begin" && intent !== "password") return recoveryRedirect(invalidUrl);
    const supabase = await createClient();
    if (intent === "begin") {
      if (!tokenHash?.trim()) return recoveryRedirect(invalidUrl);
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
      if (error) return recoveryRedirect(invalidUrl, { clearToken: true, pending: false });
      const status = await getRecoveryMfaStatus(supabase);
      const destination = status === "required" ? "/auth/recovery-mfa" : "/auth/confirm-recovery";
      return recoveryRedirect(new URL(status === "unavailable" ? `${destination}?error=mfa_unavailable` : destination, url.origin), {
        clearToken: true,
        pending: true,
      });
    }

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !isRecoverySession(claimsData?.claims)) {
      return recoveryRedirect(invalidUrl, { clearToken: true, pending: false });
    }
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return recoveryRedirect(invalidUrl, { clearToken: true, pending: false });
    const mfaStatus = await getRecoveryMfaStatus(supabase);
    if (mfaStatus === "required") return recoveryRedirect(new URL("/auth/recovery-mfa", url.origin), { clearToken: true, pending: true });
    if (mfaStatus === "unavailable") return recoveryRedirect(new URL("/auth/confirm-recovery?error=mfa_unavailable", url.origin), { clearToken: true, pending: true });

    const password = formData.get("password");
    const confirmation = formData.get("confirmPassword");
    if (typeof password !== "string" || password.length < 8 || password.length > 256) {
      return recoveryRedirect(new URL("/auth/confirm-recovery?error=password", url.origin));
    }
    if (password !== confirmation) {
      return recoveryRedirect(new URL("/auth/confirm-recovery?error=mismatch", url.origin));
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      console.warn("[auth/recovery] password update failed", {
        code: updateError.code ?? "unknown",
        status: updateError.status,
      });
      const reason = updateError.code === "insufficient_aal"
        ? "mfa_required"
        : updateError.code === "weak_password" || updateError.code === "same_password"
        ? updateError.code
        : "retry";
      return recoveryRedirect(new URL(reason === "mfa_required" ? "/auth/recovery-mfa" : `/auth/confirm-recovery?error=${reason}`, url.origin), {
        clearToken: true,
        pending: true,
      });
    }
    updated = true;

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // The browser must not retain the temporary recovery session even if
      // the remote sign-out request fails after the password was updated.
    }
    const clearSessionNames = getSupabaseAuthCookieNames(request.cookies.getAll().map(({ name }) => name));
    return recoveryRedirect(new URL("/sign-in?password=updated", url.origin), {
      clearToken: true,
      pending: false,
      clearSessionNames,
    });
  } catch {
    return recoveryRedirect(
      updated
        ? new URL("/sign-in?password=updated", url.origin)
        : new URL("/auth/confirm-recovery?error=retry", url.origin),
      { clearToken: true, pending: !updated },
    );
  }
}

