import type { Metadata } from "next";

import { CustomersTable } from "@/components/dashboard/customers-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { withTenant } from "@/server/with-tenant";
import { NewCustomerDialog } from "@/components/dashboard/new-customer-dialog";
import { ImportCustomersButton } from "@/components/dashboard/import-customers-dialog";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "lucide-react";

export const metadata: Metadata = { title: "Clientes" };

export default withTenant(async ({ clinic }) => {

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        description={`Centralize sua base e o histórico de atendimentos de ${clinic.name}.`}
        actions={<div className="flex w-full flex-wrap items-center gap-2 lg:w-auto"><ImportCustomersButton /><Button nativeButton={false} variant="outline" render={<a href="/api/customers/export" download />}><DownloadIcon />Exportar</Button><NewCustomerDialog /></div>}
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
