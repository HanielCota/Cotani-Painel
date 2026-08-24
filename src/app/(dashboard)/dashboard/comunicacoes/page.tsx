import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";

import { WhatsAppCrmList } from "@/components/dashboard/whatsapp-crm-list";
import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getWhatsAppCrmData } from "@/server/services/whatsapp-crm";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Comunicações" };

export default withTenant(async ({ clinic }) => {
  const data = await getWhatsAppCrmData(clinic);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Comunicações"
        description={`Envie mensagens do WhatsApp manualmente e acompanhe o histórico da ${clinic.name}.`}
      />

      <Alert className="border-primary/20 bg-primary/5">
        <InfoIcon className="size-4 text-primary" />
        <AlertTitle>Envio manual pelo WhatsApp</AlertTitle>
        <AlertDescription>
          O Cotani gera o link direto para o WhatsApp Web/App com a mensagem pronta. Você abre, envia e marca
          como enviada. Nenhuma mensagem é enviada automaticamente pelo sistema.
        </AlertDescription>
      </Alert>

      <WhatsAppCrmList pending={data.pending} sent={data.sent} />
    </div>
  );
}, ["ADMIN", "RECEPTIONIST"]);
