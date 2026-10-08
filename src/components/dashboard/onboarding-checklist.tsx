"use client";

import Link from "next/link";
import { CalendarCheckIcon, CheckIcon, ClockIcon, LinkIcon, SettingsIcon, TagIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";
import { markBookingLinkShared, readBookingLinkShared, subscribeBookingLinkShared } from "@/lib/booking-link-shared";

interface OnboardingChecklistProps {
  bookingUrl: string;
  hasServices: boolean;
  hasBusinessHours: boolean;
  hasProfessionals: boolean;
  hasAppointments: boolean;
  isSubscriptionActive: boolean;
}


export function OnboardingChecklist({
  bookingUrl,
  hasServices,
  hasBusinessHours,
  hasProfessionals,
  hasAppointments,
  isSubscriptionActive,
}: OnboardingChecklistProps) {
  const linkCopied = useSyncExternalStore(subscribeBookingLinkShared, readBookingLinkShared, () => false);
  // Quem já recebe agendamentos já divulgou o link, mesmo sem copiá-lo por aqui.
  const linkShared = linkCopied || hasAppointments;

  const steps = [
    {
      id: "subscription",
      label: "Assinatura ativa",
      description: "Renove o plano para liberar agendamentos e configurações.",
      done: isSubscriptionActive,
      href: "/dashboard/assinatura",
      icon: TriangleAlertIcon,
    },
    {
      id: "business-hours",
      label: "Definir expediente",
      description: "Informe os dias e horários de funcionamento.",
      done: hasBusinessHours,
      href: "/dashboard/negocio/horarios",
      icon: ClockIcon,
    },
    {
      id: "services",
      label: "Cadastrar serviços",
      description: "Adicione os serviços oferecidos com preço e duração.",
      done: hasServices,
      href: "/dashboard/negocio/servicos",
      icon: TagIcon,
    },
    {
      id: "professionals",
      label: "Cadastrar profissionais",
      description: "Defina quem realizará os serviços do negócio.",
      done: hasProfessionals,
      href: "/dashboard/negocio/profissionais",
      icon: UsersIcon,
    },
    {
      id: "link",
      label: "Divulgar link de agendamento",
      description: "Copie o link e publique no Instagram, WhatsApp ou site.",
      done: linkShared,
      href: bookingUrl,
      icon: LinkIcon,
      external: true,
    },
    {
      id: "first-appointment",
      label: "Receber o primeiro agendamento",
      description: "O passo final é ter um horário reservado na agenda.",
      done: hasAppointments,
      href: "/dashboard/agenda",
      icon: CalendarCheckIcon,
    },
  ];

  const completedCount = steps.filter((step) => step.done).length;

  if (completedCount === steps.length) return null;

  return (
    <Card className="border border-primary/20 bg-primary/5 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SettingsIcon className="size-4 text-primary" />
          Primeiros passos
        </CardTitle>
        <CardDescription>
          Complete as configurações para começar a receber agendamentos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 text-sm" data-testid="onboarding-progress">
          <span className="font-medium">{completedCount}</span>
          <span className="text-muted-foreground">de {steps.length} concluídos</span>
          <div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-primary/20">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(completedCount / steps.length) * 100}%` }}
            />
          </div>
        </div>

        <ul className="flex flex-col gap-3">
          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <li
                key={step.id}
                className={`flex items-start gap-3 rounded-xl border p-3 ${step.done ? "bg-accent/45" : "bg-card"}`}
              >
                <div
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border ${
                    step.done ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30 text-muted-foreground"
                  }`}
                >
                  {step.done ? <CheckIcon className="size-4" /> : <Icon className="size-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.done ? "text-muted-foreground line-through" : ""}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {step.external ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const copied = await copyText(step.href);
                      if (!copied) {
                        toast.error("Não foi possível copiar o link. Abra a página pública e copie o endereço do navegador.");
                        return;
                      }
                      markBookingLinkShared();
                      toast.success("Link de agendamento copiado.");
                    }}
                  >
                    <LinkIcon className="mr-1.5 size-3.5" />
                    Copiar link
                  </Button>
                ) : (
                  <Link
                    href={step.href}
                    className={cn(
                      buttonVariants({ variant: step.done ? "outline" : "default", size: "sm" }),
                      "shrink-0",
                    )}
                  >
                    {step.done ? "Revisar" : "Configurar"}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
