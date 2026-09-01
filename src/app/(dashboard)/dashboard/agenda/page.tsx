import { CalendarDaysIcon } from "lucide-react";
import type { Metadata } from "next";

import { AgendaAppointmentsList } from "@/components/dashboard/agenda-appointments-list";
import { AgendaSetup } from "@/components/dashboard/agenda-setup";
import { AppointmentFormDialog } from "@/components/dashboard/appointment-form-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Agenda" };

export default withTenant(async ({ clinic, membership, role }) => {
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
            />
          ) : undefined
        }
      />

      {role !== "PROVIDER" ? <AgendaSetup needsCustomers={customers.length === 0} needsServices={services.length === 0} /> : null}

      {role === "PROVIDER" && !providerProfessional ? (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Seu acesso ainda não foi vinculado a um profissional ativo. Peça a um administrador para concluir o vínculo.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarDaysIcon /> Próximos atendimentos</CardTitle>
          <CardDescription>Confirme, reagende ou conclua os atendimentos conforme a operação avança. A lista é atualizada automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <AgendaAppointmentsList timeZone={clinic.timeZone} minStartTime={minStartTime} canSchedule={canSchedule} />
        </CardContent>
      </Card>
    </div>
  );
}, ["ADMIN", "RECEPTIONIST", "PROVIDER"]);
