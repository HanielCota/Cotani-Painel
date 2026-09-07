"use client";

import { CalendarIcon, CalendarPlusIcon, MapPinIcon, MessageCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/lib/phone";

interface SuccessActionsProps {
  clinicName: string;
  service?: string;
  professional?: string;
  date?: string;
  time?: string;
  duration?: string;
  customer?: string;
  timeZone: string;
  phone?: string | null;
  address?: string | null;
}

export function parseLocalDateTime(date: string, time: string, timeZone: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const [year, month, day] = date.split("-").map(Number);
  if (hours > 23 || minutes > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  try {
    const dateTime = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    if (
      dateTime.getUTCFullYear() !== year
      || dateTime.getUTCMonth() !== month - 1
      || dateTime.getUTCDate() !== day
    ) return null;
    const offsetFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const parts = offsetFormatter.formatToParts(dateTime);
    const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    const offsetMatch = /GMT([+-]\d{2}):?(\d{2})/.exec(offsetPart);

    if (!offsetMatch) {
      return dateTime;
    }

    const offsetHours = Number(offsetMatch[1]);
    const offsetMinutes = Number(offsetMatch[2]) * (offsetHours < 0 ? -1 : 1);
    const offsetMs = (offsetHours * 60 + offsetMinutes) * 60 * 1000;

    return new Date(dateTime.getTime() - offsetMs);
  } catch {
    return null;
  }
}

function formatGoogleCalendarUrl(event: {
  title: string;
  start: Date;
  end: Date;
  details: string;
  location: string;
}): string {
  const formatDate = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${formatDate(event.start)}/${formatDate(event.end)}`,
    details: event.details,
    location: event.location,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function generateIcsContent(event: {
  title: string;
  start: Date;
  end: Date;
  description: string;
  location: string;
}): string {
  const formatDate = (date: Date) => `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
  const uid = `${Date.now()}-${Math.random().toString(36).slice(2)}@cotani.app`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cotani//Loja//PT",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.start)}`,
    `DTEND:${formatDate(event.end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description)}`,
    `LOCATION:${escapeIcsText(event.location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadIcs(event: {
  title: string;
  start: Date;
  end: Date;
  description: string;
  location: string;
}) {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `agendamento-${event.title.replace(/\s+/g, "-").toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function SuccessActions({
  clinicName,
  service,
  professional,
  date,
  time,
  duration,
  customer,
  timeZone,
  phone,
  address,
}: SuccessActionsProps) {
  const eventStart = date && time ? parseLocalDateTime(date, time, timeZone) : null;
  const parsedDuration = Number(duration);
  const durationMinutes = Number.isInteger(parsedDuration) && parsedDuration > 0 && parsedDuration <= 24 * 60 ? parsedDuration : 60;
  const eventEnd = eventStart ? new Date(eventStart.getTime() + durationMinutes * 60 * 1000) : null;
  const displayDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join("/") : date;

  const eventTitle = service ? `Atendimento: ${service}` : "Agendamento na loja";
  const eventDetails = [
    service ? `Serviço: ${service}` : "",
    professional ? `Profissional: ${professional}` : "",
    customer ? `Cliente: ${customer}` : "",
    displayDate ? `Data: ${displayDate}` : "",
    time ? `Horário: ${time}` : "",
    "",
    `Agendamento feito em ${clinicName}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const contactMessage = `Olá! Gostaria de solicitar uma alteração ou o cancelamento deste atendimento.\n\n${eventDetails}`;
  const whatsappUrl = phone ? buildWhatsAppLink(phone, contactMessage) : null;
  const mapsUrl = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : null;

  return (
    <div className="flex w-full flex-col gap-4">
      {eventStart && eventEnd ? (
        <section className="space-y-3 rounded-xl border bg-muted/30 p-4" aria-labelledby="calendar-actions-title">
          <div>
            <h2 id="calendar-actions-title" className="font-semibold">Salvar na agenda</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Adicione o horário ao seu calendário e ative um lembrete.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full"
              onClick={() =>
                window.open(
                  formatGoogleCalendarUrl({
                    title: `${eventTitle} - ${clinicName}`,
                    start: eventStart,
                    end: eventEnd,
                    details: eventDetails,
                    location: address || clinicName,
                  }),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <CalendarPlusIcon data-icon="inline-start" />
              Google Agenda
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 w-full"
              onClick={() =>
                downloadIcs({
                  title: `${eventTitle} - ${clinicName}`,
                  start: eventStart,
                  end: eventEnd,
                  description: eventDetails,
                  location: address || clinicName,
                })
              }
            >
              <CalendarIcon data-icon="inline-start" />
              Outros calendários
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Compatível com Apple, Outlook, Samsung e outros aplicativos (.ics).</p>
        </section>
      ) : null}

      {whatsappUrl || mapsUrl ? (
        <section className="space-y-3 rounded-xl border bg-muted/30 p-4" aria-labelledby="support-actions-title">
          <div>
            <h2 id="support-actions-title" className="font-semibold">Precisa mudar algo?</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A alteração ou o cancelamento será combinado diretamente com a empresa.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {whatsappUrl ? (
              <Button nativeButton={false} render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />} variant="outline" className="h-12 w-full">
                <MessageCircleIcon data-icon="inline-start" />
                Falar pelo WhatsApp
              </Button>
            ) : null}
            {mapsUrl ? (
              <Button nativeButton={false} render={<a href={mapsUrl} target="_blank" rel="noopener noreferrer" />} variant="outline" className="h-12 w-full">
                <MapPinIcon data-icon="inline-start" />
                Como chegar
              </Button>
            ) : null}
          </div>
          {whatsappUrl ? <p className="text-xs text-muted-foreground">O pedido não altera o atendimento automaticamente.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
