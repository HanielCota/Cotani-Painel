import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { PaginationNav } from "@/components/ui/pagination-nav";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { appointmentStatusBadgeVariant, appointmentStatusLabel } from "@/lib/display-labels";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import type { ReportAppointment } from "@/server/services/reports";

interface ReportsAppointmentsTableProps {
  data: { items: ReportAppointment[]; total: number; page: number; pageSize: number };
  timeZone: string;
  from?: string;
  to?: string;
}

export function ReportsAppointmentsTable({ data, timeZone, from, to }: ReportsAppointmentsTableProps) {
  const appointments = data.items;

  if (appointments.length === 0) {
    return (
      <Empty className="min-h-40 border border-dashed border-border/80 bg-background/50">
        <EmptyHeader><EmptyTitle>Nenhum agendamento</EmptyTitle><EmptyDescription>Nenhum agendamento no período selecionado.</EmptyDescription></EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="border-b py-4"><CardTitle>Lista de agendamentos</CardTitle></CardHeader>
      <CardContent className="px-5 py-0">
        <div className="hidden md:block">
        <Table>
          <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Cliente</TableHead><TableHead>Serviço</TableHead><TableHead>Profissional</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {appointments.map((appointment) => (
              <TableRow key={appointment.id}>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(appointment.startTime, timeZone)}
                </TableCell>
                <TableCell className="font-medium">{appointment.customerName}</TableCell><TableCell>{appointment.serviceName}</TableCell><TableCell className="text-muted-foreground">{appointment.professionalName ?? "—"}</TableCell>
                <TableCell><Badge variant={appointmentStatusBadgeVariant(appointment.status)}>{appointmentStatusLabel(appointment.status)}</Badge></TableCell>
                <TableCell className="text-right font-semibold">
                  {appointment.status === "CANCELED" || appointment.status === "NO_SHOW"
                    ? "—"
                    : formatCurrency(appointment.servicePrice)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        <div className="divide-y md:hidden">
          {appointments.map((appointment) => (
            <article key={appointment.id} className="space-y-2 py-4">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="font-medium">{appointment.customerName}</h3><p className="text-sm text-muted-foreground">{appointment.serviceName}</p></div>
                <Badge variant={appointmentStatusBadgeVariant(appointment.status)}>{appointmentStatusLabel(appointment.status)}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-muted-foreground">Data</dt><dd>{formatDateTime(appointment.startTime, timeZone)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Valor</dt><dd className="font-semibold">{appointment.status === "CANCELED" || appointment.status === "NO_SHOW" ? "—" : formatCurrency(appointment.servicePrice)}</dd></div>
                <div className="col-span-2"><dt className="text-xs text-muted-foreground">Profissional</dt><dd>{appointment.professionalName ?? "—"}</dd></div>
              </dl>
            </article>
          ))}
        </div>
      </CardContent>
      <div className="px-5 pb-5">
        <PaginationNav
          page={data.page}
          pageCount={Math.max(1, Math.ceil(data.total / data.pageSize))}
          totalItems={data.total}
          pageSize={data.pageSize}
          itemLabel="agendamentos"
          hrefForPage={(page) => {
            const query = new URLSearchParams({ page: String(page) });
            if (from) query.set("from", from);
            if (to) query.set("to", to);
            return `/dashboard/relatorios?${query.toString()}`;
          }}
        />
      </div>
    </Card>
  );
}
