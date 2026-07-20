import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicUnavailable } from "@/components/public/clinic-unavailable";
import { BookingSteps } from "@/components/public/booking-steps";
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
        select: { id: true, name: true, duration: true, price: true, imageUrl: true },
        orderBy: { name: "asc" },
      },
      professionals: {
        where: { isActive: true },
        select: { id: true, name: true, imageUrl: true, services: { select: { serviceId: true } } },
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
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 bg-background px-4 py-8 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{clinic.name}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Agende seu atendimento em poucos passos. Horários exibidos no fuso {clinic.timeZone}.
        </p>
      </header>
      <BookingSteps
        slug={slug}
        clinicName={clinic.name}
        minDate={formatClinicDateTimeInput(new Date(), clinic.timeZone).slice(0, 10)}
        services={clinic.services.map((service) => ({
          id: service.id,
          name: service.name,
          duration: service.duration,
          price: Number(service.price),
          imageUrl: service.imageUrl,
        }))}
        professionals={clinic.professionals.map((professional) => ({
          id: professional.id,
          name: professional.name,
          imageUrl: professional.imageUrl,
          serviceIds: professional.services.map((relation) => relation.serviceId),
        }))}
      />
    </main>
  );
}
