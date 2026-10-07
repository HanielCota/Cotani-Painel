"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getSupabaseAuthCookieNames } from "@/lib/supabase/auth-cookie-names";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function signOutCurrentSession() {
  const supabase = await createClient();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Clear this project's cookies below even when the auth service is unavailable.
  }
  const cookieStore = await cookies();
  for (const name of getSupabaseAuthCookieNames(cookieStore.getAll().map(({ name }) => name))) {
    cookieStore.set(name, "", { path: "/", maxAge: 0 });
  }
  cookieStore.set("cotani_recovery_pending", "", { path: "/", maxAge: 0 });
  cookieStore.set("cotani_recovery_token", "", { path: "/auth/callback", maxAge: 0 });
  redirect("/sign-in");
}

