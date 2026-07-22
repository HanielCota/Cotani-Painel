"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckIcon, ExternalLinkIcon, MessageCircleIcon, MessageSquareIcon } from "lucide-react";

import { markWhatsAppNotificationAsSent } from "@/server/actions/whatsapp-crm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { WhatsAppNotificationItem } from "@/server/services/whatsapp-crm";
import type { ActionResult } from "@/types";

interface WhatsAppCrmListProps {
  pending: WhatsAppNotificationItem[];
  sent: WhatsAppNotificationItem[];
}

const kindLabels: Record<string, string> = {
  CONFIRMATION: "Confirmação",
  REMINDER_24H: "Lembrete 24h",
  REMINDER_2H: "Lembrete 2h",
};

const kindVariant: Record<string, "default" | "secondary" | "outline"> = {
  CONFIRMATION: "default",
  REMINDER_24H: "secondary",
  REMINDER_2H: "outline",
};

function NotificationCard({
  notification,
  isSent,
  onMarkSent,
}: {
  notification: WhatsAppNotificationItem;
  isSent: boolean;
  onMarkSent?: (id: string) => void;
}) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpenLink() {
    if (!notification.whatsappLink) return;
    window.open(notification.whatsappLink, "_blank", "noopener,noreferrer");
  }

  function handleMarkSent() {
    if (!onMarkSent) return;

    startTransition(async () => {
      const nextResult = await markWhatsAppNotificationAsSent(notification.id);
      setResult(nextResult);

      if (nextResult.status === "success") {
        onMarkSent(notification.id);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#F3F4F6] bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={kindVariant[notification.kind] ?? "secondary"}>{kindLabels[notification.kind] ?? notification.kind}</Badge>
          <span className="text-xs text-gray-500">
            {format(new Date(notification.scheduledFor), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </span>
        </div>
        <p className="mt-1 truncate text-sm font-medium text-gray-900">{notification.recipient}</p>
        <p className="text-sm text-gray-600 line-clamp-2">{notification.content}</p>
        {notification.whatsappLink === null ? (
          <p className="mt-1 text-xs text-red-500">Número inválido para WhatsApp.</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:items-end">
        {isSent ? (
          <div className="flex items-center gap-1.5 text-xs font-medium text-lime-600">
            <CheckIcon className="size-3.5" />
            Enviado
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={notification.whatsappLink === null || isPending}
              onClick={handleOpenLink}
            >
              <ExternalLinkIcon data-icon="inline-start" className="size-3.5" />
              Abrir WhatsApp
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleMarkSent}
              className="bg-[#82D951] text-white hover:bg-[#75c448]"
            >
              {isPending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" className="size-3.5" />}
              Marcar enviado
            </Button>
          </div>
        )}
        {result?.message ? (
          <Alert variant={result.status === "error" ? "destructive" : "default"} className="max-w-xs py-1.5">
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </div>
  );
}

export function WhatsAppCrmList({ pending, sent }: WhatsAppCrmListProps) {
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  function handleMarkSent(id: string) {
    setSentIds((previous) => new Set(previous).add(id));
  }

  const visiblePending = pending.filter((notification) => !sentIds.has(notification.id));
  const visibleSent = sent.filter((notification) => !sentIds.has(notification.id));

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-border/80 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircleIcon className="size-5 text-primary" />
            Mensagens pendentes
          </CardTitle>
          <CardDescription>
            Clique em Abrir WhatsApp para enviar a mensagem manualmente, depois marque como enviada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {visiblePending.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/30 py-10 text-center">
              <MessageSquareIcon className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhuma mensagem pendente no momento.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visiblePending.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  isSent={false}
                  onMarkSent={handleMarkSent}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {visibleSent.length > 0 ? (
        <Card className="border border-border/80 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckIcon className="size-5 text-lime-600" />
              Últimas enviadas
            </CardTitle>
            <CardDescription>Histórico das últimas mensagens enviadas manualmente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {visibleSent.map((notification) => (
                <NotificationCard key={notification.id} notification={notification} isSent />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
