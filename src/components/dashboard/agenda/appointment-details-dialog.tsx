"use client";

import { CalendarClockIcon, ScissorsIcon, StickyNoteIcon, UserRoundIcon, WalletIcon } from "lucide-react";

import { AppointmentActions } from "@/components/dashboard/appointment-actions";
import { EditAppointmentDialog } from "@/components/dashboard/edit-appointment-dialog";
import { RescheduleAppointmentDialog } from "@/components/dashboard/reschedule-appointment-dialog";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { isTerminalAppointmentStatus } from "@/lib/appointment-status";
import { appointmentStatusBadgeVariant, appointmentStatusLabel } from "@/lib/display-labels";
import { formatCurrency } from "@/lib/formatters";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import type { AgendaAppointment } from "@/types";

interface AppointmentDetailsDialogProps {
  appointment: AgendaAppointment | null;
  onOpenChange: (open: boolean) => void;
  timeZone: string;
  minStartTime: string;
  canSchedule: boolean;
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
}

function Row({ icon: Icon, children }: { icon: typeof UserRoundIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Detalhes de um atendimento clicado na agenda, com as mesmas ações da lista. */
export function AppointmentDetailsDialog({ appointment, onOpenChange, timeZone, minStartTime, canSchedule, customers, services }: AppointmentDetailsDialogProps) {
  if (!appointment) return null;
  const start = new Date(appointment.startTime);
  const end = new Date(appointment.endTime);
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone }).format(start);
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone });
  const editable = !isTerminalAppointmentStatus(appointment.status);
  const currentStartTime = formatClinicDateTimeInput(start, timeZone);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3 pr-6">
            <DialogTitle className="text-lg">{appointment.customerName}</DialogTitle>
            <Badge variant={appointmentStatusBadgeVariant(appointment.status)}>{appointmentStatusLabel(appointment.status)}</Badge>
          </div>
          <DialogDescription className="sr-only">Detalhes e ações do atendimento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Row icon={CalendarClockIcon}>
            <p className="font-medium first-letter:uppercase">{day}</p>
            <p className="text-muted-foreground">{time.format(start)} – {time.format(end)}</p>
          </Row>
          <Row icon={ScissorsIcon}>{appointment.serviceName}</Row>
          <Row icon={UserRoundIcon}>{appointment.professionalName ?? "Sem profissional definido"}</Row>
          {typeof appointment.totalPrice === "number" ? <Row icon={WalletIcon}>{formatCurrency(appointment.totalPrice)}</Row> : null}
          {appointment.notes ? <Row icon={StickyNoteIcon}><p className="whitespace-pre-wrap text-muted-foreground">{appointment.notes}</p></Row> : null}
        </div>

        <DialogFooter className="flex-row flex-wrap items-center justify-end gap-2 sm:justify-end">
          {editable ? (
            canSchedule
              ? <EditAppointmentDialog appointment={appointment} customers={customers} services={services} currentStartTime={currentStartTime} minStartTime={minStartTime} />
              : <RescheduleAppointmentDialog appointmentId={appointment.id} currentStartTime={currentStartTime} minStartTime={minStartTime} />
          ) : null}
          <AppointmentActions appointmentId={appointment.id} status={appointment.status} startTime={appointment.startTime} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
