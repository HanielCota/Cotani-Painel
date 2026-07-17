"use server";

import { revalidatePath } from "next/cache";

import { syncActiveClinicFromClerk } from "@/server/services/clinic-sync";
import type { ActionResult } from "@/types";

export async function syncActiveClinic(): Promise<ActionResult> {
  const result = await syncActiveClinicFromClerk();

  if (result.status === "no-org") {
    return { status: "error", message: result.message };
  }

  if (result.status === "error") {
    return { status: "error", message: result.message };
  }

  revalidatePath("/dashboard");

  return { status: "success", message: result.message };
}
