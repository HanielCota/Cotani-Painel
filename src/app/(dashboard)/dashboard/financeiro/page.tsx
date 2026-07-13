import { DollarSignIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";

export const metadata: Metadata = { title: "Financeiro" };

export default async function FinanceiroPage() {
  await auth.protect();

  return <FeaturePlaceholder title="Financeiro" description="Acompanhe receitas, cobranças e inadimplência." icon={DollarSignIcon} />;
}
