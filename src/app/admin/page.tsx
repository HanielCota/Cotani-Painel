import { addDays } from "date-fns";
import { ActivityIcon, Building2Icon, CalendarDaysIcon, CircleAlertIcon, ShieldBanIcon, UsersIcon } from "lucide-react";
import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import prisma from "@/lib/prisma";

export default async function PlatformAdminOverviewPage() {
  const thirtyDaysAgo = addDays(new Date(), -30);
  const [stores, activeStores, suspendedStores, deletedStores, customers, recentAppointments, failedNotifications, recentStores] = await Promise.all([
    prisma.clinic.count({ where: { deletedAt: null } }),
    prisma.clinic.count({ where: { deletedAt: null, operationalStatus: "ACTIVE" } }),
    prisma.clinic.count({ where: { deletedAt: null, operationalStatus: "SUSPENDED" } }),
    prisma.clinic.count({ where: { deletedAt: { not: null } } }),
    prisma.customer.count(),
    prisma.appointment.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.notification.count({ where: { status: "FAILED" } }),
    prisma.clinic.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { _count: { select: { memberships: true, appointments: true, customers: true } } },
    }),
  ]);

  const metrics = [
    { label: "Lojas", value: stores, icon: Building2Icon },
    { label: "Operacionais", value: activeStores, icon: ActivityIcon },
    { label: "Suspensas", value: suspendedStores, icon: ShieldBanIcon },
    { label: "Excluídas", value: deletedStores, icon: CircleAlertIcon },
    { label: "Clientes", value: customers, icon: UsersIcon },
    { label: "Agendamentos em 30 dias", value: recentAppointments, icon: CalendarDaysIcon },
  ];

  return (
    <>
      <AdminPageHeader title="Visão geral da plataforma" description="Acompanhe lojas, uso e pontos que exigem atenção." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between gap-4">
              <div><p className="text-sm text-muted-foreground">{label}</p><p className="text-3xl font-semibold">{value}</p></div>
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span>
            </CardContent>
          </Card>
        ))}
      </div>

      {failedNotifications > 0 ? (
        <Card className="border-destructive/50">
          <CardHeader><CardTitle className="text-base">Atenção operacional</CardTitle><CardDescription>{failedNotifications} notificações estão com falha e precisam ser verificadas.</CardDescription></CardHeader>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between gap-4">
          <div><CardTitle>Lojas recentes</CardTitle><CardDescription>Últimas lojas sincronizadas com a plataforma.</CardDescription></div>
          <Button nativeButton={false} render={<Link href="/admin/lojas" />} variant="outline">Ver todas</Button>
        </CardHeader>
        <CardContent className="divide-y">
          {recentStores.map((clinic) => (
            <Link key={clinic.id} href={`/admin/lojas/${clinic.id}`} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-medium">{clinic.name}</p><p className="text-sm text-muted-foreground">/{clinic.slug} · {clinic._count.memberships} membros</p></div>
              <div className="flex items-center gap-2">
                {clinic.deletedAt ? <Badge variant="destructive">Excluída</Badge> : clinic.operationalStatus === "SUSPENDED" ? <Badge variant="destructive">Suspensa</Badge> : <Badge>Ativa</Badge>}
                <span className="text-sm text-muted-foreground">{clinic._count.customers} clientes · {clinic._count.appointments} atendimentos</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
