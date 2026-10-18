import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cotani",
    short_name: "Cotani",
    description: "Painel de gestão para negócios",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#18181b",
    icons: [
      {
        src: "/images/cotani-favicon.png",
        sizes: "256x256",
        type: "image/png",
      },
    ],
  };
}
