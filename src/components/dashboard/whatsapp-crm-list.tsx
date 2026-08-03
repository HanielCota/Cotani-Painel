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
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={kindVariant[notification.kind] ?? "secondary"}>{kindLabels[notification.kind] ?? notification.kind}</Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(notification.scheduledFor), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </span>
          </div>
          {isSent ? (
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <CheckIcon className="size-3.5" />
              Enviado
            </div>
          ) : null}
        </div>
        <p className="text-sm font-medium text-foreground">{notification.recipient}</p>
      </div>

      <div className="rounded-lg bg-muted/50 p-3">
        <p className="whitespace-pre-wrap text-sm text-muted-foreground line-clamp-4">{notification.content}</p>
      </div>

      {notification.whatsappLink === null ? (
        <p className="text-xs text-destructive">Número inválido para WhatsApp.</p>
      ) : null}

      {!isSent ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="sm"
            variant="outline"
            disabled={notification.whatsappLink === null || isPending}
            onClick={handleOpenLink}
            className="w-full sm:w-auto"
          >
            <ExternalLinkIcon data-icon="inline-start" className="size-3.5" />
            Abrir WhatsApp
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={handleMarkSent}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          >
            {isPending ? <Spinner data-icon="inline-start" /> : <CheckIcon data-icon="inline-start" className="size-3.5" />}
            Marcar enviado
          </Button>
        </div>
      ) : null}

      {result?.message ? (
        <Alert variant={result.status === "error" ? "destructive" : "default"} className="py-1.5">
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : null}
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
              <CheckIcon className="size-5 text-primary" />
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
