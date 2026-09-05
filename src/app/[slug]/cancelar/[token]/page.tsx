import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarXIcon, ClockIcon, TagIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

import { CancelAppointmentError } from "@/components/public/cancel-appointment-error";
import { CancelAppointmentForm } from "@/components/public/cancel-appointment-form";
import prisma from "@/lib/prisma";

interface CancelPageProps {
  params: Promise<{ slug: string; token: string }>;
}

export async function generateMetadata({ params }: CancelPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await prisma.clinic.findFirst({
    where: { OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    select: { name: true },
  });

  return { title: clinic ? `Cancelar agendamento em ${clinic.name}` : "Cancelar agendamento" };
}

export default async function CancelPage({ params }: CancelPageProps) {
  const { slug, token } = await params;

  const clinic = await prisma.clinic.findFirst({
    where: { OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    select: { id: true, name: true, timeZone: true, slug: true },
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
    <main id="main-content" tabIndex={-1} className="relative mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 overflow-x-hidden px-4 py-8 outline-none sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,oklch(0.91_0.08_165_/_0.45),transparent_68%)]" />
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"><CalendarXIcon className="size-6" /></span>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Cancelar agendamento</h1>
        <p className="text-sm text-muted-foreground">{clinic.name}</p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <TagIcon aria-hidden="true" className="size-4 shrink-0" />
              Serviço
            </dt>
            <dd className="min-w-0 truncate text-right font-medium">{appointment.service.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <ClockIcon aria-hidden="true" className="size-4 shrink-0" />
              Data e horário
            </dt>
            <dd className="min-w-0 truncate text-right font-medium">{dateTime}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="min-w-0 truncate text-right font-medium">
              {isAlreadyCanceled ? "Cancelado" : isPast ? "Expirado" : "Ativo"}
            </dd>
          </div>
        </dl>
      </div>

      {canCancel ? (
        <div className="flex flex-col gap-3"><Button nativeButton={false} render={<Link href={`/${clinic.slug}/reagendar/${token}`} />}>Prefiro reagendar</Button><CancelAppointmentForm slug={clinic.slug} token={token} /></div>
      ) : (
        <CancelAppointmentError
          clinicName={clinic.name}
          clinicSlug={clinic.slug}
          variant={isAlreadyCanceled ? "already-canceled" : "expired"}
        />
      )}
    </main>
  );
}
