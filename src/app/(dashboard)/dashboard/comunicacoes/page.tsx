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
  const automaticMode = process.env.WHATSAPP_SENDER_MODE === "api";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Comunicações"
        description={automaticMode
          ? `Acompanhe os lembretes automáticos e o histórico da ${clinic.name}.`
          : `Envie mensagens do WhatsApp manualmente e acompanhe o histórico da ${clinic.name}.`}
      />

      <Alert className="border-primary/20 bg-primary/5">
        <InfoIcon className="size-4 text-primary" />
        <AlertTitle>{automaticMode ? "Automação do WhatsApp ativa" : "Envio manual pelo WhatsApp"}</AlertTitle>
        <AlertDescription>
          {automaticMode
            ? "O Cotani envia confirmações e lembretes automaticamente. O cliente pode responder 1 para confirmar ou 2 para receber o link de reagendamento."
            : "O Cotani gera o link direto para o WhatsApp Web/App com a mensagem pronta. Você abre, envia e marca como enviada."}
        </AlertDescription>
      </Alert>

      <WhatsAppCrmList pending={data.pending} sent={data.sent} automaticMode={automaticMode} />
    </div>
  );
}, ["ADMIN", "RECEPTIONIST"]);
