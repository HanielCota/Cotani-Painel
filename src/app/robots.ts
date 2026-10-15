import type { MetadataRoute } from "next";

import { DEVELOPMENT_APP_URL, readConfiguredAppUrl } from "@/config/app-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = readConfiguredAppUrl() ?? DEVELOPMENT_APP_URL;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/api", "/sign-in", "/acesso-negado"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
