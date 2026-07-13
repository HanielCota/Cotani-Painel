import { SettingsIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";

export const metadata: Metadata = { title: "Configurações" };

export default async function ConfiguracoesPage() {
  await auth.protect();

  return <FeaturePlaceholder title="Configurações" description="Ajuste os detalhes que definem a operação da sua clínica." icon={SettingsIcon} />;
}
