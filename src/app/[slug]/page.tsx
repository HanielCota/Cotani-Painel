import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicUnavailable } from "@/components/public/clinic-unavailable";
import { BookingSteps } from "@/components/public/booking-steps";
import { isSubscriptionActive } from "@/server/subscription";
import prisma from "@/lib/prisma";
import { formatClinicDateTimeInput } from "@/lib/timezone";
import { getPublicBookingUrl } from "@/lib/url";

interface PublicBookingPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PublicBookingPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await prisma.clinic.findUnique({
    where: { slug, deletedAt: null },
    select: { name: true },
  });

  if (!clinic) {
    return { title: "Agendamento" };
  }

  const title = `Agendar em ${clinic.name}`;
  const description = `Agende seu horário na ${clinic.name} de forma rápida e fácil. Escolha o serviço, o profissional e o melhor dia e horário para você.`;
  const url = await getPublicBookingUrl(slug);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      locale: "pt_BR",
      siteName: clinic.name,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
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
      trialEndsAt: true,
      operationalStatus: true,
      deletedAt: true,
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

  if (clinic.operationalStatus !== "ACTIVE" || clinic.deletedAt || !isSubscriptionActive(clinic)) {
    return <ClinicUnavailable clinicName={clinic.name} />;
  }

  return (
    <main className="relative mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 overflow-x-hidden px-4 py-8 sm:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,oklch(0.91_0.08_165_/_0.45),transparent_68%)]" />
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Agendamento on-line</span>
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
