import { DollarSignIcon } from "lucide-react";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Financeiro" };

export default withTenant(async () => {
  return <FeaturePlaceholder title="Financeiro" description="Acompanhe receitas, cobranças e inadimplência." icon={DollarSignIcon} />;
});
