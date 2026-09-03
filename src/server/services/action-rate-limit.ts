import "server-only";

import { rateLimit } from "@/lib/rate-limit";

export async function allowMediaUpload(authUserId: string): Promise<boolean> {
  const result = await rateLimit({
    key: `media-upload:${authUserId}`,
    limit: 30,
    windowMs: 60 * 60_000,
  });
  return result.success;
}

export async function allowClinicInvitation(clinicId: string, authUserId: string): Promise<boolean> {
  const result = await rateLimit({
    key: `clinic-invitation:${clinicId}:${authUserId}`,
    limit: 20,
    windowMs: 60 * 60_000,
  });
  return result.success;
}
