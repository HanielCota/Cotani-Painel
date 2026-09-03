"use client";

import { CalendarIcon, CalendarPlusIcon, Share2Icon, SmartphoneIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface SuccessActionsProps {
  slug: string;
  clinicName: string;
  service?: string;
  professional?: string;
  date?: string;
  time?: string;
  customer?: string;
  timeZone: string;
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
  slug,
  clinicName,
  service,
  professional,
  date,
  time,
  customer,
  timeZone,
}: SuccessActionsProps) {
  const eventStart = date && time ? parseLocalDateTime(date, time, timeZone) : null;
  const eventEnd = eventStart && service ? new Date(eventStart.getTime() + 60 * 60 * 1000) : null;

  const eventTitle = service ? `Atendimento: ${service}` : "Agendamento na loja";
  const eventDetails = [
    service ? `Serviço: ${service}` : "",
    professional ? `Profissional: ${professional}` : "",
    customer ? `Cliente: ${customer}` : "",
    "",
    `Agendamento feito em ${clinicName}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/${slug}` : "";

  async function handleShare() {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Agendamento confirmado em ${clinicName}`,
          text: eventDetails,
          url: publicUrl,
        });
        return;
      }

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(publicUrl);
        toast.success("Link copiado para a área de transferência.");
        return;
      }

      toast.error("O compartilhamento não está disponível neste navegador.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Não foi possível compartilhar o link.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {eventStart && eventEnd ? (
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
                  location: clinicName,
                }),
                "_blank",
                "noopener,noreferrer",
              )
            }
          >
            <CalendarPlusIcon data-icon="inline-start" />
            Google Calendar
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
                location: clinicName,
              })
            }
          >
            <CalendarIcon data-icon="inline-start" />
            Adicionar ao calendário
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full"
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${eventDetails}\n\n${publicUrl}`)}`, "_blank", "noopener,noreferrer")}
        >
          <SmartphoneIcon data-icon="inline-start" />
          Enviar por WhatsApp
        </Button>
        <Button type="button" variant="outline" className="h-12 w-full" onClick={handleShare}>
          <Share2Icon data-icon="inline-start" />
          Compartilhar link
        </Button>
      </div>
    </div>
  );
}
