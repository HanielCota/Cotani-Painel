import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeRedirectPath } from "@/lib/safe-redirect";
import { getSupabaseAuthCookieNames } from "@/lib/supabase/auth-cookie-names";
import { isRecoverySession } from "@/lib/supabase/recovery-session";
import { getRecoveryMfaStatus } from "@/lib/supabase/recovery-mfa";
import { createClient } from "@/lib/supabase/server";

/**
 * Fluxo de recuperação de senha (único, para links `token_hash` e `code`):
 *
 * 1. GET com `token_hash`: guarda o token em cookie e mostra a confirmação, sem
 *    consumi-lo (provedores de e-mail abrem links para pré-visualização).
 * 2. POST `begin`: valida o link e cria uma sessão temporária de recuperação,
 *    que o proxy impede de acessar o painel.
 * 3. Se a conta tem 2FA, exige o código do autenticador antes da nova senha.
 * 4. POST `password`: troca a senha, encerra TODAS as sessões da conta e manda
 *    para o login - a pessoa entra com a nova senha.
 */

const recoveryTokenCookie = "cotani_recovery_token";
const recoveryPendingCookie = "cotani_recovery_pending";

const emailOtpTypes: ReadonlySet<EmailOtpType> = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function parseEmailOtpType(value: string | null): EmailOtpType | null {
  if (value == null || value.trim().length === 0) return null;

  const candidate = value as EmailOtpType;
  if (!emailOtpTypes.has(candidate)) return null;

  return candidate;
}

function isRecoveryDestination(next: string) {
  return next.startsWith("/auth/confirm-recovery") || next.startsWith("/update-password");
}

interface RecoveryRedirectOptions {
  clearToken?: boolean;
  pending?: boolean;
  clearSessionNames?: string[];
}

function recoveryRedirect(target: URL, options: RecoveryRedirectOptions = {}) {
  const secure = target.protocol === "https:";
  const response = NextResponse.redirect(target, 303);
  if (options.clearToken) {
    response.cookies.set(recoveryTokenCookie, "", { path: "/auth/callback", maxAge: 0 });
  }
  if (options.pending !== undefined) {
    response.cookies.set(recoveryPendingCookie, options.pending ? "1" : "", {
      httpOnly: true,
      secure,
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

/** Próxima etapa da recuperação conforme o 2FA da conta. */
async function recoveryStepUrl(supabase: SupabaseClient, origin: string) {
  const status = await getRecoveryMfaStatus(supabase);
  if (status === "required") return new URL("/auth/recovery-mfa", origin);
  if (status === "unavailable") return new URL("/auth/confirm-recovery?error=mfa_unavailable", origin);
  return new URL("/auth/confirm-recovery", origin);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = parseEmailOtpType(url.searchParams.get("type"));
  const next = safeRedirectPath(url.searchParams.get("next"));

  if (tokenHash && type === "recovery") {
    if (tokenHash.length > 1024) {
      return recoveryRedirect(new URL("/auth/confirm-recovery?error=invalid", url.origin));
    }
    const response = recoveryRedirect(new URL("/auth/confirm-recovery", url.origin));
    response.cookies.set(recoveryTokenCookie, tokenHash, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "lax",
      path: "/auth/callback",
      maxAge: 10 * 60,
    });
    return response;
  }

  const supabase = await createClient();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Código de autenticação ausente.") };

  if (result.error) {
    // Link de recuperação vencido, já usado ou aberto em outro navegador (PKCE):
    // explica o motivo na própria tela de "esqueci minha senha".
    const failure = isRecoveryDestination(next) ? "/forgot-password?error=link" : "/sign-in?error=auth_callback";
    return NextResponse.redirect(new URL(failure, url.origin));
  }

  // Sessão de recuperação (link no formato `code`) nunca segue direto para o
  // painel nem para a tela de convite: entra no mesmo fluxo protegido.
  const { data: claimsData } = await supabase.auth.getClaims();
  if (isRecoverySession(claimsData?.claims)) {
    return recoveryRedirect(await recoveryStepUrl(supabase, url.origin), { pending: true });
  }

  return NextResponse.redirect(new URL(next, url.origin));
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const invalidUrl = new URL("/auth/confirm-recovery?error=invalid", url.origin);
  const tokenHash = request.cookies.get(recoveryTokenCookie)?.value;

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
      return recoveryRedirect(await recoveryStepUrl(supabase, url.origin), { clearToken: true, pending: true });
    }

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    if (claimsError || !isRecoverySession(claimsData?.claims)) {
      return recoveryRedirect(invalidUrl, { clearToken: true, pending: false });
    }
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || !data.user) return recoveryRedirect(invalidUrl, { clearToken: true, pending: false });

    // Revalida no servidor: a senha só é aceita depois do 2FA (quando existir).
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
      if (updateError.code === "insufficient_aal") {
        return recoveryRedirect(new URL("/auth/recovery-mfa", url.origin), { clearToken: true, pending: true });
      }
      const reason = updateError.code === "weak_password" || updateError.code === "same_password" ? updateError.code : "retry";
      return recoveryRedirect(new URL(`/auth/confirm-recovery?error=${reason}`, url.origin), { clearToken: true, pending: true });
    }
    updated = true;

    // Senha trocada por recuperação: derruba todas as sessões da conta (inclusive
    // de quem eventualmente tinha a senha antiga) e exige login com a nova.
    try {
      const { error } = await supabase.auth.signOut({ scope: "global" });
      if (error) await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Os cookies desta sessão são removidos abaixo mesmo se a chamada falhar.
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
