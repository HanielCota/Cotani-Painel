import { BarChart3Icon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";

export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage() {
  await auth.protect();

  return <FeaturePlaceholder title="Relatórios" description="Transforme a rotina da clínica em decisões claras." icon={BarChart3Icon} />;
}
