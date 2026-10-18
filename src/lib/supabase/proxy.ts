import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { isRecoverySession } from "@/lib/supabase/recovery-session";

export async function updateSupabaseSession(request: NextRequest, requestHeaders = request.headers) {
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const { supabaseUrl, supabasePublishableKey } = getPublicSupabaseConfig();
  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers: requestHeaders } });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = !error && Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;
  const isPrivate = pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
  const recoveryPending = request.cookies.get("cotani_recovery_pending")?.value === "1";
  const recoveryBlocked = recoveryPending || (isAuthenticated && isRecoverySession(data?.claims));

  function redirectWithSession(url: URL) {
    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  if (recoveryBlocked && (pathname === "/" || isPrivate || pathname === "/mfa")) {
    return redirectWithSession(new URL("/auth/confirm-recovery", request.url));
  }

  if (recoveryBlocked && pathname.startsWith("/api/") && !pathname.startsWith("/api/public/") && !pathname.startsWith("/api/webhooks/")) {
    return new NextResponse(null, { status: 403, headers: { "Cache-Control": "private, no-store" } });
  }

  if (isPrivate && !isAuthenticated) {
    const signInUrl = request.nextUrl.clone();
    signInUrl.pathname = "/sign-in";
    signInUrl.search = "";
    signInUrl.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return redirectWithSession(signInUrl);
  }

  if (pathname.startsWith("/api/")) {
    response.headers.set("Cache-Control", "private, no-store");
  }

  return response;
}
