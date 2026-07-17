import { BotIcon } from "lucide-react";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Cotani AI" };

export default withTenant(async () => {
  return <FeaturePlaceholder title="Cotani AI" description="Uma central inteligente para a operação da sua barbearia." icon={BotIcon} />;
});
