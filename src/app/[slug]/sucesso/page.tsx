import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheckIcon, CalendarIcon, ClockIcon, MapPinIcon, TagIcon, UserIcon } from "lucide-react";
import Link from "next/link";

import { SuccessActions } from "@/components/public/success-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { service, professional, date, time, customer } = await searchParams;

  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { name: true, timeZone: true },
  });

  if (!clinic) {
    notFound();
  }

  const formattedDate = date ? format(parseISO(date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : null;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 bg-background px-4 py-8 sm:py-10">
      <Card className="border border-border/80 shadow-sm" role="status">
        <CardHeader className="gap-2">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <CalendarCheckIcon aria-hidden="true" className="size-6 text-primary sm:size-7" />
            Agendamento confirmado
          </CardTitle>
          <CardDescription>
            Seu atendimento em <strong>{clinic.name}</strong> foi reservado com sucesso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b pb-3">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <MapPinIcon aria-hidden="true" className="size-4" />
                Barbearia
              </dt>
              <dd className="font-medium">{clinic.name}</dd>
            </div>
            {service ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <TagIcon aria-hidden="true" className="size-4" />
                  Serviço
                </dt>
                <dd className="font-medium">{service}</dd>
              </div>
            ) : null}
            {professional ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <UserIcon aria-hidden="true" className="size-4" />
                  Profissional
                </dt>
                <dd className="font-medium">{professional}</dd>
              </div>
            ) : null}
            {formattedDate ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon aria-hidden="true" className="size-4" />
                  Data
                </dt>
                <dd className="font-medium">{formattedDate}</dd>
              </div>
            ) : null}
            {time ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <ClockIcon aria-hidden="true" className="size-4" />
                  Horário
                </dt>
                <dd className="font-medium">{time}</dd>
              </div>
            ) : null}
            {customer ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd className="font-medium">{customer}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <p className="text-center text-sm leading-relaxed text-muted-foreground">
            Você receberá uma confirmação no WhatsApp. Se precisar cancelar, use o link enviado na mensagem.
          </p>
          <SuccessActions
            slug={slug}
            clinicName={clinic.name}
            service={service}
            professional={professional}
            date={date}
            time={time}
            customer={customer}
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
