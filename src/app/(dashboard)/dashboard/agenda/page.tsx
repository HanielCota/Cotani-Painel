import type { Metadata } from "next";

import { AgendaBoard } from "@/components/dashboard/agenda/agenda-board";
import { AgendaSetup } from "@/components/dashboard/agenda-setup";
import { AppointmentFormDialog } from "@/components/dashboard/appointment-form-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import prisma from "@/lib/prisma";
import { formatClinicDateKey, formatClinicDateTimeInput } from "@/lib/timezone";
import { withTenant } from "@/server/with-tenant";

export const metadata: Metadata = { title: "Agenda" };

interface AgendaPageProps { searchParams: Promise<{ customerId?: string | string[]; visao?: string | string[]; data?: string | string[]; novo?: string | string[] }> }

const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
export default withTenant<AgendaPageProps>(async ({ clinic, membership, role }, { searchParams }) => {
  const query = await searchParams;
  const initialCustomerId = firstParam(query.customerId);
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
        description="Veja o dia ou a semana, clique num horário vago para agendar e num atendimento para confirmar, reagendar ou concluir."
        actions={
          canSchedule ? (
            <AppointmentFormDialog
              customers={customers}
              services={services}
              minStartTime={minStartTime}
              timeZone={clinic.timeZone}
              initialCustomerId={customers.some((customer) => customer.id === initialCustomerId) ? initialCustomerId : undefined}
              defaultOpen={firstParam(query.novo) === "1"}
            />
          ) : undefined
        }
      />

      {role !== "PROVIDER" ? <AgendaSetup needsCustomers={customers.length === 0} needsServices={services.length === 0} /> : null}

      {role === "PROVIDER" && !providerProfessional ? (
        <Alert variant="warning"><AlertDescription>Seu acesso ainda não foi vinculado a um profissional ativo. Peça a um administrador para concluir o vínculo.</AlertDescription></Alert>
      ) : null}

      <AgendaBoard
        timeZone={clinic.timeZone}
        minStartTime={minStartTime}
        canSchedule={canSchedule}
        customers={customers}
        services={services}
        today={formatClinicDateKey(now, clinic.timeZone)}
        initialView={firstParam(query.visao)}
        initialDate={firstParam(query.data)}
      />
    </div>
  );
}, ["ADMIN", "RECEPTIONIST", "PROVIDER"]);
