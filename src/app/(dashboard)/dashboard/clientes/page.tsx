import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";

import { CustomersTable } from "@/components/dashboard/customers-table";
import { EmptyBarbershopState } from "@/components/dashboard/empty-barbershop-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSelectedOrgId, requireActiveClinic } from "@/server/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clientes" };

export default async function ClientesPage() {
  await auth.protect();

  const [clinic, selectedOrgId] = await Promise.all([requireActiveClinic(), getSelectedOrgId()]);

  if (!clinic) {
    return <EmptyBarbershopState selectedOrgId={selectedOrgId} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground">Centralize sua base e o histórico de atendimentos de {clinic.name}.</p>
      </div>
      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle>Base de clientes</CardTitle>
          <CardDescription>Busque, pagine e gerencie os clientes da barbearia.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomersTable />
        </CardContent>
      </Card>
    </div>
  );
}
