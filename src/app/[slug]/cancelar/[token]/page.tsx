import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarXIcon, ClockIcon, ScissorsIcon } from "lucide-react";

import { CancelAppointmentForm } from "@/components/public/cancel-appointment-form";
import prisma from "@/lib/prisma";

interface CancelPageProps {
  params: Promise<{ slug: string; token: string }>;
}

export async function generateMetadata({ params }: CancelPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { name: true },
  });

  return { title: clinic ? `Cancelar agendamento em ${clinic.name}` : "Cancelar agendamento" };
}

export default async function CancelPage({ params }: CancelPageProps) {
  const { slug, token } = await params;

  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { id: true, name: true, timeZone: true },
  });

  if (!clinic) {
    notFound();
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      cancellationToken: token,
      clinicId: clinic.id,
    },
    include: { service: true },
  });

  if (!appointment) {
    notFound();
  }

  const isAlreadyCanceled = appointment.status === "CANCELED";
  const isPast = appointment.startTime <= new Date();
  const canCancel = !isAlreadyCanceled && !isPast;

  const dateTime = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: clinic.timeZone,
  }).format(appointment.startTime);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Cancelar agendamento</h1>
        <p className="text-muted-foreground text-sm">{clinic.name}</p>
      </div>

      <div className="rounded-lg border p-4">
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <ScissorsIcon aria-hidden="true" className="size-4" />
              Serviço
            </dt>
            <dd className="font-medium">{appointment.service.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <ClockIcon aria-hidden="true" className="size-4" />
              Data e horário
            </dt>
            <dd className="font-medium">{dateTime}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">
              {isAlreadyCanceled ? "Cancelado" : isPast ? "Expirado" : "Ativo"}
            </dd>
          </div>
        </dl>
      </div>

      {canCancel ? (
        <CancelAppointmentForm slug={slug} token={token} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-muted/30 p-8 text-center">
          <CalendarXIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">
            {isAlreadyCanceled ? "Este agendamento já foi cancelado." : "Este agendamento não pode mais ser cancelado."}
          </p>
        </div>
      )}
    </main>
  );
}
