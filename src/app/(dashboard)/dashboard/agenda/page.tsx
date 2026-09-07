import { CalendarDaysIcon } from "lucide-react";
import type { Metadata } from "next";

import { AgendaAppointmentsList } from "@/components/dashboard/agenda-appointments-list";
import { AgendaSetup } from "@/components/dashboard/agenda-setup";
import { AppointmentFormDialog } from "@/components/dashboard/appointment-form-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Agenda" };

interface AgendaPageProps { searchParams: Promise<{ customerId?: string | string[] }> }
export default withTenant<AgendaPageProps>(async ({ clinic, membership, role }, { searchParams }) => {
  const requestedCustomerId = (await searchParams).customerId;
  const initialCustomerId = Array.isArray(requestedCustomerId) ? requestedCustomerId[0] : requestedCustomerId;
  const now = new Date();
  const providerProfessional = role === "PROVIDER"
    ? await prisma.professional.findFirst({ where: { clinicId: clinic.id, membershipId: membership.id, isActive: true }, select: { id: true } })
    : null;
  const [customers, services] = role === "PROVIDER" ? [[], []] : await Promise.all([
    prisma.customer.findMany({
      where: { clinicId: clinic.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.service.findMany({
      where: { clinicId: clinic.id, isActive: true },
      select: { id: true, name: true, duration: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const minStartTime = formatClinicDateTimeInput(now, clinic.timeZone);
  const canSchedule = role !== "PROVIDER" && customers.length > 0 && services.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Agenda"
        description={`Organize os próximos atendimentos de ${clinic.name}.`}
        actions={
          canSchedule ? (
            <AppointmentFormDialog
              customers={customers}
              services={services}
              minStartTime={minStartTime}
              timeZone={clinic.timeZone}
              initialCustomerId={customers.some((customer) => customer.id === initialCustomerId) ? initialCustomerId : undefined}
            />
          ) : undefined
        }
      />

      {role !== "PROVIDER" ? <AgendaSetup needsCustomers={customers.length === 0} needsServices={services.length === 0} /> : null}

      {role === "PROVIDER" && !providerProfessional ? (
        <Alert variant="warning"><AlertDescription>Seu acesso ainda não foi vinculado a um profissional ativo. Peça a um administrador para concluir o vínculo.</AlertDescription></Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDaysIcon /> Próximos atendimentos</CardTitle>
          <CardDescription>Confirme, reagende ou conclua os atendimentos conforme a operação avança. A lista é atualizada automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <AgendaAppointmentsList timeZone={clinic.timeZone} minStartTime={minStartTime} canSchedule={canSchedule} customers={customers} services={services} />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN", "RECEPTIONIST", "PROVIDER"]);
