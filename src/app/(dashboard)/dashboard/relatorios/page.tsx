import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { EmptyBarbershopState } from "@/components/dashboard/empty-barbershop-state";
import { ReportsKpiCards } from "@/components/dashboard/reports-kpi-cards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireActiveClinic } from "@/server/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Relatórios" };

export default async function RelatoriosPage() {
  await auth.protect();

  const clinic = await requireActiveClinic();

  if (!clinic) {
    return <EmptyBarbershopState />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Transforme a rotina da {clinic.name} em decisões claras.</p>
      </div>
      <ReportsKpiCards />
      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Como os indicadores são calculados</CardTitle>
          <CardDescription>As taxas consideram o mês atual no fuso {clinic.timeZone}.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <p><strong className="font-medium text-foreground">Taxa de confirmação:</strong> atendimentos confirmados ou concluídos sobre todos os atendimentos do mês, exceto cancelados.</p>
          <p><strong className="font-medium text-foreground">Taxa de falta:</strong> não comparecimentos sobre os atendimentos do mês, exceto cancelados.</p>
          <p><strong className="font-medium text-foreground">Clientes ativos no mês:</strong> clientes com ao menos um atendimento no mês, exceto cancelados.</p>
        </CardContent>
      </Card>
    </div>
  );
}
