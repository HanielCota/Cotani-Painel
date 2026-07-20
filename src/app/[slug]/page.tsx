import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicUnavailable } from "@/components/public/clinic-unavailable";
import { PublicBookingForm } from "@/components/public/public-booking-form";
import { isSubscriptionActive } from "@/server/subscription";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput } from "@/lib/timezone";

interface PublicBookingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PublicBookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await prisma.clinic.findUnique({
    where: { slug, deletedAt: null },
    select: { name: true },
  });

  return { title: clinic ? `Agendar em ${clinic.name}` : "Agendamento" };
}

export default async function PublicBookingPage({ params }: PublicBookingPageProps) {
  const { slug } = await params;
  const clinic = await prisma.clinic.findUnique({
    where: { slug, deletedAt: null },
    select: {
      name: true,
      slug: true,
      timeZone: true,
      subscriptionStatus: true,
      services: {
        where: { isActive: true },
        select: { id: true, name: true, duration: true, price: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!clinic) {
    notFound();
  }

  if (!isSubscriptionActive(clinic)) {
    return <ClinicUnavailable clinicName={clinic.name} />;
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:py-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{clinic.name}</h1>
        <p className="text-muted-foreground text-sm">Agende seu atendimento em poucos passos. Os horários são exibidos no fuso {clinic.timeZone}.</p>
      </header>
      <PublicBookingForm
        slug={slug}
        clinicName={clinic.name}
        timeZone={clinic.timeZone}
        minDate={formatClinicDateTimeInput(new Date(), clinic.timeZone).slice(0, 10)}
        services={clinic.services.map((service) => ({
          id: service.id,
          name: service.name,
          duration: service.duration,
          price: Number(service.price),
        }))}
      />
    </main>
  );
}
