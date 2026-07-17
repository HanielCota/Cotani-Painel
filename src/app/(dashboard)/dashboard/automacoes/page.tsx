import { MessageSquareIcon } from "lucide-react";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Automações" };

export default withTenant(async () => {
  return <FeaturePlaceholder title="Automações" description="Reduza no-shows com lembretes nos canais certos." icon={MessageSquareIcon} />;
});
