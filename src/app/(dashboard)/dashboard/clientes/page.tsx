import { UsersIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  await auth.protect();

  return <FeaturePlaceholder title="Clientes" description="Centralize sua base e o histórico de atendimentos." icon={UsersIcon} />;
}
