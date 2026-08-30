import type { Metadata } from "next";

import { CustomersTable } from "@/components/dashboard/customers-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Clientes" };

export default withTenant(async ({ clinic }) => {

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description={`Centralize sua base e o histórico de atendimentos de ${clinic.name}.`}
      />
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Base de clientes</CardTitle>
          <CardDescription>Busque, pagine e gerencie os clientes da loja.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomersTable />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN", "RECEPTIONIST"]);
