import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon, CalendarPlusIcon } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CustomerAppointmentHistory } from "@/components/dashboard/customer-appointment-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";
import { withTenant } from "@/server/with-tenant";

interface Props { params: Promise<{ customerId: string }> }
export default withTenant<Props>(async ({ clinic }, { params }) => {
  const { customerId } = await params;
  const customer = await prisma.customer.findFirst({ where: { id: customerId, clinicId: clinic.id }, include: { appointments: { include: { service: true, professional: true }, orderBy: { startTime: "desc" } } } });
  if (!customer) notFound();
  const formatDate = (date: Date) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: clinic.timeZone }).format(date);
  return <div className="flex flex-col gap-6"><PageHeader title={customer.name} description="Dados e histórico completo do cliente." actions={<Button nativeButton={false} variant="outline" render={<Link href={`/dashboard/agenda?customerId=${customer.id}`} />}><CalendarPlusIcon />Novo atendimento</Button>} />
    <Button nativeButton={false} variant="ghost" className="self-start" render={<Link href="/dashboard/clientes" />}><ArrowLeftIcon />Voltar aos clientes</Button>
    <div className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>Contato</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{customer.phone}</p><p>{customer.email ?? "Sem e-mail"}</p>{customer.tags.length ? <div className="flex flex-wrap gap-1">{customer.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div> : null}<p className="text-muted-foreground">Próximo retorno: {customer.nextReturnAt ? formatDate(customer.nextReturnAt) : "não definido"}</p><p className="whitespace-pre-wrap text-muted-foreground">{customer.notes || "Sem observações."}</p></CardContent></Card>
    <Card className="lg:col-span-2"><CardHeader><CardTitle>Histórico de atendimentos</CardTitle></CardHeader><CardContent><CustomerAppointmentHistory appointments={customer.appointments.map((appointment) => ({ id: appointment.id, dateTime: formatDate(appointment.startTime), serviceName: appointment.service.name, professionalName: appointment.professional?.name ?? "Sem profissional", status: appointment.status }))} /></CardContent></Card></div>
  </div>;
}, ["ADMIN", "RECEPTIONIST"]);
