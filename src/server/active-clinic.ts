import "server-only";

import { cookies } from "next/headers";

import { ACTIVE_CLINIC_COOKIE } from "@/server/tenant";

/**
 * Grava a loja ativa da sessão. O cookie é só preferência de interface: cada
 * requisição revalida a membership antes de usá-lo (ver server/tenant.ts).
 */
export async function setActiveClinic(clinicId: string) {
  (await cookies()).set(ACTIVE_CLINIC_COOKIE, clinicId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
