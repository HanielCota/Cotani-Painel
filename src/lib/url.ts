import { headers } from "next/headers";

export async function getPublicBookingUrl(slug: string): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (appUrl) {
    return `${appUrl.replace(/\/$/, "")}/${slug}`;
  }

  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host") ?? "";
  const protocol = headersList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");

  return `${protocol}://${host}/${slug}`;
}
