"use client";

import { useActionState, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PencilIcon } from "lucide-react";
import { toast } from "sonner";

import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import { CustomerCombobox } from "@/components/dashboard/customer-combobox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import { updateAppointmentFromForm } from "@/server/actions/appointments";
import type { ActionResult, AgendaAppointment, ProfessionalListItem } from "@/types";

const initial: ActionResult = { status: "success", message: "" };

interface Props {
  appointment: AgendaAppointment;
  customers: Array<{ id: string; name: string }>;
  services: Array<{ id: string; name: string; duration: number }>;
  currentStartTime: string;
  minStartTime: string;
}

export function EditAppointmentDialog({
  appointment,
  customers,
  services,
  currentStartTime,
  minStartTime,
}: Props) {
  const [open, setOpen] = useState(false);
  const [serviceId, setServiceId] = useState(appointment.serviceId ?? "");
  const [state, action, pending] = useActionState(updateAppointmentFromForm, initial);
  const queryClient = useQueryClient();
  const clinicId = useActiveClinicId();
  const formId = `edit-appointment-${appointment.id}`;
  const fieldId = (name: string) => `${formId}-${name}`;

  const { data: professionals = [] } = useQuery({
    queryKey: ["professionals", clinicId],
    queryFn: () => fetchJson<ProfessionalListItem[]>("/api/professionals"),
  });
  const available = professionals.filter(
    (item) => item.isActive && item.serviceIds.includes(serviceId),
  );

  useEffect(() => {
    if (!state.message) return;
    if (state.status === "error") {
      toast.error(state.message);
      return;
    }
    toast.success(state.message);
    void queryClient.invalidateQueries({ queryKey: ["appointments"] });
    queueMicrotask(() => setOpen(false));
  }, [state, queryClient]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" size="sm" variant="outline" />}>
        <PencilIcon />
        Editar
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar ou reagendar atendimento</DialogTitle>
          <DialogDescription>
            Atualize os dados do atendimento ou escolha uma nova data e horário para reagendar.
          </DialogDescription>
        </DialogHeader>
        <form id={formId} action={action} className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("customer")}>Cliente</Label>
            <CustomerCombobox
              id={fieldId("customer")}
              customers={customers}
              defaultCustomerId={appointment.customerId ?? ""}
              disabled={pending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("service")}>Serviço</Label>
            <Select name="serviceId" value={serviceId} onValueChange={(value) => setServiceId(value == null ? "" : String(value))} items={services.map((item) => ({ value: item.id, label: item.name }))}>
              <SelectTrigger id={fieldId("service")} className="overflow-hidden"><SelectValue className="min-w-0 flex-1 truncate text-left" /></SelectTrigger>
              <SelectContent>{services.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("professional")}>Profissional</Label>
            <Select name="professionalId" defaultValue={appointment.professionalId ?? null} items={[{ value: null, label: "Sem profissional específico" }, ...available.map((item) => ({ value: item.id, label: item.name }))]}>
              <SelectTrigger id={fieldId("professional")} className="overflow-hidden"><SelectValue className="min-w-0 flex-1 truncate text-left" /></SelectTrigger>
              <SelectContent><SelectItem value={null}>Sem profissional específico</SelectItem>{available.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("startTime")}>Data e horário</Label>
            <Input id={fieldId("startTime")} name="startTime" type="datetime-local" defaultValue={currentStartTime} min={minStartTime} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={fieldId("totalPrice")}>Valor final</Label>
            <Input id={fieldId("totalPrice")} name="totalPrice" type="number" min="0" step="0.01" defaultValue={appointment.totalPrice ?? 0} required />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={fieldId("notes")}>Observações</Label>
            <Textarea id={fieldId("notes")} name="notes" defaultValue={appointment.notes ?? ""} maxLength={2000} className="min-h-24" />
          </div>
        </form>
        <DialogFooter className="mt-1">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">Fechar sem salvar</Button>
          <Button type="submit" form={formId} disabled={pending} className="w-full sm:w-auto">{pending ? "Salvando..." : "Salvar alterações"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
