import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarCheckIcon, ClockIcon, MapPinIcon, ScissorsIcon } from "lucide-react";

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
  const { service, date, time, customer } = await searchParams;

  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { name: true },
  });

  if (!clinic) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 px-4 py-10">
      <Card className="border border-border/80 shadow-sm" role="status">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <CalendarCheckIcon aria-hidden="true" />
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
                  <ScissorsIcon aria-hidden="true" className="size-4" />
                  Serviço
                </dt>
                <dd className="font-medium">{service}</dd>
              </div>
            ) : null}
            {date ? (
              <div className="flex items-center justify-between gap-4 border-b pb-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <CalendarCheckIcon aria-hidden="true" className="size-4" />
                  Data
                </dt>
                <dd className="font-medium">{date}</dd>
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
        <CardFooter className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Você receberá uma confirmação no WhatsApp. Se precisar cancelar, use o link enviado na mensagem.
          </p>
          <Button nativeButton={false} render={<Link href={`/${slug}`} />} variant="outline" className="w-full">
            Fazer outro agendamento
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
