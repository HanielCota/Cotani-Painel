import type { Metadata } from "next";

import { WhatsAppCrmList } from "@/components/dashboard/whatsapp-crm-list";
import { getWhatsAppCrmData } from "@/server/services/whatsapp-crm";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Comunicações" };

export default withTenant(async ({ clinic }) => {
  const data = await getWhatsAppCrmData(clinic);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl lg:text-3xl">Comunicações</h1>
        <p className="text-sm text-muted-foreground">
          Envie mensagens do WhatsApp manualmente e acompanhe o histórico da {clinic.name}.
        </p>
      </div>

      <WhatsAppCrmList pending={data.pending} sent={data.sent} />
    </div>
  );
});
