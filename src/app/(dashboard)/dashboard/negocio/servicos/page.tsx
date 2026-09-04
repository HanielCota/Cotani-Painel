import { SparklesIcon } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/page-header";
import { ServicesSettings } from "@/components/dashboard/services-settings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Serviços" };

export default withTenant(async ({ clinic }) => (
  <div className="flex flex-col gap-6">
    <PageHeader title="Serviços" description={`Serviços disponíveis para agendamento em ${clinic.name}.`} />
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><SparklesIcon />Catálogo de serviços</CardTitle>
        <CardDescription>Defina preço, duração e disponibilidade de cada serviço.</CardDescription>
      </CardHeader>
      <CardContent><ServicesSettings /></CardContent>
    </Card>
  </div>
), ["ADMIN"]);
