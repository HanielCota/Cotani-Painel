import type { MetadataRoute } from "next";

import prisma from "@/lib/prisma";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";
  const baseUrl = appUrl.replace(/\/$/, "");

  const clinics = await prisma.clinic.findMany({
    where: { deletedAt: null, subscriptionStatus: "ACTIVE" },
    select: { slug: true, updatedAt: true },
  });

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...clinics.map((clinic) => ({
      url: `${baseUrl}/${clinic.slug}`,
      lastModified: clinic.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
