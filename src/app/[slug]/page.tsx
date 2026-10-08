import { MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClinicUnavailable } from "@/components/public/clinic-unavailable";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const clinic = await prisma.clinic.findFirst({
    where: { deletedAt: null, OR: [{ slug }, { slugAliases: { some: { slug } } }] },
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
  const clinic = await prisma.clinic.findFirst({
    where: { deletedAt: null, OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    select: {
      name: true,
      slug: true,
      timeZone: true,
      imageUrl: true,
      publicDescription: true,
      address: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      subscriptionPlan: true,
      billingOwnerId: true,
      billingOwner: true,
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
    <main id="main-content" tabIndex={-1} className="relative mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 overflow-x-hidden px-4 py-8 outline-none sm:py-12">
      <div aria-hidden="true" className="public-page-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-72" />
      <header className="flex flex-col items-center gap-3 text-center">
        {clinic.imageUrl ? (
          <Avatar className="size-16 ring-1 ring-border sm:size-20">
            <AvatarImage src={clinic.imageUrl} alt={`Logo de ${clinic.name}`} />
            <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">{clinic.name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
        ) : null}
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">Agendamento on-line</span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{clinic.name}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {clinic.publicDescription || "Agende seu atendimento em poucos passos."}
        </p>
        {clinic.address ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPinIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{clinic.address}</span>
          </p>
        ) : null}
      </header>
      <BookingSteps
        slug={clinic.slug}
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
