import type { NextRequest } from "next/server";

import { buildContentSecurityPolicy } from "@/lib/content-security-policy";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

export default async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const response = await updateSupabaseSession(request, requestHeaders);
  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(nonce, process.env.NODE_ENV === "development"),
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
