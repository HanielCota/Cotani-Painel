import { BotIcon } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { FeaturePlaceholder } from "@/components/dashboard/feature-placeholder";

export const metadata: Metadata = { title: "Cotani AI" };

export default async function AiPage() {
  await auth.protect();

  return <FeaturePlaceholder title="Cotani AI" description="Uma central inteligente para a operação da sua barbearia." icon={BotIcon} />;
}
