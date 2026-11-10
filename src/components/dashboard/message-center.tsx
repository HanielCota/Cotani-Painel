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

type AppointmentOption = { id: string; label: string };

type MessageFilterValues = {
  status: string;
  channel: string;
  search: string;
};

function matchesMessageFilters(message: Message, filters: MessageFilterValues) {
  const matchesStatus = filters.status === "ALL" || message.status === filters.status;
  const matchesChannel = filters.channel === "ALL" || message.channel === filters.channel;
  const matchesSearch = `${message.recipient} ${message.content}`
    .toLocaleLowerCase("pt-BR")
    .includes(filters.search.toLocaleLowerCase("pt-BR"));

  return matchesStatus && matchesChannel && matchesSearch;
}

function urlFilterValue(value: string) {
  return value === "ALL" ? null : value;
}

function useMessageFilters(messages: Message[]) {
  const [status, setStatus] = useState(() => readUrlSearchParam("status", "ALL"));
  const [channel, setChannel] = useState(() => readUrlSearchParam("canal", "ALL"));
  const [search, setSearch] = useState(() => readUrlSearchParam("busca"));
  const visible = useMemo(
    () => messages.filter((item) => matchesMessageFilters(item, { status, channel, search })),
    [messages, status, channel, search],
  );
  const pagination = usePagination(visible);

  function changeSearch(value: string) {
    setSearch(value);
    replaceUrlSearchParams({ busca: value || null });
    pagination.resetPage();
  }

  function changeStatus(value: unknown) {
    if (value != null) {
      setStatus(String(value));
      replaceUrlSearchParams({ status: urlFilterValue(String(value)) });
    }
    pagination.resetPage();
  }

  function changeChannel(value: unknown) {
    if (value != null) {
      setChannel(String(value));
      replaceUrlSearchParams({ canal: urlFilterValue(String(value)) });
    }
    pagination.resetPage();
  }

  return { status, channel, search, visible, pagination, changeSearch, changeStatus, changeChannel };
}

type MessageFilters = ReturnType<typeof useMessageFilters>;

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
  appointments: AppointmentOption[];
  messages: Message[];
  timeZone: string;
  automaticMode: boolean;
}) {
  const filters = useMessageFilters(messages);

  return (
    <section className="space-y-5">
      <ReminderForm appointments={appointments} automaticMode={automaticMode} />
      <MessageFiltersBar filters={filters} />
      <MessageList filters={filters} timeZone={timeZone} />
    </section>
  );
}

function ReminderForm({
  appointments,
  automaticMode,
}: {
  appointments: AppointmentOption[];
  automaticMode: boolean;
}) {
  const [state, action, pending] = useActionState(
    createManualReminder,
    initial,
  );
  const [content, setContent] = useState(templates.reminder);
  useActionFeedback(state);

  return (
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
          <AppointmentField appointments={appointments} />
          <ChannelField automaticMode={automaticMode} />
          <div>
            <Label htmlFor="reminder-scheduled-for">Enviar em</Label>
            <Input id="reminder-scheduled-for" name="scheduledFor" type="datetime-local" required />
          </div>
          <TemplateField onTemplateChange={setContent} />
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
  );
}

function AppointmentField({ appointments }: { appointments: AppointmentOption[] }) {
  return (
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
  );
}

function ChannelField({ automaticMode }: { automaticMode: boolean }) {
  return (
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
  );
}

function TemplateField({ onTemplateChange }: { onTemplateChange: (content: string) => void }) {
  function changeTemplate(value: unknown) {
    if (value == null) return;

    onTemplateChange(templates[String(value) as keyof typeof templates]);
  }

  return (
    <div>
      <Label htmlFor="reminder-template">Modelo</Label>
      <Select
        defaultValue="reminder"
        items={{
          reminder: "Lembrete",
          confirmation: "Confirmação",
          return: "Retorno",
        }}
        onValueChange={changeTemplate}
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
  );
}

function MessageFiltersBar({ filters }: { filters: MessageFilters }) {
  return (
    <div className="grid gap-2 md:grid-cols-[minmax(16rem,1fr)_12rem_12rem]">
      <Input
        value={filters.search}
        onChange={(event) => filters.changeSearch(event.target.value)}
        placeholder="Buscar mensagem ou contato"
        aria-label="Buscar mensagens"
      />
      <StatusFilterSelect value={filters.status} onValueChange={filters.changeStatus} />
      <ChannelFilterSelect value={filters.channel} onValueChange={filters.changeChannel} />
    </div>
  );
}

type FilterSelectProps = {
  value: string;
  onValueChange: (value: unknown) => void;
};

function StatusFilterSelect({ value, onValueChange }: FilterSelectProps) {
  return (
    <Select
      aria-label="Filtrar por status"
      value={value}
      items={{
        ALL: "Todos os status",
        PENDING: "Programados",
        SENT: "Enviados",
        FAILED: "Falharam",
        CANCELED: "Cancelados",
      }}
      onValueChange={onValueChange}
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
  );
}

function ChannelFilterSelect({ value, onValueChange }: FilterSelectProps) {
  return (
    <Select
      aria-label="Filtrar por canal"
      value={value}
      items={{
        ALL: "Todos os canais",
        EMAIL: "E-mail",
        WHATSAPP: "WhatsApp",
      }}
      onValueChange={onValueChange}
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
  );
}

function MessageList({ filters, timeZone }: { filters: MessageFilters; timeZone: string }) {
  const { visible, pagination } = filters;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <div className="divide-y">
          {visible.length ? (
            pagination.pageItems.map((item) => (
              <MessageRow key={item.id} message={item} timeZone={timeZone} />
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
  );
}

function MessageRow({ message, timeZone }: { message: Message; timeZone: string }) {
  return (
    <div className="grid gap-3 p-4 text-sm transition-colors hover:bg-muted/30 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:items-start">
      <div>
        <strong>
          {message.channel === "EMAIL" ? "E-mail" : "WhatsApp"}
        </strong>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {statusLabels[message.status] ?? message.status}
        </p>
      </div>
      <div className="min-w-0">
        <p className="leading-5">{message.content}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">
          {message.recipient} ·{" "}
          {formatDateTime(message.scheduledFor, timeZone)}
        </p>
        {message.error ? (
          <p className="mt-1 text-xs text-destructive">
            {message.error}
          </p>
        ) : null}
      </div>
      {message.status === "FAILED" ? <Retry id={message.id} /> : null}
    </div>
  );
}
