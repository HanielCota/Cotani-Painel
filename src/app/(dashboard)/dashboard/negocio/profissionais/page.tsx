import { Users2Icon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ProfessionalsSettings } from "@/components/dashboard/professionals-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Profissionais" };

export default withTenant(async ({ clinic }) => (
  <div className="flex flex-col gap-6">
    <PageHeader title="Profissionais" description={`Equipe de atendimento de ${clinic.name}.`} />
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users2Icon />Profissionais</CardTitle>
        <CardDescription>Vincule cada profissional aos serviços que realiza.</CardDescription>
      </CardHeader>
      <CardContent><ProfessionalsSettings /></CardContent>
    </Card>
  </div>
), ["ADMIN"]);
