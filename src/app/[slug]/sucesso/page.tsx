import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheckIcon, CalendarIcon, ClockIcon, MapPinIcon, TagIcon, UserIcon } from "lucide-react";
import Link from "next/link";

import { SuccessActions } from "@/components/public/success-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import prisma from "@/lib/prisma";

interface SuccessPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: SuccessPageProps): Promise<Metadata> {
  const { slug } = await params;
  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { name: true },
  });

  return { title: clinic ? `Agendamento confirmado em ${clinic.name}` : "Agendamento confirmado" };
}

export default async function SuccessPage({ params, searchParams }: SuccessPageProps) {
  const { slug } = await params;
  const { service, professional, date, time } = await searchParams;

  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { name: true, timeZone: true },
  });

  if (!clinic) {
    notFound();
  }

  const formattedDate = date ? format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : null;

  return (
    <main id="main-content" tabIndex={-1} className="relative mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center gap-6 overflow-x-hidden px-4 py-8 outline-none sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top,oklch(0.91_0.08_165_/_0.45),transparent_68%)]" />
      <Card>
        <CardHeader className="items-center gap-2 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary"><CalendarCheckIcon aria-hidden="true" className="size-7" /></span>
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
                Loja
              </dt>
              <dd className="min-w-0 truncate text-right font-medium">{clinic.name}</dd>
            </div>
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
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon aria-hidden="true" className="size-4 shrink-0" />
                  Data
                </dt>
                <dd className="min-w-0 truncate text-right font-medium">{formattedDate}</dd>
              </div>
            ) : null}
            {time ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <ClockIcon aria-hidden="true" className="size-4 shrink-0" />
                  Horário
                </dt>
                <dd className="min-w-0 truncate text-right font-medium">{time}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            Guarde os dados deste agendamento. Se precisar alterar ou cancelar, entre em contato com a loja.
          </p>
          <SuccessActions
            slug={slug}
            clinicName={clinic.name}
            service={service}
            professional={professional}
            date={date}
            time={time}
            timeZone={clinic.timeZone}
          />
          <Button nativeButton={false} render={<Link href={`/${slug}`} />} variant="outline" className="h-12 w-full">
            Fazer outro agendamento
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
