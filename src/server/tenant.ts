import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function requireActiveClinic() {
  const { orgId } = await auth.protect();

  if (!orgId) {
    return null;
  }

  const clinic = await prisma.clinic.findUnique({
    where: {
      clerkOrgId: orgId,
    },
  });

  return clinic;
}
