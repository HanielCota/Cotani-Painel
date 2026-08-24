import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { FinanceMetrics } from "@/server/services/finance";

const priceFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  COMPLETED: "Concluído",
  CANCELED: "Cancelado",
  NO_SHOW: "Faltou",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  CONFIRMED: "default",
  COMPLETED: "outline",
  CANCELED: "destructive",
  NO_SHOW: "destructive",
};

interface FinanceAppointmentsTableProps {
  metrics: FinanceMetrics;
}

export function FinanceAppointmentsTable({ metrics }: FinanceAppointmentsTableProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Agendamentos do mês</CardTitle>
        <CardDescription>Todos os atendimentos do mês atual com status e valor.</CardDescription>
      </CardHeader>
      <CardContent>
        {metrics.monthAppointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento no mês atual.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.monthAppointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>
                      {format(new Date(appointment.startTime), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">{appointment.customerName}</TableCell>
                    <TableCell>{appointment.serviceName}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[appointment.status]}>{statusLabel[appointment.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {appointment.status === "CANCELED" || appointment.status === "NO_SHOW"
                        ? "—"
                        : priceFormatter.format(appointment.servicePrice)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
