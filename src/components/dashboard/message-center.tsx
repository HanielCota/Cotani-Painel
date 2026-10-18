"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createManualReminder,
  retryNotification,
} from "@/server/actions/communications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { Textarea } from "@/components/ui/textarea";
import { usePagination } from "@/hooks/use-pagination";
import type { ActionResult } from "@/types";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { formatDateTime } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { readUrlSearchParam, replaceUrlSearchParams } from "@/lib/browser-url";

const initial: ActionResult = { status: "success", message: "" };
const templates = {
  reminder:
    "Olá, este é um lembrete do seu atendimento. Se precisar reagendar, fale conosco.",
  confirmation:
    "Olá, seu atendimento está reservado. Por favor, confirme sua presença.",
  return:
    "Olá, está chegando o momento sugerido para o seu retorno. Quer reservar um novo horário?",
};
type Message = {
  id: string;
  channel: string;
  status: string;
  content: string;
  recipient: string;
  scheduledFor: string;
  error: string | null;
};
const statusLabels: Record<string, string> = {
  PENDING: "Programado",
  SENT: "Enviado",
  FAILED: "Falhou",
  CANCELED: "Cancelado",
};

function Retry({ id }: { id: string }) {
  const [state, action, pending] = useActionState(retryNotification, initial);
  useActionFeedback(state);
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Tentar novamente
      </Button>
    </form>
  );
}

export function MessageCenter({
  appointments,
  messages,
  timeZone,
  automaticMode,
}: {
  appointments: Array<{ id: string; label: string }>;
  messages: Message[];
  timeZone: string;
  automaticMode: boolean;
}) {
  const [state, action, pending] = useActionState(
    createManualReminder,
    initial,
  );
  const [status, setStatus] = useState(() => readUrlSearchParam("status", "ALL"));
  const [channel, setChannel] = useState(() => readUrlSearchParam("canal", "ALL"));
  const [search, setSearch] = useState(() => readUrlSearchParam("busca"));
  const [content, setContent] = useState(templates.reminder);
  useActionFeedback(state);
  const visible = useMemo(
    () =>
      messages.filter(
        (item) =>
          (status === "ALL" || item.status === status) &&
          (channel === "ALL" || item.channel === channel) &&
          `${item.recipient} ${item.content}`
            .toLocaleLowerCase("pt-BR")
            .includes(search.toLocaleLowerCase("pt-BR")),
      ),
    [messages, status, channel, search],
  );
  const pagination = usePagination(visible);
  return (
    <section className="space-y-5">
      <Card className="py-0">
      <CardContent className="p-5">
      <form action={action} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <h2 className="font-semibold">Novo lembrete</h2>
          <p className="text-xs text-muted-foreground">
            Horários exibidos no horário local do negócio. Modelos podem ser
            ajustados antes do envio.
          </p>
        </div>
        <div>
          <Label htmlFor="reminder-appointment">Atendimento</Label>
          <Select
            name="appointmentId"
            required
            items={appointments.map((item) => ({
              value: item.id,
              label: item.label,
            }))}
          >
            <SelectTrigger id="reminder-appointment">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {appointments.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="reminder-channel">Canal</Label>
          <Select
            name="channel"
            defaultValue="EMAIL"
            items={
              automaticMode
                ? {
                    EMAIL: "E-mail automático",
                    WHATSAPP: "WhatsApp automático",
                  }
                : { EMAIL: "E-mail automático" }
            }
          >
            <SelectTrigger id="reminder-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EMAIL">E-mail automático</SelectItem>
              {automaticMode ? (
                <SelectItem value="WHATSAPP">WhatsApp automático</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="reminder-scheduled-for">Enviar em</Label>
          <Input id="reminder-scheduled-for" name="scheduledFor" type="datetime-local" required />
        </div>
        <div>
          <Label htmlFor="reminder-template">Modelo</Label>
          <Select
            defaultValue="reminder"
            items={{
              reminder: "Lembrete",
              confirmation: "Confirmação",
              return: "Retorno",
            }}
            onValueChange={(value) =>
              value != null &&
              setContent(templates[String(value) as keyof typeof templates])
            }
          >
            <SelectTrigger id="reminder-template">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reminder">Lembrete</SelectItem>
              <SelectItem value="confirmation">Confirmação</SelectItem>
              <SelectItem value="return">Retorno</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="reminder-content">Mensagem</Label>
          <Textarea
            id="reminder-content"
            name="content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            required
            maxLength={1000}
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Programando..." : "Programar lembrete"}
          </Button>
        </div>
      </form>
      </CardContent>
      </Card>
      <div className="grid gap-2 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            replaceUrlSearchParams({ busca: event.target.value || null });
            pagination.resetPage();
          }}
          placeholder="Buscar mensagem ou contato"
          aria-label="Buscar mensagens"
        />
        <Select
          aria-label="Filtrar por status"
          value={status}
          items={{
            ALL: "Todos os status",
            PENDING: "Programados",
            SENT: "Enviados",
            FAILED: "Falharam",
            CANCELED: "Cancelados",
          }}
          onValueChange={(value) => {
            if (value != null) {
              setStatus(String(value));
              replaceUrlSearchParams({ status: String(value) === "ALL" ? null : String(value) });
            }
            pagination.resetPage();
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os status</SelectItem>
            <SelectItem value="PENDING">Programados</SelectItem>
            <SelectItem value="SENT">Enviados</SelectItem>
            <SelectItem value="FAILED">Falharam</SelectItem>
            <SelectItem value="CANCELED">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select
          aria-label="Filtrar por canal"
          value={channel}
          items={{
            ALL: "Todos os canais",
            EMAIL: "E-mail",
            WHATSAPP: "WhatsApp",
          }}
          onValueChange={(value) => {
            if (value != null) {
              setChannel(String(value));
              replaceUrlSearchParams({ canal: String(value) === "ALL" ? null : String(value) });
            }
            pagination.resetPage();
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos os canais</SelectItem>
            <SelectItem value="EMAIL">E-mail</SelectItem>
            <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card className="gap-0 py-0">
        <CardContent className="px-0">
        <div className="divide-y">
          {visible.length ? (
            pagination.pageItems.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 p-4 text-sm transition-colors hover:bg-muted/30 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-start"
              >
                <div>
                  <strong>
                    {item.channel === "EMAIL" ? "E-mail" : "WhatsApp"}
                  </strong>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {statusLabels[item.status] ?? item.status}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="leading-5">{item.content}</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">
                    {item.recipient} ·{" "}
                    {formatDateTime(item.scheduledFor, timeZone)}
                  </p>
                  {item.error ? (
                    <p className="mt-1 text-xs text-destructive">
                      {item.error}
                    </p>
                  ) : null}
                </div>
                {item.status === "FAILED" ? <Retry id={item.id} /> : null}
              </div>
            ))
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma mensagem corresponde aos filtros.
            </p>
          )}
        </div>
        </CardContent>
        <div className="px-4 pb-4">
          <PaginationControls
            page={pagination.page}
            pageCount={pagination.pageCount}
            totalItems={visible.length}
            onPageChange={pagination.setPage}
            itemLabelPlural="mensagens"
          />
        </div>
      </Card>
    </section>
  );
}
