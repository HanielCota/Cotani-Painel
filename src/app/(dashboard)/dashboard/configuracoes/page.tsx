import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Configurações" };

const legacyTargets: Record<string, string> = {
  services: "/dashboard/negocio/servicos",
  professionals: "/dashboard/negocio/profissionais",
  "business-hours": "/dashboard/negocio/horarios",
  team: "/dashboard/negocio/equipe",
  locations: "/dashboard/negocio/unidades",
};

export default async function LegacyConfiguracoesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  redirect((tab && legacyTargets[tab]) || "/dashboard/minha-conta");
}
