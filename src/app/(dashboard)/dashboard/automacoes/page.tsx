import { MessageSquareIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";

export const metadata: Metadata = { title: "Automações" };

export default async function AutomacoesPage() {
  await auth.protect();

  return <FeaturePlaceholder title="Automações" description="Reduza no-shows com lembretes nos canais certos." icon={MessageSquareIcon} />;
}
