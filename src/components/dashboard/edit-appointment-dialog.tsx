"use client";

import { useActionState, useEffect, useState } from "react";
import { PencilIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { updateAppointmentFromForm } from "@/server/actions/appointments";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { fetchJson } from "@/lib/fetch-json";
import { useActiveClinicId } from "@/components/dashboard/active-clinic-context";
import type { ActionResult, AgendaAppointment, ProfessionalListItem } from "@/types";

const initial: ActionResult = { status: "success", message: "" };
interface Props { appointment: AgendaAppointment; customers: Array<{id:string;name:string}>; services: Array<{id:string;name:string;duration:number}>; currentStartTime: string; minStartTime: string }
export function EditAppointmentDialog({ appointment, customers, services, currentStartTime, minStartTime }: Props) {
  const [open, setOpen] = useState(false); const [serviceId, setServiceId] = useState(appointment.serviceId ?? ""); const [state, action, pending] = useActionState(updateAppointmentFromForm, initial); const queryClient = useQueryClient(); const clinicId = useActiveClinicId();
  const { data: professionals=[] } = useQuery({ queryKey: ["professionals", clinicId], queryFn: () => fetchJson<ProfessionalListItem[]>("/api/professionals") });
  const available = professionals.filter((item) => item.isActive && item.serviceIds.includes(serviceId));
  useEffect(() => { if (!state.message) return; if (state.status === "error") toast.error(state.message); else { toast.success(state.message); void queryClient.invalidateQueries({ queryKey: ["appointments"] }); queueMicrotask(() => setOpen(false)); } }, [state, queryClient]);
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger render={<Button type="button" size="sm" variant="outline" />}><PencilIcon />Editar</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Editar atendimento</DialogTitle><DialogDescription>Altere cliente, serviço, profissional, valor, horário ou observações.</DialogDescription></DialogHeader><form id={`edit-appointment-${appointment.id}`} action={action} className="grid gap-4 sm:grid-cols-2"><input type="hidden" name="appointmentId" value={appointment.id} />
    <div className="space-y-1.5"><Label>Cliente</Label><NativeSelect name="customerId" defaultValue={appointment.customerId ?? ""}>{customers.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></div>
    <div className="space-y-1.5"><Label>Serviço</Label><NativeSelect name="serviceId" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>{services.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></div>
    <div className="space-y-1.5"><Label>Profissional</Label><NativeSelect name="professionalId" defaultValue={appointment.professionalId ?? ""}><NativeSelectOption value="">Sem profissional específico</NativeSelectOption>{available.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></div>
    <div className="space-y-1.5"><Label>Data e horário</Label><Input name="startTime" type="datetime-local" defaultValue={currentStartTime} min={minStartTime} required /></div>
    <div className="space-y-1.5"><Label>Valor final</Label><Input name="totalPrice" type="number" min="0" step="0.01" defaultValue={appointment.totalPrice ?? 0} required /></div>
    <div className="space-y-1.5 sm:col-span-2"><Label>Observações</Label><Textarea name="notes" defaultValue={appointment.notes ?? ""} maxLength={2000} /></div>
  </form><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form={`edit-appointment-${appointment.id}`} disabled={pending}>{pending ? "Salvando..." : "Salvar alterações"}</Button></DialogFooter></DialogContent></Dialog>;
}
