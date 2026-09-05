"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createManualReminder, retryNotification } from "@/server/actions/communications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/types";

const initial: ActionResult = { status: "success", message: "" };
const templates = {
  reminder: "Olá! Este é um lembrete do seu atendimento. Se precisar reagendar, fale conosco.",
  confirmation: "Olá! Seu atendimento está reservado. Por favor, confirme sua presença.",
  return: "Olá! Está chegando o momento sugerido para o seu retorno. Quer reservar um novo horário?",
};
type Message = { id:string; channel:string; status:string; content:string; recipient:string; scheduledFor:string; error:string|null };

function Retry({ id }: { id:string }) {
  const [state, action, pending] = useActionState(retryNotification, initial);
  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") toast.success(state.message);
    else toast.error(state.message);
  }, [state]);
  return <form action={action}><input type="hidden" name="id" value={id}/><Button type="submit" size="sm" variant="outline" disabled={pending}>Tentar novamente</Button></form>;
}

export function MessageCenter({ appointments, messages, timeZone, automaticMode }: { appointments:Array<{id:string;label:string}>; messages:Message[]; timeZone:string; automaticMode:boolean }) {
  const [state, action, pending] = useActionState(createManualReminder, initial);
  const [status, setStatus] = useState("ALL");
  const [channel, setChannel] = useState("ALL");
  const [search, setSearch] = useState("");
  const [content, setContent] = useState(templates.reminder);
  useEffect(() => {
    if (!state.message) return;
    if (state.status === "success") toast.success(state.message);
    else toast.error(state.message);
  }, [state]);
  const visible = useMemo(() => messages.filter(item => (status === "ALL" || item.status === status) && (channel === "ALL" || item.channel === channel) && `${item.recipient} ${item.content}`.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))), [messages, status, channel, search]);
  return <section className="space-y-5">
    <form action={action} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="font-semibold">Novo lembrete</h2><p className="text-xs text-muted-foreground">Horários no fuso {timeZone}. Modelos podem ser ajustados antes do envio.</p></div>
      <div><Label>Atendimento</Label><NativeSelect name="appointmentId" required><NativeSelectOption value="">Selecione</NativeSelectOption>{appointments.map(item=><NativeSelectOption key={item.id} value={item.id}>{item.label}</NativeSelectOption>)}</NativeSelect></div>
      <div><Label>Canal</Label><NativeSelect name="channel" defaultValue="EMAIL"><NativeSelectOption value="EMAIL">E-mail automático</NativeSelectOption>{automaticMode ? <NativeSelectOption value="WHATSAPP">WhatsApp automático</NativeSelectOption> : null}</NativeSelect></div>
      <div><Label>Enviar em</Label><Input name="scheduledFor" type="datetime-local" required/></div>
      <div><Label>Modelo</Label><NativeSelect defaultValue="reminder" onChange={event => setContent(templates[event.target.value as keyof typeof templates])}><NativeSelectOption value="reminder">Lembrete</NativeSelectOption><NativeSelectOption value="confirmation">Confirmação</NativeSelectOption><NativeSelectOption value="return">Retorno</NativeSelectOption></NativeSelect></div>
      <div className="md:col-span-2"><Label>Mensagem</Label><Textarea name="content" value={content} onChange={event=>setContent(event.target.value)} required maxLength={1000}/></div>
      <Button type="submit" disabled={pending}>{pending ? "Programando..." : "Programar lembrete"}</Button>
    </form>
    <div className="grid gap-2 sm:grid-cols-3"><Input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Buscar mensagem ou contato" aria-label="Buscar mensagens"/><NativeSelect aria-label="Filtrar por status" value={status} onChange={event=>setStatus(event.target.value)}><NativeSelectOption value="ALL">Todos os status</NativeSelectOption><NativeSelectOption value="PENDING">Programados</NativeSelectOption><NativeSelectOption value="SENT">Enviados</NativeSelectOption><NativeSelectOption value="FAILED">Falharam</NativeSelectOption><NativeSelectOption value="CANCELED">Cancelados</NativeSelectOption></NativeSelect><NativeSelect aria-label="Filtrar por canal" value={channel} onChange={event=>setChannel(event.target.value)}><NativeSelectOption value="ALL">Todos os canais</NativeSelectOption><NativeSelectOption value="EMAIL">E-mail</NativeSelectOption><NativeSelectOption value="WHATSAPP">WhatsApp</NativeSelectOption></NativeSelect></div>
    <div className="divide-y rounded-xl border">{visible.length ? visible.map(item=><div key={item.id} className="grid gap-2 p-4 text-sm md:grid-cols-[8rem_1fr_8rem]"><div><strong>{item.channel === "EMAIL" ? "E-mail" : "WhatsApp"}</strong><p>{item.status}</p></div><div><p>{item.content}</p><p className="text-xs text-muted-foreground">{item.recipient} · {new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeStyle:"short"}).format(new Date(item.scheduledFor))}</p>{item.error?<p className="text-xs text-destructive">{item.error}</p>:null}</div>{item.status === "FAILED" ? <Retry id={item.id}/> : null}</div>) : <p className="p-8 text-center text-sm text-muted-foreground">Nenhuma mensagem corresponde aos filtros.</p>}</div>
  </section>;
}
