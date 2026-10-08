import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { headers } from "next/headers";

import { AppProviders } from "@/app/providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Cotani",
  title: {
    default: "Cotani - Gestão inteligente para negócios",
    template: "%s | Cotani",
  },
  description:
    "Plataforma de gestão para negócios com agenda on-line, clientes, relatórios e agendamento público.",
  icons: {
    icon: [{ url: "/images/cotani-favicon.png", type: "image/png" }],
    apple: "/images/cotani-favicon.png",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Cotani",
    title: "Cotani - Gestão inteligente para negócios",
    description:
      "Plataforma de gestão para negócios com agenda on-line, clientes, relatórios e agendamento público.",
    images: [
      {
        url: "https://painel.cotani.com.br/images/cotani-logo.png",
        width: 1254,
        height: 1254,
        alt: "Cotani",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Cotani - Gestão inteligente para negócios",
    description:
      "Plataforma de gestão para negócios com agenda on-line, clientes, relatórios e agendamento público.",
    images: ["https://painel.cotani.com.br/images/cotani-logo.png"],
  },
};

const analyticsEnabled = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS_ENABLED === "true";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A CSP baseada em nonce exige HTML gerado por requisição para que todos os
  // scripts e estilos recebam o mesmo nonce criado no proxy.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-lg bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Pular para o conteúdo principal
        </a>
        <AppProviders nonce={nonce}>
          {children}
        </AppProviders>
        {analyticsEnabled ? <Analytics /> : null}
      </body>
    </html>
  );
}
