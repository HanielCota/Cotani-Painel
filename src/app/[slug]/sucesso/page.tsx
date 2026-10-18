import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheckIcon, CalendarIcon, ClockIcon, MapPinIcon, TagIcon, UserIcon } from "lucide-react";
import Link from "next/link";

import { SuccessActions } from "@/components/public/success-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import prisma from "@/lib/prisma";

interface SuccessPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: SuccessPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await prisma.clinic.findFirst({
    where: { OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    select: { name: true },
  });

  return { title: clinic ? `Agendamento confirmado em ${clinic.name}` : "Agendamento confirmado" };
}

export default async function SuccessPage({ params, searchParams }: SuccessPageProps) {
  const [{ slug }, { service, professional, date, time, duration }] = await Promise.all([params, searchParams]);

  const clinic = await prisma.clinic.findFirst({
    where: { OR: [{ slug }, { slugAliases: { some: { slug } } }] },
    select: { name: true, timeZone: true, slug: true, phone: true, address: true, imageUrl: true },
  });

  if (!clinic) {
    notFound();
  }

  const formattedDate = date ? format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : null;

  return (
    <main id="main-content" tabIndex={-1} className="relative mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 overflow-x-hidden px-4 py-8 outline-none sm:py-10">
      <div aria-hidden="true" className="public-page-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-72" />
      <Card>
        <CardHeader className="items-center gap-2 text-center">
          <Avatar className="size-14">
            {clinic.imageUrl ? <AvatarImage src={clinic.imageUrl} alt={`Logo de ${clinic.name}`} /> : null}
            <AvatarFallback className="bg-accent text-primary"><CalendarCheckIcon aria-hidden="true" className="size-7" /></AvatarFallback>
          </Avatar>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Agendamento confirmado
          </h1>
          <CardDescription role="status">
            Seu atendimento em <strong>{clinic.name}</strong> foi reservado com sucesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
                Local
              </dt>
              <dd className="min-w-0 truncate text-right font-medium">{clinic.name}</dd>
            </div>
            {clinic.address ? (
              <div className="flex items-start justify-between gap-4 border-b pb-3">
                <dt className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  <MapPinIcon aria-hidden="true" className="size-4 shrink-0" />
                  Endereço
                </dt>
                <dd className="max-w-[65%] text-right font-medium break-words">{clinic.address}</dd>
              </div>
            ) : null}
            {service ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <TagIcon aria-hidden="true" className="size-4 shrink-0" />
                  Serviço
                </dt>
                <dd className="min-w-0 truncate text-right font-medium">{service}</dd>
              </div>
            ) : null}
            {professional ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <UserIcon aria-hidden="true" className="size-4 shrink-0" />
                  Profissional
                </dt>
                <dd className="min-w-0 truncate text-right font-medium">{professional}</dd>
              </div>
            ) : null}
            {formattedDate ? (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-3 py-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon aria-hidden="true" className="size-4 shrink-0" />
                  Data
                </dt>
                <dd className="min-w-0 text-right text-base font-semibold">{formattedDate}</dd>
              </div>
            ) : null}
            {time ? (
              <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/60 px-3 py-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <ClockIcon aria-hidden="true" className="size-4 shrink-0" />
                  Horário
                </dt>
                <dd className="min-w-0 text-right text-lg font-semibold text-primary">{time}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            Guarde os dados deste agendamento. Você também pode salvá-lo no calendário para receber lembretes.
          </p>
          <SuccessActions
            clinicName={clinic.name}
            service={service}
            professional={professional}
            date={date}
            time={time}
            duration={duration}
            timeZone={clinic.timeZone}
            phone={clinic.phone}
            address={clinic.address}
          />
          <Button nativeButton={false} render={<Link href={`/${clinic.slug}`} />} className="h-12 w-full">
            Fazer outro agendamento
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
