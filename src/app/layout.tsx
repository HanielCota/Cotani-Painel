import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ptBR } from "@clerk/localizations/pt-BR";
import { Analytics } from "@vercel/analytics/react";
import { Geist, Geist_Mono } from "next/font/google";

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
    default: "Cotani — Gestão inteligente para barbearias",
    template: "%s | Cotani",
  },
  description:
    "Plataforma de gestão para barbearias: agenda online, clientes, relatórios e agendamento público com lembretes automáticos por WhatsApp.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Cotani",
    title: "Cotani — Gestão inteligente para barbearias",
    description:
      "Plataforma de gestão para barbearias: agenda online, clientes, relatórios e agendamento público com lembretes automáticos por WhatsApp.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider localization={ptBR}>
      <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <body suppressHydrationWarning>
          <AppProviders>{children}</AppProviders>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
